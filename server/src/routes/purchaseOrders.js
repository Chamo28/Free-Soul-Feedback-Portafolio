import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { requireAdmin } from "../middleware/auth.js";
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  addPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  setPurchaseOrderItems,
  updatePurchaseOrderItem,
  deletePurchaseOrderItem,
  getCurationSurveyById,
  getCurationResponses,
  updateCurationSurveyItem,
} from "../jsonStore.js";
import { parseImportText } from "../services/csvParser.js";
import { computeOrderSummary } from "../services/purchaseOrderCalc.js";
import { writePurchaseOrderSheet, rowsFromPurchaseOrder } from "../services/sheets.js";
import { computeCurationRankings } from "../services/curationScoring.js";

const CATEGORY_MAP = { bolsos: "Bolsos", calzado: "Calzado", ropa: "Ropa", accesorios: "Accesorios" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "..", "uploads");

const router = Router();

// --- Pedidos ---

router.get("/", requireAdmin, (_req, res) => {
  const orders = getPurchaseOrders().map((o) => {
    const { totales } = computeOrderSummary(o);
    return {
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      totalProductos: totales.totalProductos,
      totalUnidades: totales.totalUnidades,
      totalLandedCOP: totales.totalLandedCOP,
    };
  });
  res.json(orders);
});

router.post("/", requireAdmin, (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Falta el nombre del pedido." });
  }
  const order = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    createdAt: new Date().toISOString(),
    tasaUSDaRMB: 7.2,
    trmUSDaCOP: 4000,
    comisionAgentePct: 0,
    costoReetiquetadoUnitarioRMB: 0,
    factorImportacionPct: 0,
    fleteNacionalUnitarioCOP: 0,
    items: [],
  };
  addPurchaseOrder(order);
  res.status(201).json(order);
});

router.get("/:id", requireAdmin, (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  const { items, totales } = computeOrderSummary(order);
  res.json({ ...order, items, totales });
});

router.patch("/:id", requireAdmin, (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  const patch = {};
  if (typeof req.body.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
  if (req.body.tasaUSDaRMB != null) patch.tasaUSDaRMB = Number(req.body.tasaUSDaRMB) || 0;
  if (req.body.trmUSDaCOP != null) patch.trmUSDaCOP = Number(req.body.trmUSDaCOP) || 0;
  if (req.body.comisionAgentePct != null) patch.comisionAgentePct = Number(req.body.comisionAgentePct) || 0;
  if (req.body.costoReetiquetadoUnitarioRMB != null)
    patch.costoReetiquetadoUnitarioRMB = Number(req.body.costoReetiquetadoUnitarioRMB) || 0;
  if (req.body.factorImportacionPct != null) patch.factorImportacionPct = Number(req.body.factorImportacionPct) || 0;
  if (req.body.fleteNacionalUnitarioCOP != null)
    patch.fleteNacionalUnitarioCOP = Number(req.body.fleteNacionalUnitarioCOP) || 0;
  const updated = updatePurchaseOrder(req.params.id, patch);
  const { items, totales } = computeOrderSummary(updated);
  res.json({ ...updated, items, totales });
});

router.delete("/:id", requireAdmin, (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  deletePurchaseOrder(req.params.id);
  const orderDir = path.join(UPLOADS_DIR, "purchase-orders", req.params.id);
  fs.rm(orderDir, { recursive: true, force: true }, () => {});
  res.json({ ok: true });
});

// --- Importación masiva CSV/TXT ---
//
// No se descarga ni guarda ninguna imagen en el disco del servidor: se
// conserva tal cual la URL_Imagen pública del CSV/TXT (1688/Alibaba/etc.) y
// se usa directamente como src en el <img> del cliente. Esto evita depender
// del disco temporal de Render (se borra en cada redeploy/reinicio) y deja
// la persistencia real en Google Sheets, sin costo de disco/almacenamiento.
router.post("/:id/import", requireAdmin, async (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: "No llegó contenido para importar (pega o sube el CSV/TXT)." });
  }

  const { items: parsedItems, warnings } = parseImportText(text);
  if (parsedItems.length === 0) {
    return res.status(400).json({ error: "No se reconoció ningún producto en el archivo.", warnings });
  }

  const newItems = [];
  const imageWarnings = [...warnings];

  for (const parsed of parsedItems) {
    const itemId = crypto.randomUUID();
    const photos = parsed.images.filter((u) => typeof u === "string" && u.trim());
    if (photos.length === 0) {
      imageWarnings.push(`"${parsed.referencia}": no tiene ninguna URL de imagen.`);
    }

    newItems.push({
      id: itemId,
      productUrl: parsed.productUrl,
      referencia: parsed.referencia,
      photos,
      categoria: "",
      genero: "",
      costoUnitarioRMB: 0,
      cantidadPorEmpaque: 0,
      cantidadEmpaques: 0,
    });
  }

  const updatedOrder = setPurchaseOrderItems(order.id, [...order.items, ...newItems]);
  const { items, totales } = computeOrderSummary(updatedOrder);
  res.status(201).json({ ...updatedOrder, items, totales, importWarnings: imageWarnings, importedCount: newItems.length });
});

// --- Traer productos ganadores de una Curaduría de Portafolio ---
//
// No se descarga ni copia ninguna imagen a disco: el pedido simplemente
// reutiliza las mismas URLs/rutas de foto que ya tiene el producto en la
// curaduría de origen (nada de fs.copyFileSync — cero escritura a disco
// desde este módulo, en línea con no depender del disco temporal de Render).
router.post("/:id/import-from-curation", requireAdmin, async (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

  const { surveyId, itemIds, totalUnidades } = req.body || {};
  const survey = getCurationSurveyById(surveyId);
  if (!survey) return res.status(404).json({ error: "Encuesta de curaduría no encontrada." });
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: "Selecciona al menos un producto de la curaduría." });
  }

  const responses = getCurationResponses().filter((r) => r.surveyId === surveyId);
  const { ranking } = computeCurationRankings(survey, responses);
  const rankByProductId = new Map(ranking.map((r) => [r.productId, r]));

  const selectedItems = survey.items.filter((i) => itemIds.includes(i.id));
  const sumWeight = selectedItems.reduce((sum, it) => sum + (rankByProductId.get(it.id)?.pctPonderado || 0), 0);
  const mappedCategoria = CATEGORY_MAP[(survey.category || "").trim().toLowerCase()] || "";

  const newItems = [];
  for (const curItem of selectedItems) {
    const itemId = crypto.randomUUID();
    const photos = curItem.photos && curItem.photos.length ? curItem.photos : curItem.photo ? [curItem.photo] : [];

    const rankRow = rankByProductId.get(curItem.id);
    const pct = rankRow?.pctPonderado || 0;
    const suggestedUnits = totalUnidades && sumWeight > 0 ? Math.round((Number(totalUnidades) * pct) / sumWeight) : 0;

    newItems.push({
      id: itemId,
      productUrl: curItem.productUrl || "",
      referencia: curItem.name,
      photos,
      categoria: mappedCategoria,
      genero: "",
      costoUnitarioRMB: 0,
      cantidadPorEmpaque: suggestedUnits,
      cantidadEmpaques: suggestedUnits > 0 ? 1 : 0,
      curationMeta: {
        surveyId: survey.id,
        surveyName: survey.name,
        surveyItemId: curItem.id,
        pctPonderado: pct,
        votos: rankRow?.votos || 0,
        label: rankRow?.label || "",
      },
    });

    updateCurationSurveyItem(survey.id, curItem.id, {
      importedOrderIds: [...(curItem.importedOrderIds || []), order.id],
    });
  }

  const updatedOrder = setPurchaseOrderItems(order.id, [...order.items, ...newItems]);
  const { items, totales } = computeOrderSummary(updatedOrder);
  res.status(201).json({ ...updatedOrder, items, totales, importedCount: newItems.length });
});

// --- Items individuales ---

// Agrega un producto vacío al pedido para completarlo a mano — cubre el caso
// de un CSV/TXT incompleto (sin fotos, sin algún dato) o cuando simplemente
// se quiere sumar un producto suelto que no vino de ningún archivo.
router.post("/:id/items", requireAdmin, (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

  const { referencia, productUrl } = req.body || {};
  const newItem = {
    id: crypto.randomUUID(),
    productUrl: typeof productUrl === "string" ? productUrl.trim() : "",
    referencia: typeof referencia === "string" && referencia.trim() ? referencia.trim() : "Producto nuevo",
    photos: [],
    categoria: "",
    genero: "",
    costoUnitarioRMB: 0,
    cantidadPorEmpaque: 0,
    cantidadEmpaques: 0,
  };
  const updatedOrder = setPurchaseOrderItems(order.id, [...order.items, newItem]);
  const { items, totales } = computeOrderSummary(updatedOrder);
  res.status(201).json({ ...updatedOrder, items, totales });
});

router.patch("/:id/items/:itemId", requireAdmin, (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

  const allowed = [
    "categoria",
    "genero",
    "costoUnitarioRMB",
    "cantidadPorEmpaque",
    "cantidadEmpaques",
    "referencia",
    "productUrl",
    "photos",
  ];
  const patch = {};
  for (const key of allowed) {
    if (key in (req.body || {})) patch[key] = req.body[key];
  }
  // "photos" puede llegar como string (un solo link, o varios separados por
  // coma) desde el input de la grilla — se normaliza siempre a array.
  if ("photos" in patch) {
    if (typeof patch.photos === "string") {
      patch.photos = patch.photos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (!Array.isArray(patch.photos)) {
      patch.photos = [];
    }
  }
  const updated = updatePurchaseOrderItem(req.params.id, req.params.itemId, patch);
  if (!updated) return res.status(404).json({ error: "Producto no encontrado en este pedido." });
  res.json(updated);
});

router.delete("/:id/items/:itemId", requireAdmin, (req, res) => {
  const ok = deletePurchaseOrderItem(req.params.id, req.params.itemId);
  if (!ok) return res.status(404).json({ error: "Producto no encontrado en este pedido." });
  const itemDir = path.join(UPLOADS_DIR, "purchase-orders", req.params.id, req.params.itemId);
  fs.rm(itemDir, { recursive: true, force: true }, () => {});
  res.json({ ok: true });
});

// --- Sincronizar con Google Sheets ---

router.post("/:id/sync", requireAdmin, async (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  const { items } = computeOrderSummary(order);
  const rows = rowsFromPurchaseOrder(order, items);
  const result = await writePurchaseOrderSheet(order.id, rows);
  res.json(result);
});

// --- Exportar CSV ---

router.get("/:id/export.csv", requireAdmin, (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  const { items } = computeOrderSummary(order);

  const header = [
    "Referencia",
    "URL_Producto",
    "Categoria",
    "Genero",
    "Costo_Unitario_RMB",
    "Costo_Unitario_USD",
    "Cantidad_Por_Empaque",
    "Cantidad_Empaques",
    "Cantidad_Total",
    "Precio_Total_FOB_USD",
    "Flete_Nacional_Unitario_COP",
    "Flete_Nacional_Total_COP",
    "Costo_Landed_Total_COP",
    "Origen_Curaduria",
    "Peso_Ponderado_Curaduria",
    "URL_Imagen",
    "Comision_Agente_COP",
    "Costo_Reetiquetado_Total_COP",
    "Factor_Importacion_Monto_COP",
  ];
  const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(csvEscape).join(",")];
  for (const item of items) {
    lines.push(
      [
        item.referencia,
        item.productUrl,
        item.categoria,
        item.genero,
        item.costoUnitarioRMB,
        item.costoUnitarioUSD,
        item.cantidadPorEmpaque,
        item.cantidadEmpaques,
        item.cantidadTotal,
        item.precioTotalFOB_USD,
        item.fleteNacionalUnitarioCOP,
        item.fleteNacionalTotalCOP,
        item.costoLandedTotalCOP,
        item.curationMeta?.surveyName || "",
        item.curationMeta ? `${item.curationMeta.pctPonderado}%` : "",
        item.photos?.[0] || "",
        item.comisionAgenteTotalCOP,
        item.reetiquetadoTotalCOP,
        item.factorImportacionMontoCOP,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  const csv = "﻿" + lines.join("\r\n"); // BOM para que Excel abra bien los acentos

  const safeName = order.name.replace(/[^a-z0-9]+/gi, "_");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="pedido_${safeName}.csv"`);
  res.send(csv);
});

export default router;

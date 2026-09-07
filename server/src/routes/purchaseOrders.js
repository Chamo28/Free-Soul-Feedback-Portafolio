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
} from "../jsonStore.js";
import { parseImportText } from "../services/csvParser.js";
import { downloadImages } from "../services/imageDownloader.js";
import { computeOrderSummary, DEFAULT_CATEGORY_FREIGHT_COP } from "../services/purchaseOrderCalc.js";
import { writePurchaseOrderSheet, rowsFromPurchaseOrder } from "../services/sheets.js";

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
    tasaRMBaUSD: 0.14,
    trmUSDaCOP: 4000,
    categoryFreightRates: { ...DEFAULT_CATEGORY_FREIGHT_COP },
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
  if (req.body.tasaRMBaUSD != null) patch.tasaRMBaUSD = Number(req.body.tasaRMBaUSD) || 0;
  if (req.body.trmUSDaCOP != null) patch.trmUSDaCOP = Number(req.body.trmUSDaCOP) || 0;
  if (req.body.categoryFreightRates && typeof req.body.categoryFreightRates === "object") {
    patch.categoryFreightRates = { ...order.categoryFreightRates, ...req.body.categoryFreightRates };
  }
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
    const itemDir = path.join(UPLOADS_DIR, "purchase-orders", order.id, itemId);
    const downloadResults = parsed.images.length > 0 ? await downloadImages(parsed.images, itemDir) : [];
    const photos = downloadResults
      .filter((r) => r.ok)
      .map((r) => `/uploads/purchase-orders/${order.id}/${itemId}/${r.filename}`);
    const failed = downloadResults.filter((r) => !r.ok);
    if (failed.length > 0) {
      imageWarnings.push(`"${parsed.referencia}": ${failed.length} foto(s) no se pudieron descargar.`);
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
      fleteOverrideCOP: null,
    });
  }

  const updatedOrder = setPurchaseOrderItems(order.id, [...order.items, ...newItems]);
  const { items, totales } = computeOrderSummary(updatedOrder);
  res.status(201).json({ ...updatedOrder, items, totales, importWarnings: imageWarnings, importedCount: newItems.length });
});

// --- Items individuales ---

router.patch("/:id/items/:itemId", requireAdmin, (req, res) => {
  const order = getPurchaseOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

  const allowed = [
    "categoria",
    "genero",
    "costoUnitarioRMB",
    "cantidadPorEmpaque",
    "cantidadEmpaques",
    "fleteOverrideCOP",
    "referencia",
  ];
  const patch = {};
  for (const key of allowed) {
    if (key in (req.body || {})) patch[key] = req.body[key];
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
    "Flete_Unitario_COP",
    "Flete_Total_COP",
    "Costo_Landed_Total_COP",
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
        item.fleteUnitarioCOP,
        item.fleteTotalCOP,
        item.costoLandedTotalCOP,
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

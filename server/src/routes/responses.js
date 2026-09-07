import { Router } from "express";
import crypto from "crypto";
import { requireAdmin } from "../middleware/auth.js";
import {
  addResponse,
  getResponses,
  getResponseById,
  deleteResponse,
  getProductById,
  getProducts,
  markResponseSynced,
} from "../jsonStore.js";
import { appendRow, rowFromResponse, deleteResponseRow } from "../services/sheets.js";
import { summarizeResponses } from "../services/scoring.js";

const router = Router();

function isValidScore(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

router.post("/", async (req, res) => {
  const { productId, evaluador, atractivo, calidad, precio, compraria, comentarios, submissionId } = req.body || {};

  const product = getProductById(productId);
  if (!product) return res.status(404).json({ error: "Producto no encontrado." });

  const a = Number(atractivo);
  const c = Number(calidad);
  const p = Number(precio);
  if (![a, c, p].every(isValidScore)) {
    return res.status(400).json({ error: "Atractivo, calidad y precio deben ser números del 1 al 5." });
  }
  if (typeof compraria !== "boolean") {
    return res.status(400).json({ error: "Compraría debe ser sí/no." });
  }

  // Red de seguridad contra el mismo envío repetido (doble-tap en mobile,
  // reintento de red): el navegador genera un submissionId aleatorio UNA vez
  // por visita y lo reenvía igual en cada intento. Si ya existe una respuesta
  // con ese mismo submissionId, es literalmente el mismo envío. NO se compara
  // por puntajes/comentario: dos evaluadores distintos que califican igual
  // (muy común con escalas 1-5) deben quedar guardados cada uno por separado.
  if (submissionId) {
    const existing = getResponses().find((r) => r.productId === productId && r.submissionId === submissionId);
    if (existing) {
      return res.status(201).json({ ok: true, synced: existing.synced, duplicate: true });
    }
  }

  const response = {
    id: crypto.randomUUID(),
    submissionId: submissionId || null,
    productId,
    evaluador: (evaluador && String(evaluador).trim()) || "Anónimo",
    fecha: new Date().toISOString(),
    atractivo: a,
    calidad: c,
    precio: p,
    compraria,
    comentarios: (comentarios && String(comentarios).trim()) || "",
    synced: false,
  };

  addResponse(response);

  // Intento de sincronizar con Google Sheets; si falla, queda marcada como no sincronizada
  // para reintentarse luego (endpoint /api/sync o el próximo submit).
  const result = await appendRow(rowFromResponse(response, product));
  if (result.ok) {
    response.synced = true;
    markResponseSynced(response.id, true); // persiste a disco (antes solo se mutaba en memoria y se perdía)
  }

  res.status(201).json({ ok: true, synced: response.synced });
});

router.get("/", requireAdmin, (req, res) => {
  const { productId } = req.query;
  let list = getResponses();
  if (productId) list = list.filter((r) => r.productId === productId);
  res.json(list);
});

// Borra la respuesta de UN evaluador puntual: de la base local y, si ya se
// había sincronizado, también su fila exacta en la hoja (nunca toca las demás).
router.delete("/:id", requireAdmin, async (req, res) => {
  const response = getResponseById(req.params.id);
  if (!response) return res.status(404).json({ error: "Respuesta no encontrada." });

  deleteResponse(req.params.id);

  let sheetResult = { ok: true, foundInSheet: false };
  if (response.synced) {
    sheetResult = await deleteResponseRow(response.id);
  }

  res.json({ ok: true, borradoDeSheets: sheetResult.foundInSheet });
});

router.get("/rankings", requireAdmin, (_req, res) => {
  const responses = getResponses();
  const products = getProducts();
  const summaries = summarizeResponses(responses).map((s) => {
    const product = products.find((p) => p.id === s.productId);
    return { ...s, product: product || null };
  });
  // orden descendente por promedio
  summaries.sort((x, y) => y.promedio - x.promedio);
  res.json(summaries);
});

export default router;

import { Router } from "express";
import crypto from "crypto";
import { requireAdmin } from "../middleware/auth.js";
import { addResponse, getResponses, getProductById, getProducts } from "../jsonStore.js";
import { appendRow, rowFromResponse } from "../services/sheets.js";
import { summarizeResponses } from "../services/scoring.js";

const router = Router();

function isValidScore(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

router.post("/", async (req, res) => {
  const { productId, evaluador, atractivo, calidad, precio, compraria, comentarios } = req.body || {};

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

  const response = {
    id: crypto.randomUUID(),
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
    // actualizar en el store
    const all = getResponses();
    const stored = all.find((r) => r.id === response.id);
    if (stored) stored.synced = true;
  }

  res.status(201).json({ ok: true, synced: response.synced });
});

router.get("/", requireAdmin, (req, res) => {
  const { productId } = req.query;
  let list = getResponses();
  if (productId) list = list.filter((r) => r.productId === productId);
  res.json(list);
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

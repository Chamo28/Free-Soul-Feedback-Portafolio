import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { getUnsyncedResponses, markResponseSynced, getProductById, getUnsyncedCurationResponses } from "../jsonStore.js";
import { appendRow, rowFromResponse, getStatus } from "../services/sheets.js";
import { retryUnsyncedCurationResponses } from "./curation.js";

const router = Router();

router.get("/status", requireAdmin, (_req, res) => {
  const unsynced = getUnsyncedResponses();
  const unsyncedCuration = getUnsyncedCurationResponses();
  res.json({ ...getStatus(), unsyncedCount: unsynced.length, unsyncedCurationCount: unsyncedCuration.length });
});

router.post("/", requireAdmin, async (_req, res) => {
  const pending = getUnsyncedResponses();
  let pushed = 0;
  const errors = [];
  for (const r of pending) {
    const product = getProductById(r.productId);
    const result = await appendRow(rowFromResponse(r, product));
    if (result.ok) {
      markResponseSynced(r.id, true);
      pushed++;
    } else {
      errors.push(result.error);
      break; // si falla, probablemente sigue fallando (config); no martillar la API
    }
  }

  const curationResult = await retryUnsyncedCurationResponses();

  res.json({
    pushed,
    remaining: pending.length - pushed,
    error: errors[0] || null,
    curation: curationResult,
  });
});

export default router;

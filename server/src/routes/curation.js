import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { requireAdmin } from "../middleware/auth.js";
import {
  getCurationSurveys,
  getCurationSurveyById,
  addCurationSurvey,
  updateCurationSurvey,
  deleteCurationSurvey,
  addCurationResponse,
  getCurationResponses,
  getUnsyncedCurationResponses,
  markCurationResponseSynced,
} from "../jsonStore.js";
import {
  appendCurationResponseRow,
  rowFromCurationResponse,
  writeCurationRankingSheet,
} from "../services/sheets.js";
import { computeCurationRankings } from "../services/curationScoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOADS_DIR permite apuntar a un disco persistente en producción (ver README).
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "..", "uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 40 },
});

const router = Router();

// --- Encuestas de curaduría ---

router.get("/surveys", requireAdmin, (_req, res) => {
  res.json(getCurationSurveys());
});

router.get("/surveys/:id", (req, res) => {
  const survey = getCurationSurveyById(req.params.id);
  if (!survey) return res.status(404).json({ error: "Encuesta de curaduría no encontrada." });
  res.json(survey);
});

router.post("/surveys", requireAdmin, upload.array("photos", 40), async (req, res) => {
  try {
    const { name, category, selectionMode, selectionCount, instructions } = req.body;
    let names = [];
    try {
      names = JSON.parse(req.body.names || "[]");
    } catch {
      names = [];
    }

    if (!name || !category) {
      return res.status(400).json({ error: "Falta el nombre de la dinámica o la categoría." });
    }
    const mode = selectionMode === "max" ? "max" : "exact";
    const count = Number(selectionCount);
    if (!Number.isInteger(count) || count < 1) {
      return res.status(400).json({ error: "La cantidad a seleccionar debe ser un número entero mayor a 0." });
    }

    const files = req.files || [];
    if (files.length < 2) {
      return res.status(400).json({ error: "Sube al menos 2 productos/fotos para la curaduría." });
    }
    if (mode === "exact" && count > files.length) {
      return res.status(400).json({ error: `No puedes pedir seleccionar ${count} si solo subiste ${files.length} productos.` });
    }

    const id = crypto.randomUUID();
    const surveyDir = path.join(UPLOADS_DIR, "curation", id);
    fs.mkdirSync(surveyDir, { recursive: true });

    const items = [];
    for (let i = 0; i < files.length; i++) {
      const itemId = crypto.randomUUID();
      const filename = `item-${i + 1}.jpg`;
      const outPath = path.join(surveyDir, filename);
      await sharp(files[i].buffer)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toFile(outPath);
      items.push({
        id: itemId,
        name: (names[i] && String(names[i]).trim()) || `Producto ${i + 1}`,
        photo: `/uploads/curation/${id}/${filename}`,
      });
    }

    const survey = {
      id,
      type: "curaduria",
      name: name.trim(),
      category,
      instructions: (instructions && String(instructions).trim()) || "",
      selectionRule: { mode, count },
      items,
      createdAt: new Date().toISOString(),
    };
    addCurationSurvey(survey);
    res.status(201).json(survey);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando la curaduría: " + err.message });
  }
});

router.patch("/surveys/:id", requireAdmin, (req, res) => {
  const survey = getCurationSurveyById(req.params.id);
  if (!survey) return res.status(404).json({ error: "Encuesta no encontrada." });
  const patch = {};
  if (typeof req.body.instructions === "string") patch.instructions = req.body.instructions.trim();
  if (typeof req.body.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
  const updated = updateCurationSurvey(req.params.id, patch);
  res.json(updated);
});

router.delete("/surveys/:id", requireAdmin, (req, res) => {
  const survey = getCurationSurveyById(req.params.id);
  if (!survey) return res.status(404).json({ error: "Encuesta no encontrada." });
  deleteCurationSurvey(req.params.id);
  const surveyDir = path.join(UPLOADS_DIR, "curation", req.params.id);
  fs.rm(surveyDir, { recursive: true, force: true }, () => {});
  res.json({ ok: true });
});

// --- Respuestas de curaduría ---

router.post("/responses", async (req, res) => {
  const { surveyId, evaluador, selectedProductIds, comentarios, submissionId } = req.body || {};

  const survey = getCurationSurveyById(surveyId);
  if (!survey) return res.status(404).json({ error: "Encuesta de curaduría no encontrada." });

  if (!Array.isArray(selectedProductIds) || selectedProductIds.length === 0) {
    return res.status(400).json({ error: "Debes seleccionar productos." });
  }
  const validIds = new Set(survey.items.map((i) => i.id));
  const allValid = selectedProductIds.every((id) => validIds.has(id));
  if (!allValid) {
    return res.status(400).json({ error: "Hay productos seleccionados que no pertenecen a esta encuesta." });
  }
  const uniqueCount = new Set(selectedProductIds).size;
  if (uniqueCount !== selectedProductIds.length) {
    return res.status(400).json({ error: "Hay productos repetidos en la selección." });
  }
  const { count } = survey.selectionRule;
  if (selectedProductIds.length !== count) {
    return res.status(400).json({ error: `Debes seleccionar exactamente ${count} productos (seleccionaste ${selectedProductIds.length}).` });
  }

  // El orden en que el evaluador fue haciendo clic ES el ranking de preferencia:
  // selectedProductIds[0] = su favorito absoluto (#1), el último = el que menos le gustó.
  const favoriteId = selectedProductIds[0];

  // Red de seguridad contra el mismo envío repetido (doble-tap en mobile,
  // reintento de red): el navegador genera un submissionId aleatorio UNA vez
  // por visita y lo reenvía igual en cada intento. Si ya existe una respuesta
  // con ese mismo submissionId, es literalmente el mismo envío — no un
  // evaluador distinto que coincide por casualidad en la selección (por eso
  // NO comparamos por nombre/contenido: dos personas anónimas que eligen lo
  // mismo casi al tiempo deben quedar guardadas igual, cada una la suya).
  if (submissionId) {
    const existing = getCurationResponses().find(
      (r) => r.surveyId === surveyId && r.submissionId === submissionId
    );
    if (existing) {
      return res.status(201).json({ ok: true, synced: existing.synced, duplicate: true });
    }
  }

  const response = {
    id: crypto.randomUUID(),
    submissionId: submissionId || null,
    surveyId,
    evaluador: (evaluador && String(evaluador).trim()) || "Anónimo",
    fecha: new Date().toISOString(),
    selectedProductIds,
    favoriteId,
    comentarios: (comentarios && String(comentarios).trim()) || "",
    synced: false,
  };

  addCurationResponse(response);

  const result = await appendCurationResponseRow(rowFromCurationResponse(response, survey));
  if (result.ok) {
    response.synced = true;
    markCurationResponseSynced(response.id, true); // persiste a disco (antes solo se mutaba en memoria y se perdía)
  }

  // Actualizamos también la hoja de ranking agregado (best-effort; si Sheets
  // no está configurado o falla, el ranking sigue disponible en el dashboard local).
  await syncRankingSheet(survey);

  res.status(201).json({ ok: true, synced: response.synced });
});

router.get("/responses", requireAdmin, (req, res) => {
  const { surveyId } = req.query;
  let list = getCurationResponses();
  if (surveyId) list = list.filter((r) => r.surveyId === surveyId);
  res.json(list);
});

router.get("/rankings/:surveyId", requireAdmin, (req, res) => {
  const survey = getCurationSurveyById(req.params.surveyId);
  if (!survey) return res.status(404).json({ error: "Encuesta no encontrada." });
  const responses = getCurationResponses().filter((r) => r.surveyId === survey.id);
  res.json(computeCurationRankings(survey, responses));
});

async function syncRankingSheet(survey) {
  const responses = getCurationResponses().filter((r) => r.surveyId === survey.id);
  const { ranking } = computeCurationRankings(survey, responses);
  const rows = ranking.map((row) => [
    row.productId,
    row.name,
    survey.id,
    row.votos,
    `${row.pctSeleccion}%`,
    `${row.pctPonderado}%`,
    row.posicionPromedio ?? "",
    row.label,
  ]);
  await writeCurationRankingSheet(survey.id, rows);
}

export async function retryUnsyncedCurationResponses() {
  const pending = getUnsyncedCurationResponses();
  let pushed = 0;
  let error = null;
  const touchedSurveyIds = new Set();
  for (const r of pending) {
    const survey = getCurationSurveyById(r.surveyId);
    const result = await appendCurationResponseRow(rowFromCurationResponse(r, survey));
    if (result.ok) {
      markCurationResponseSynced(r.id, true);
      pushed++;
      if (survey) touchedSurveyIds.add(survey.id);
    } else {
      error = result.error;
      break;
    }
  }
  // El botón "Sincronizar" también debe dejar la pestaña de ranking al día,
  // no solo el log de respuestas (antes solo se actualizaba en el envío original).
  for (const surveyId of touchedSurveyIds) {
    const survey = getCurationSurveyById(surveyId);
    if (survey) await syncRankingSheet(survey);
  }
  return { pushed, remaining: pending.length - pushed, error };
}

export default router;

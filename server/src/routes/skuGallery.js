import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { requireAdmin } from "../middleware/auth.js";
import {
  getSkuGalleryVariants,
  addSkuGalleryVariants,
  updateSkuGalleryVariant,
  deleteSkuGalleryVariant,
} from "../jsonStore.js";
import { uploadImageToDrive, deleteDriveFile, isDriveConfigured, driveConfigError } from "../services/drive.js";
import { writeSkuGallerySheet } from "../services/sheets.js";
import { brandContext } from "../brandContext.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 60 },
});

const router = Router();

// Modelo/Referencia = letra(s) al inicio del nombre de archivo; Variante de
// color = el número que sigue. "A1.jpg" -> modelo "A", code "A1". Admite
// separador opcional (A-1, A_1) y mayúscula/minúscula indistinta. Lo que no
// matchea (foto sin ese patrón) se reporta como advertencia, no se agrega.
function parseSkuFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  // Letra: 1-4 caracteres (cubre modelos de una letra o abreviaturas cortas).
  // Número: 1-3 dígitos EXACTOS (el (?!\d) evita que corte a la mitad) — así
  // nombres típicos de cámara/celular (IMG_2024.jpg, DCIM0001.jpg,
  // WhatsApp Image 2024...) no matchean por accidente como si fueran un
  // código de variante real.
  const match = base.match(/^([A-Za-z]{1,4})[-_ ]?(\d{1,3})(?!\d)/);
  if (!match) return null;
  const modelo = match[1].toUpperCase();
  const numero = match[2];
  return { modelo, code: `${modelo}${numero}` };
}

router.get("/", requireAdmin, (_req, res) => {
  res.json({ variants: getSkuGalleryVariants(), driveConfigured: isDriveConfigured() });
});

// Sube un lote de fotos locales: cada una se parsea por nombre, se sube a
// la carpeta de Drive de la marca activa (nunca al disco de Render) y se
// registra como variante nueva — códigos que ya existen se saltan (no se
// re-suben ni se duplican). Igual que en curation.js: multer procesa los
// archivos por streams y en producción se ha visto que eso "pierde" el
// contexto de AsyncLocalStorage que usan jsonStore.js/drive.js, así que se
// vuelve a fijar explícitamente con brandContext.run(req.brand, ...) apenas
// termina multer, usando req.brand (lo fijó el middleware withBrand ANTES
// de multer, 100% confiable) como fuente de verdad.
router.post("/upload", requireAdmin, upload.array("photos", 60), (req, res) =>
  brandContext.run(req.brand, async () => {
    try {
      if (!isDriveConfigured()) {
        return res.status(400).json({ error: driveConfigError() });
      }
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "No llegó ninguna foto." });
      }

      const existingCodes = new Set(getSkuGalleryVariants().map((v) => v.code.toLowerCase()));
      const unrecognized = [];
      const duplicates = [];
      const uploadFailures = [];
      const toAdd = [];

      for (const file of files) {
        const parsed = parseSkuFilename(file.originalname);
        if (!parsed) {
          unrecognized.push(file.originalname);
          continue;
        }
        if (existingCodes.has(parsed.code.toLowerCase())) {
          duplicates.push(parsed.code);
          continue;
        }
        const uploadResult = await uploadImageToDrive(file.buffer, file.originalname, file.mimetype);
        if (!uploadResult.ok) {
          uploadFailures.push(`${parsed.code}: ${uploadResult.error}`);
          continue;
        }
        existingCodes.add(parsed.code.toLowerCase()); // evita duplicados dentro del mismo lote
        toAdd.push({
          id: crypto.randomUUID(),
          modelo: parsed.modelo,
          code: parsed.code,
          label: parsed.code,
          driveUrl: uploadResult.driveUrl,
          driveFileId: uploadResult.fileId,
          approved: false,
          cantidad: 0,
          addedAt: new Date().toISOString(),
        });
      }

      const { added, all } = addSkuGalleryVariants(toAdd);
      res.status(201).json({
        variants: all,
        addedCount: added.length,
        duplicates,
        unrecognized,
        uploadFailures,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error subiendo las fotos: " + err.message });
    }
  })
);

router.patch("/variants/:id", requireAdmin, (req, res) => {
  const allowed = ["label", "modelo", "approved", "cantidad"];
  const patch = {};
  for (const key of allowed) {
    if (key in (req.body || {})) patch[key] = req.body[key];
  }
  if ("cantidad" in patch) patch.cantidad = Number(patch.cantidad) || 0;
  if ("approved" in patch) patch.approved = Boolean(patch.approved);
  const updated = updateSkuGalleryVariant(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Variante no encontrada." });
  res.json(updated);
});

router.delete("/variants/:id", requireAdmin, async (req, res) => {
  const deleted = deleteSkuGalleryVariant(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Variante no encontrada." });
  await deleteDriveFile(deleted.driveFileId); // best-effort, no bloquea la respuesta si falla
  res.json({ ok: true });
});

// Sincroniza SOLO las variantes aprobadas a la pestaña SKUs_Aprobados —
// reemplaza toda la pestaña por el estado actual (hay una sola galería por
// marca, ver comentario en sheets.js writeSkuGallerySheet).
router.post("/sync", requireAdmin, async (req, res) => {
  const approved = getSkuGalleryVariants().filter((v) => v.approved);
  const rows = approved.map((v) => [v.modelo, v.code, v.label, v.cantidad, v.driveUrl, new Date().toISOString()]);
  const result = await writeSkuGallerySheet(rows);
  res.json(result);
});

export default router;

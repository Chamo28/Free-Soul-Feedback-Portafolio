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
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  isCloudinaryConfigured,
  cloudinaryConfigError,
} from "../services/cloudinary.js";
import { writeSkuGallerySheet } from "../services/sheets.js";
import { brandContext } from "../brandContext.js";

// El límite de archivos por request es un tope de SEGURIDAD, no el tamaño
// de lote esperado: el frontend divide subidas grandes en lotes chicos (ver
// SkuGallery.jsx) para poder mostrar progreso y no golpear timeouts de
// Render/el navegador con una sola request gigante — este número solo
// necesita cubrir ese tamaño de lote con margen.
const MAX_FILES_PER_REQUEST = 40;
const UPLOAD_CONCURRENCY = 5; // mismo valor que imageDownloader.js

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: MAX_FILES_PER_REQUEST },
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
  res.json({ variants: getSkuGalleryVariants(), photoHostConfigured: isCloudinaryConfigured() });
});

// Sube un lote de fotos locales: cada una se parsea por nombre, se sube a
// Cloudinary en una carpeta de la marca activa (nunca al disco de Render) y
// se registra como variante nueva — códigos que ya existen se saltan (no se
// re-suben ni se duplican). Igual que en curation.js: multer procesa los
// archivos por streams y en producción se ha visto que eso "pierde" el
// contexto de AsyncLocalStorage que usan jsonStore.js/cloudinary.js, así que
// se vuelve a fijar explícitamente con brandContext.run(req.brand, ...) apenas
// termina multer, usando req.brand (lo fijó el middleware withBrand ANTES
// de multer, 100% confiable) como fuente de verdad.
router.post("/upload", requireAdmin, upload.array("photos", MAX_FILES_PER_REQUEST), (req, res) =>
  brandContext.run(req.brand, async () => {
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(400).json({ error: cloudinaryConfigError() });
      }
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "No llegó ninguna foto." });
      }

      const existingCodes = new Set(getSkuGalleryVariants().map((v) => v.code.toLowerCase()));
      const unrecognized = [];
      const duplicates = [];
      const uploadFailures = [];

      // Filtra de entrada lo que no hace falta subir a Cloudinary (nombre no
      // reconocido, código ya existente) — solo las fotos que SÍ se van a
      // subir pasan al pool de concurrencia de abajo.
      const toUpload = [];
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
        existingCodes.add(parsed.code.toLowerCase()); // evita duplicados dentro del mismo lote
        toUpload.push({ file, parsed });
      }

      // Subida en paralelo (con tope de concurrencia, igual que
      // imageDownloader.js) en vez de una por una — con lotes de decenas de
      // fotos, subir en serie tardaba minutos y no daba ninguna señal de
      // progreso real. Una foto fallida no detiene a las demás.
      const results = new Array(toUpload.length);
      let cursor = 0;
      async function worker() {
        while (cursor < toUpload.length) {
          const index = cursor++;
          const { file, parsed } = toUpload[index];
          const uploadResult = await uploadImageToCloudinary(file.buffer, file.originalname);
          results[index] = { parsed, uploadResult };
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, toUpload.length) }, () => worker())
      );

      const toAdd = [];
      for (const { parsed, uploadResult } of results) {
        if (!uploadResult.ok) {
          uploadFailures.push(`${parsed.code}: ${uploadResult.error}`);
          continue;
        }
        toAdd.push({
          id: crypto.randomUUID(),
          modelo: parsed.modelo,
          code: parsed.code,
          label: parsed.code,
          photoUrl: uploadResult.photoUrl,
          photoPublicId: uploadResult.publicId,
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
  await deleteImageFromCloudinary(deleted.photoPublicId); // best-effort, no bloquea la respuesta si falla
  res.json({ ok: true });
});

// Sincroniza SOLO las variantes aprobadas a la pestaña SKUs_Aprobados —
// reemplaza toda la pestaña por el estado actual (hay una sola galería por
// marca, ver comentario en sheets.js writeSkuGallerySheet).
router.post("/sync", requireAdmin, async (req, res) => {
  const approved = getSkuGalleryVariants().filter((v) => v.approved);
  const rows = approved.map((v) => [v.modelo, v.code, v.label, v.cantidad, v.photoUrl, new Date().toISOString()]);
  const result = await writeSkuGallerySheet(rows);
  res.json(result);
});

export default router;

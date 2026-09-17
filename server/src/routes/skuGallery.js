import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { requireAdmin } from "../middleware/auth.js";
import {
  getSkuGalleryVariants,
  addSkuGalleryVariants,
  updateSkuGalleryVariant,
  deleteSkuGalleryVariant,
  deleteSkuGalleryVariantsByModelo,
  getSkuGalleryCollections,
  addSkuGalleryCollection,
  updateSkuGalleryCollection,
  deleteSkuGalleryCollection,
  setModeloCollections,
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

  // Patrón 1: LETRA(S)+NÚMERO, pegado o con un separador — "A1", "Detalle_23",
  // "Principal01". Letras sin tope (antes tope de 4, pero nombres reales de
  // fotógrafo/proveedor son descriptivos: "Detalle", "Principal"...) — lo
  // que de verdad filtra los nombres de cámara/celular es el NÚMERO: 1-3
  // dígitos EXACTOS (el (?!\d) evita que corte a la mitad), así que
  // "IMG_2024.jpg"/"DCIM0001.jpg" (4 dígitos) siguen sin matchear por
  // accidente como si fueran un código de variante real.
  let match = base.match(/^([A-Za-z]+)[-_ ]?(\d{1,3})(?!\d)/);
  if (match) {
    const modelo = match[1].toUpperCase();
    return { modelo, code: `${modelo}${match[2]}` };
  }

  // Patrón 2: "nombre (N)" — lo que deja Windows al guardar duplicados sin
  // renombrar ("a.jpg", "a (1).jpg", "a (2).jpg"...). El nombre base (sin
  // el "(N)") se limpia de todo lo que no sea letra/número para armar el
  // modelo; si queda vacío (nombre puramente numérico o de símbolos), cae a
  // "REF" en vez de fallar.
  match = base.match(/^(.+?)\s*\((\d{1,3})\)$/);
  if (match) {
    const modelo = match[1].replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "REF";
    return { modelo, code: `${modelo}${match[2]}` };
  }

  return null;
}

router.get("/", requireAdmin, (_req, res) => {
  res.json({
    variants: getSkuGalleryVariants(),
    collections: getSkuGalleryCollections(),
    photoHostConfigured: isCloudinaryConfigured(),
  });
});

// --- Colecciones (agrupación de negocio: nombre, descripción, PVP
// objetivo, categoría) — ver comentario en jsonStore.js. Las variantes solo
// guardan collectionId; el frontend arma el join con esta lista.
const CATEGORIAS_COLECCION = ["Bolsos", "Calzado", "Ropa", "Accesorios"];

router.post("/collections", requireAdmin, (req, res) => {
  const { name, description, pvpObjetivo, categoria } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Falta el nombre de la colección." });
  }
  if (categoria && !CATEGORIAS_COLECCION.includes(categoria)) {
    return res.status(400).json({ error: "Categoría inválida." });
  }
  const collection = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    description: (description && String(description).trim()) || "",
    pvpObjetivo: Number(pvpObjetivo) || 0,
    categoria: categoria || "",
    createdAt: new Date().toISOString(),
  };
  addSkuGalleryCollection(collection);
  res.status(201).json(collection);
});

router.patch("/collections/:id", requireAdmin, (req, res) => {
  const allowed = ["name", "description", "pvpObjetivo", "categoria"];
  const patch = {};
  for (const key of allowed) {
    if (key in (req.body || {})) patch[key] = req.body[key];
  }
  if (typeof patch.name === "string") {
    if (!patch.name.trim()) return res.status(400).json({ error: "El nombre de la colección no puede quedar vacío." });
    patch.name = patch.name.trim();
  }
  if ("pvpObjetivo" in patch) patch.pvpObjetivo = Number(patch.pvpObjetivo) || 0;
  if (patch.categoria && !CATEGORIAS_COLECCION.includes(patch.categoria)) {
    return res.status(400).json({ error: "Categoría inválida." });
  }
  const updated = updateSkuGalleryCollection(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Colección no encontrada." });
  res.json(updated);
});

// Borra la colección — se QUITA (no borra) de todas las variantes que la
// tenían asignada; si estaban en otras colecciones también, se quedan ahí
// (ver jsonStore.js).
router.delete("/collections/:id", requireAdmin, (req, res) => {
  const ok = deleteSkuGalleryCollection(req.params.id);
  if (!ok) return res.status(404).json({ error: "Colección no encontrada." });
  res.json({ ok: true, variants: getSkuGalleryVariants() });
});

// Reemplaza el set COMPLETO de colecciones de TODAS las variantes de un
// modelo de una sola vez — ver setModeloCollections en jsonStore.js. body:
// { collectionIds: [...] } (puede ser varias, o [] para "Sin colección").
router.patch("/models/:modelo/collections", requireAdmin, (req, res) => {
  const { collectionIds } = req.body || {};
  if (!Array.isArray(collectionIds)) {
    return res.status(400).json({ error: "collectionIds debe ser una lista (puede ir vacía)." });
  }
  const known = new Set(getSkuGalleryCollections().map((c) => c.id));
  for (const id of collectionIds) {
    if (!known.has(id)) return res.status(400).json({ error: "Colección no encontrada." });
  }
  const { count, variants } = setModeloCollections(req.params.modelo, collectionIds);
  if (count === 0) return res.status(404).json({ error: "No hay variantes de ese modelo." });
  res.json({ ok: true, variants });
});

// Sube un lote de fotos locales: cada una se parsea por nombre, se sube a
// Cloudinary en una carpeta de la marca activa (nunca al disco de Render).
// Un código que YA existe (ej. volver a soltar "A1.jpg") no se salta ni se
// duplica: SOBREESCRIBE la foto de esa variante (conserva su id/aprobado/
// cantidad/nombre — solo cambia photoUrl/photoPublicId), y la foto vieja se
// borra de Cloudinary. Igual que en curation.js: multer procesa los
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

      // Campo opcional "collectionId" (multer lo deja en req.body junto a
      // los demás campos que no son archivo) — si el admin tenía una
      // colección filtrada/seleccionada al soltar las fotos: una variante
      // NUEVA nace ya con esa colección; una variante que YA EXISTÍA (se
      // está reemplazando la foto) la AGREGA a su lista sin quitarle las
      // que ya tenía — una misma foto puede estar en varias colecciones a
      // la vez, así que volver a soltar el mismo lote con otra colección
      // seleccionada es justamente la forma de sumarla a esa otra también.
      let targetCollectionId = null;
      if (req.body?.collectionId) {
        const exists = getSkuGalleryCollections().some((c) => c.id === req.body.collectionId);
        if (!exists) return res.status(400).json({ error: "Colección no encontrada." });
        targetCollectionId = req.body.collectionId;
      }

      const existingByCode = new Map(getSkuGalleryVariants().map((v) => [v.code.toLowerCase(), v]));
      const unrecognized = [];
      const uploadFailures = [];

      // Todo lo que SÍ tiene nombre reconocible se sube — ya sea foto nueva o
      // reemplazo de una existente (se decide después de subir, comparando
      // contra existingByCode). Lo único que se descarta antes de subir es
      // lo que no matchea el patrón LETRA+NÚMERO.
      const toUpload = [];
      for (const file of files) {
        const parsed = parseSkuFilename(file.originalname);
        if (!parsed) {
          unrecognized.push(file.originalname);
          continue;
        }
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

      // toAdd puede tener MÁS de una entrada apuntada por el mismo código
      // dentro de este mismo lote (dos archivos con igual código, caso
      // raro) — newByCode deja actualizar in-place esa entrada todavía sin
      // persistir en vez de intentar un PATCH contra un id que la base de
      // datos aún no conoce.
      const toAdd = [];
      const newByCode = new Map();
      const overwritten = [];
      for (const { parsed, uploadResult } of results) {
        if (!uploadResult.ok) {
          uploadFailures.push(`${parsed.code}: ${uploadResult.error}`);
          continue;
        }
        const codeKey = parsed.code.toLowerCase();
        const pendingNew = newByCode.get(codeKey);
        if (pendingNew) {
          deleteImageFromCloudinary(pendingNew.photoPublicId); // la copia anterior de este mismo lote ya no sirve
          pendingNew.photoUrl = uploadResult.photoUrl;
          pendingNew.photoPublicId = uploadResult.publicId;
          continue;
        }
        const existing = existingByCode.get(codeKey);
        if (existing) {
          const oldPublicId = existing.photoPublicId;
          const patch = { photoUrl: uploadResult.photoUrl, photoPublicId: uploadResult.publicId };
          // Si se soltó con una colección seleccionada, se SUMA a la lista
          // que ya tenía (no la reemplaza) — así la misma foto puede quedar
          // en varias colecciones con subidas sucesivas.
          if (targetCollectionId && !existing.collectionIds.includes(targetCollectionId)) {
            patch.collectionIds = [...existing.collectionIds, targetCollectionId];
          }
          updateSkuGalleryVariant(existing.id, patch);
          deleteImageFromCloudinary(oldPublicId); // best-effort, no bloquea la respuesta
          overwritten.push(parsed.code);
        } else {
          const item = {
            id: crypto.randomUUID(),
            modelo: parsed.modelo,
            code: parsed.code,
            label: parsed.code,
            photoUrl: uploadResult.photoUrl,
            photoPublicId: uploadResult.publicId,
            approved: false,
            cantidad: 0,
            collectionIds: targetCollectionId ? [targetCollectionId] : [],
            addedAt: new Date().toISOString(),
          };
          toAdd.push(item);
          newByCode.set(codeKey, item);
        }
      }

      const { added, all } = addSkuGalleryVariants(toAdd);
      res.status(201).json({
        variants: all,
        addedCount: added.length,
        overwrittenCount: overwritten.length,
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

// Borra de una sola vez TODOS los modelos de la lista (todas sus
// variantes/fotos) — ej. seleccionar los modelos C, H, I y borrarlos con un
// solo botón, en vez de una variante a la vez. body: { modelos: ["C","H"] }
router.delete("/models", requireAdmin, async (req, res) => {
  const { modelos } = req.body || {};
  if (!Array.isArray(modelos) || modelos.length === 0) {
    return res.status(400).json({ error: "Selecciona al menos un modelo para borrar." });
  }
  const { deleted, all } = deleteSkuGalleryVariantsByModelo(modelos);
  if (deleted.length === 0) {
    return res.status(404).json({ error: "No se encontró ninguna variante de esos modelos." });
  }
  await Promise.all(deleted.map((v) => deleteImageFromCloudinary(v.photoPublicId))); // best-effort
  res.json({ ok: true, deletedCount: deleted.length, variants: all });
});

// Sincroniza SOLO las variantes aprobadas a la pestaña SKUs_Aprobados —
// reemplaza toda la pestaña por el estado actual (hay una sola galería por
// marca, ver comentario en sheets.js writeSkuGallerySheet). Como una misma
// variante puede estar en VARIAS colecciones a la vez, genera una fila por
// cada colección a la que pertenece (con el PVP/categoría de esa colección
// puntual) — y una sola fila con esos campos vacíos si no tiene ninguna.
router.post("/sync", requireAdmin, async (req, res) => {
  const collectionsById = new Map(getSkuGalleryCollections().map((c) => [c.id, c]));
  const approved = getSkuGalleryVariants().filter((v) => v.approved);
  const now = new Date().toISOString();
  const rows = [];
  for (const v of approved) {
    const cols = v.collectionIds.length > 0 ? v.collectionIds.map((id) => collectionsById.get(id)).filter(Boolean) : [null];
    for (const col of cols) {
      rows.push([
        col?.name || "",
        v.modelo,
        v.code,
        v.label,
        v.cantidad,
        v.photoUrl,
        col?.pvpObjetivo || "",
        col?.categoria || "",
        col?.description || "",
        now,
      ]);
    }
  }
  const result = await writeSkuGallerySheet(rows);
  res.json(result);
});

export default router;

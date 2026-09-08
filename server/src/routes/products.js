import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { requireAdmin } from "../middleware/auth.js";
import { getProducts, getProductById, addProduct, updateProduct, deleteProduct } from "../jsonStore.js";
import { brandUploadsDir, brandUploadsUrlPrefix } from "../uploadsPath.js";
import { brandContext } from "../brandContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOADS_DIR permite apuntar a un disco persistente en producción (ver README).
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "..", "uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 7 },
});

const router = Router();

const DEFAULT_CATEGORIES = ["Zapatos", "Camisetas", "Bolsos", "Accesorios"];

router.get("/categories", (_req, res) => {
  const used = getProducts().map((p) => p.category);
  const all = Array.from(new Set([...DEFAULT_CATEGORIES, ...used]));
  res.json(all);
});

router.get("/", (_req, res) => {
  res.json(getProducts());
});

router.get("/:id", (req, res) => {
  const product = getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado." });
  res.json(product);
});

// req.brand ya lo fijó el middleware withBrand ANTES de multer (leyendo el
// header X-Brand-Id de forma síncrona, así que es 100% confiable). Pero
// multer procesa los archivos por streams internamente y en producción se
// ha visto que eso puede "perder" el contexto de AsyncLocalStorage que usan
// jsonStore.js/uploadsPath.js — resultado: el producto terminaba guardado
// en la marca por defecto (Free Soul) sin importar qué marca mandara el
// admin. Por eso se vuelve a fijar el contexto explícitamente con
// brandContext.run(req.brand, ...) apenas termina multer, antes de tocar
// cualquier dato — dentro de este bloque currentBrand() ya es confiable.
router.post("/", requireAdmin, upload.array("photos", 7), (req, res) =>
  brandContext.run(req.brand, async () => {
  try {
    const { name, category, instructions } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: "Falta nombre o categoría." });
    }
    const files = req.files || [];
    if (files.length < 1) {
      return res.status(400).json({ error: "Sube al menos 1 foto (ideal 6-7)." });
    }

    const id = crypto.randomUUID();
    const productDir = brandUploadsDir(UPLOADS_DIR, id);
    fs.mkdirSync(productDir, { recursive: true });

    const photoFilenames = [];
    for (let i = 0; i < files.length; i++) {
      const filename = `foto-${i + 1}.jpg`;
      const outPath = path.join(productDir, filename);
      await sharp(files[i].buffer)
        .rotate()
        .resize({ width: 1400, withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toFile(outPath);
      photoFilenames.push(filename);
    }

    const product = {
      id,
      name,
      category,
      instructions: (instructions && String(instructions).trim()) || "",
      photos: photoFilenames.map((f) => `/uploads/${brandUploadsUrlPrefix()}${id}/${f}`),
      createdAt: new Date().toISOString(),
    };
    addProduct(product);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error subiendo el producto: " + err.message });
  }
  })
);

router.patch("/:id", requireAdmin, (req, res) => {
  const product = getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado." });
  const patch = {};
  if (typeof req.body.instructions === "string") patch.instructions = req.body.instructions.trim();
  if (typeof req.body.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
  const updated = updateProduct(req.params.id, patch);
  res.json(updated);
});

router.delete("/:id", requireAdmin, (req, res) => {
  const product = getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado." });
  deleteProduct(req.params.id);
  const productDir = brandUploadsDir(UPLOADS_DIR, req.params.id);
  fs.rm(productDir, { recursive: true, force: true }, () => {});
  res.json({ ok: true });
});

export default router;

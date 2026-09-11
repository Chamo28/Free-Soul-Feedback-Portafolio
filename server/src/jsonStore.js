import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { currentBrand } from "./brandContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR permite apuntar a un disco persistente en producción (ej. Render),
// donde el filesystem normal se borra en cada deploy/reinicio. En desarrollo
// local, sin la variable, sigue usando server/data como siempre.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "..", "data");

// Cada marca tiene su propio archivo de datos (brand.dataFile) — así los
// productos/curadurías/pedidos de una marca nunca se mezclan con los de
// otra. Se resuelve en el momento (no una sola vez al cargar el módulo) para
// que siga la marca activa del request actual (ver brandContext.js).
function getDbPath() {
  return path.join(DATA_DIR, currentBrand().dataFile);
}

const DEFAULT_DB = {
  products: [],
  responses: [],
  curationSurveys: [],
  curationResponses: [],
  purchaseOrders: [],
  skuGalleryVariants: [],
};

function ensureDb() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(getDbPath(), "utf-8");
  try {
    // merge con DEFAULT_DB para que bases de datos viejas (creadas antes de
    // agregar Curaduría de Portafolio) obtengan las colecciones nuevas como [].
    return { ...DEFAULT_DB, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DB };
  }
}

function writeDb(db) {
  fs.writeFileSync(getDbPath(), JSON.stringify(db, null, 2));
}

// --- Products ---
export function getProducts() {
  return readDb().products;
}

export function getProductById(id) {
  return readDb().products.find((p) => p.id === id) || null;
}

export function addProduct(product) {
  const db = readDb();
  db.products.push(product);
  writeDb(db);
  return product;
}

export function deleteProduct(id) {
  const db = readDb();
  const before = db.products.length;
  db.products = db.products.filter((p) => p.id !== id);
  writeDb(db);
  return db.products.length < before;
}

export function updateProduct(id, patch) {
  const db = readDb();
  const product = db.products.find((p) => p.id === id);
  if (!product) return null;
  Object.assign(product, patch);
  writeDb(db);
  return product;
}

// --- Responses ---
export function getResponses() {
  return readDb().responses;
}

export function addResponse(response) {
  const db = readDb();
  db.responses.push(response);
  writeDb(db);
  return response;
}

export function getUnsyncedResponses() {
  return readDb().responses.filter((r) => !r.synced);
}

export function markResponseSynced(id, synced = true) {
  const db = readDb();
  const r = db.responses.find((x) => x.id === id);
  if (r) {
    r.synced = synced;
    writeDb(db);
  }
}

export function getResponseById(id) {
  return readDb().responses.find((r) => r.id === id) || null;
}

export function deleteResponse(id) {
  const db = readDb();
  const before = db.responses.length;
  db.responses = db.responses.filter((r) => r.id !== id);
  writeDb(db);
  return db.responses.length < before;
}

// --- Curation surveys (Curaduría de Portafolio / Top-K) ---
export function getCurationSurveys() {
  return readDb().curationSurveys;
}

export function getCurationSurveyById(id) {
  return readDb().curationSurveys.find((s) => s.id === id) || null;
}

export function addCurationSurvey(survey) {
  const db = readDb();
  db.curationSurveys.push(survey);
  writeDb(db);
  return survey;
}

export function deleteCurationSurvey(id) {
  const db = readDb();
  const before = db.curationSurveys.length;
  db.curationSurveys = db.curationSurveys.filter((s) => s.id !== id);
  writeDb(db);
  return db.curationSurveys.length < before;
}

export function updateCurationSurvey(id, patch) {
  const db = readDb();
  const survey = db.curationSurveys.find((s) => s.id === id);
  if (!survey) return null;
  Object.assign(survey, patch);
  writeDb(db);
  return survey;
}

// patch: name, productUrl, approvedForOrder, importedOrderIds — campos por
// producto dentro de una curaduría (usados para conectarla con Pedidos).
export function updateCurationSurveyItem(surveyId, itemId, patch) {
  const db = readDb();
  const survey = db.curationSurveys.find((s) => s.id === surveyId);
  if (!survey) return null;
  const item = survey.items.find((i) => i.id === itemId);
  if (!item) return null;
  Object.assign(item, patch);
  writeDb(db);
  return item;
}

// Agrega un producto nuevo al final de una curaduría existente (edición).
export function addCurationSurveyItem(surveyId, item) {
  const db = readDb();
  const survey = db.curationSurveys.find((s) => s.id === surveyId);
  if (!survey) return null;
  survey.items.push(item);
  writeDb(db);
  return survey;
}

// Reemplaza el array de items completo (usado por la reimportación desde
// CSV/TXT, que fusiona/actualiza en memoria y aquí solo persiste el
// resultado final).
export function setCurationSurveyItems(surveyId, items) {
  const db = readDb();
  const survey = db.curationSurveys.find((s) => s.id === surveyId);
  if (!survey) return null;
  survey.items = items;
  writeDb(db);
  return survey;
}

// Quita UN producto de una curaduría existente (edición manual). No toca
// las respuestas ya guardadas — si algún evaluador ya lo habia seleccionado,
// esa respuesta historica simplemente deja de mostrar ese item puntual, sin
// romper el resto de su seleccion.
export function deleteCurationSurveyItem(surveyId, itemId) {
  const db = readDb();
  const survey = db.curationSurveys.find((s) => s.id === surveyId);
  if (!survey) return false;
  const before = survey.items.length;
  survey.items = survey.items.filter((i) => i.id !== itemId);
  writeDb(db);
  return survey.items.length < before;
}

// --- Curation responses ---
export function getCurationResponses() {
  return readDb().curationResponses;
}

export function addCurationResponse(response) {
  const db = readDb();
  db.curationResponses.push(response);
  writeDb(db);
  return response;
}

export function getUnsyncedCurationResponses() {
  return readDb().curationResponses.filter((r) => !r.synced);
}

export function markCurationResponseSynced(id, synced = true) {
  const db = readDb();
  const r = db.curationResponses.find((x) => x.id === id);
  if (r) {
    r.synced = synced;
    writeDb(db);
  }
}

export function getCurationResponseById(id) {
  return readDb().curationResponses.find((r) => r.id === id) || null;
}

export function deleteCurationResponse(id) {
  const db = readDb();
  const before = db.curationResponses.length;
  db.curationResponses = db.curationResponses.filter((r) => r.id !== id);
  writeDb(db);
  return db.curationResponses.length < before;
}

// --- Purchase orders (Gestión de Pedidos y Sourcing) ---
export function getPurchaseOrders() {
  return readDb().purchaseOrders;
}

export function getPurchaseOrderById(id) {
  return readDb().purchaseOrders.find((o) => o.id === id) || null;
}

export function addPurchaseOrder(order) {
  const db = readDb();
  db.purchaseOrders.push(order);
  writeDb(db);
  return order;
}

export function deletePurchaseOrder(id) {
  const db = readDb();
  const before = db.purchaseOrders.length;
  db.purchaseOrders = db.purchaseOrders.filter((o) => o.id !== id);
  writeDb(db);
  return db.purchaseOrders.length < before;
}

// patch: campos de nivel de pedido (name, tasaUSDaRMB, trmUSDaCOP,
// comisionAgentePct, costoReetiquetadoUnitarioRMB, factorImportacionPct,
// fleteNacionalUnitarioCOP).
export function updatePurchaseOrder(id, patch) {
  const db = readDb();
  const order = db.purchaseOrders.find((o) => o.id === id);
  if (!order) return null;
  Object.assign(order, patch);
  writeDb(db);
  return order;
}

// Reemplaza el array de items completo (usado tras importar un CSV/TXT).
export function setPurchaseOrderItems(id, items) {
  const db = readDb();
  const order = db.purchaseOrders.find((o) => o.id === id);
  if (!order) return null;
  order.items = items;
  writeDb(db);
  return order;
}

export function updatePurchaseOrderItem(orderId, itemId, patch) {
  const db = readDb();
  const order = db.purchaseOrders.find((o) => o.id === orderId);
  if (!order) return null;
  const item = order.items.find((i) => i.id === itemId);
  if (!item) return null;
  Object.assign(item, patch);
  writeDb(db);
  return item;
}

export function deletePurchaseOrderItem(orderId, itemId) {
  const db = readDb();
  const order = db.purchaseOrders.find((o) => o.id === orderId);
  if (!order) return false;
  const before = order.items.length;
  order.items = order.items.filter((i) => i.id !== itemId);
  writeDb(db);
  return order.items.length < before;
}

// --- Galería Privada de SKUs y Variantes de Color ---
//
// Una lista PLANA (no anidada como curationSurveys.items) porque hay una
// sola galería por marca — no hace falta un nivel "galería" para agrupar,
// cada variante ya trae su propio "modelo" (la letra) y se agrupa en el
// frontend para mostrarla. `driveUrl`/`driveFileId` vienen de subir la foto
// a Google Drive (ver services/drive.js) — nunca se guarda la foto en el
// disco de Render.

export function getSkuGalleryVariants() {
  return readDb().skuGalleryVariants;
}

// Inserta variantes nuevas, salteando (sin error) cualquier `code` que ya
// exista — así soltar el mismo lote de fotos dos veces no duplica nada.
// Devuelve { added, skipped } para que la ruta arme sus warnings.
export function addSkuGalleryVariants(newVariants) {
  const db = readDb();
  const existingCodes = new Set(db.skuGalleryVariants.map((v) => v.code.toLowerCase()));
  const added = [];
  const skipped = [];
  for (const v of newVariants) {
    if (existingCodes.has(v.code.toLowerCase())) {
      skipped.push(v.code);
      continue;
    }
    db.skuGalleryVariants.push(v);
    existingCodes.add(v.code.toLowerCase());
    added.push(v);
  }
  writeDb(db);
  return { added, skipped, all: db.skuGalleryVariants };
}

export function updateSkuGalleryVariant(id, patch) {
  const db = readDb();
  const variant = db.skuGalleryVariants.find((v) => v.id === id);
  if (!variant) return null;
  Object.assign(variant, patch);
  writeDb(db);
  return variant;
}

export function deleteSkuGalleryVariant(id) {
  const db = readDb();
  const before = db.skuGalleryVariants.length;
  const variant = db.skuGalleryVariants.find((v) => v.id === id);
  db.skuGalleryVariants = db.skuGalleryVariants.filter((v) => v.id !== id);
  writeDb(db);
  return db.skuGalleryVariants.length < before ? variant : null;
}

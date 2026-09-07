import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR permite apuntar a un disco persistente en producción (ej. Render),
// donde el filesystem normal se borra en cada deploy/reinicio. En desarrollo
// local, sin la variable, sigue usando server/data como siempre.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const DEFAULT_DB = { products: [], responses: [], curationSurveys: [], curationResponses: [], purchaseOrders: [] };

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    // merge con DEFAULT_DB para que bases de datos viejas (creadas antes de
    // agregar Curaduría de Portafolio) obtengan las colecciones nuevas como [].
    return { ...DEFAULT_DB, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DB };
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
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

// patch: campos de nivel de pedido (name, tasaRMBaUSD, trmUSDaCOP, categoryFreightRates).
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

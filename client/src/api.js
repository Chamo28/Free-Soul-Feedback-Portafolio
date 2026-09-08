import axios from "axios";

// En desarrollo local queda vacío: Vite hace de proxy de /api y /uploads hacia
// el backend (ver vite.config.js), así que las rutas relativas funcionan solas.
// En producción (Vercel), frontend y backend viven en dominios distintos, así
// que VITE_API_URL debe apuntar a la URL pública del backend en Render, ej:
// VITE_API_URL=https://freesoul-feedback-api.onrender.com
const API_BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el token expiró o quedó inválido (el backend responde 401), se limpia
// la sesión y se manda a login con un aviso — antes esto quedaba en
// silencio: una acción (ej. "Crear pedido") fallaba sin ningún mensaje y
// parecía que el botón simplemente no hacía nada.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("admin_token")) {
      localStorage.removeItem("admin_token");
      if (!window.location.pathname.startsWith("/admin/login")) {
        window.location.href = "/admin/login?expirada=1";
      }
    }
    return Promise.reject(error);
  }
);

// Las fotos vienen del backend como rutas relativas (/uploads/...). En
// desarrollo eso basta (proxy de Vite); en producción hay que anteponerles
// el dominio del backend para que el navegador las cargue desde ahí.
function resolvePhoto(p) {
  if (!p) return p;
  if (/^https?:\/\//.test(p)) return p;
  return `${API_BASE}${p}`;
}

function withResolvedProductPhotos(product) {
  if (!product) return product;
  return { ...product, photos: (product.photos || []).map(resolvePhoto) };
}

function withResolvedCurationSurvey(survey) {
  if (!survey) return survey;
  return {
    ...survey,
    items: (survey.items || []).map((i) => ({
      ...i,
      photo: resolvePhoto(i.photo),
      photos: (i.photos || []).map(resolvePhoto),
    })),
  };
}

function withResolvedRankingRow(row) {
  if (!row) return row;
  const next = { ...row };
  if (next.photo) next.photo = resolvePhoto(next.photo);
  if (next.photos) next.photos = next.photos.map(resolvePhoto);
  if (next.product) next.product = withResolvedProductPhotos(next.product);
  return next;
}

export function isAdminLoggedIn() {
  return Boolean(localStorage.getItem("admin_token"));
}

export async function adminLogin(password) {
  const { data } = await api.post("/admin/login", { password });
  localStorage.setItem("admin_token", data.token);
}

export function adminLogout() {
  localStorage.removeItem("admin_token");
}

export async function getCategories() {
  const { data } = await api.get("/products/categories");
  return data;
}

export async function getProducts() {
  const { data } = await api.get("/products");
  return data.map(withResolvedProductPhotos);
}

export async function getProduct(id) {
  const { data } = await api.get(`/products/${id}`);
  return withResolvedProductPhotos(data);
}

export async function createProduct(formData) {
  const { data } = await api.post("/products", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return withResolvedProductPhotos(data);
}

export async function deleteProduct(id) {
  const { data } = await api.delete(`/products/${id}`);
  return data;
}

export async function updateProduct(id, patch) {
  const { data } = await api.patch(`/products/${id}`, patch);
  return data;
}

export async function submitResponse(payload) {
  const { data } = await api.post("/responses", payload);
  return data;
}

export async function getRankings() {
  const { data } = await api.get("/responses/rankings");
  return data.map(withResolvedRankingRow);
}

export async function getResponses(productId) {
  const { data } = await api.get("/responses", { params: { productId } });
  return data;
}

export async function deleteResponse(id) {
  const { data } = await api.delete(`/responses/${id}`);
  return data;
}

export async function getSyncStatus() {
  const { data } = await api.get("/sync/status");
  return data;
}

export async function triggerSync() {
  const { data } = await api.post("/sync");
  return data;
}

// --- Curaduría de Portafolio (Top-K) ---

export async function getCurationSurveys() {
  const { data } = await api.get("/curation/surveys");
  return data.map(withResolvedCurationSurvey);
}

export async function getCurationSurvey(id) {
  const { data } = await api.get(`/curation/surveys/${id}`);
  return withResolvedCurationSurvey(data);
}

export async function createCurationSurvey(formData) {
  const { data } = await api.post("/curation/surveys", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return withResolvedCurationSurvey(data);
}

export async function deleteCurationSurvey(id) {
  const { data } = await api.delete(`/curation/surveys/${id}`);
  return data;
}

export async function updateCurationSurvey(id, patch) {
  const { data } = await api.patch(`/curation/surveys/${id}`, patch);
  return data;
}

export async function submitCurationResponse(payload) {
  const { data } = await api.post("/curation/responses", payload);
  return data;
}

export async function getCurationRankings(surveyId) {
  const { data } = await api.get(`/curation/rankings/${surveyId}`);
  return {
    ...data,
    ranking: (data.ranking || []).map(withResolvedRankingRow),
    favoritoTop1: withResolvedRankingRow(data.favoritoTop1),
  };
}

export async function getCurationResponses(surveyId) {
  const { data } = await api.get("/curation/responses", { params: { surveyId } });
  return data;
}

export async function deleteCurationResponse(id) {
  const { data } = await api.delete(`/curation/responses/${id}`);
  return data;
}

// Crea una curaduría completa a partir de texto CSV/TXT con links de producto
// + foto (mismo formato/mecanismo que la importación de Pedidos).
export async function createCurationSurveyFromLinks(payload) {
  const { data } = await api.post("/curation/surveys/import-links", payload);
  return withResolvedCurationSurvey(data);
}

// patch: name, productUrl, approvedForOrder — edición puntual de un producto
// dentro de una curaduría (usado para el botón "Aprobar para pedido" y edición
// de link en los resultados).
export async function updateCurationSurveyItem(surveyId, itemId, patch) {
  const { data } = await api.patch(`/curation/surveys/${surveyId}/items/${itemId}`, patch);
  return data;
}

// --- Gestión de Pedidos y Sourcing ---

function withResolvedPurchaseOrder(order) {
  if (!order) return order;
  return { ...order, items: (order.items || []).map((i) => ({ ...i, photos: (i.photos || []).map(resolvePhoto) })) };
}

export async function getPurchaseOrders() {
  const { data } = await api.get("/purchase-orders");
  return data;
}

export async function getPurchaseOrder(id) {
  const { data } = await api.get(`/purchase-orders/${id}`);
  return withResolvedPurchaseOrder(data);
}

export async function createPurchaseOrder(name) {
  const { data } = await api.post("/purchase-orders", { name });
  return withResolvedPurchaseOrder(data);
}

export async function updatePurchaseOrder(id, patch) {
  const { data } = await api.patch(`/purchase-orders/${id}`, patch);
  return withResolvedPurchaseOrder(data);
}

export async function deletePurchaseOrder(id) {
  const { data } = await api.delete(`/purchase-orders/${id}`);
  return data;
}

export async function importPurchaseOrderText(id, text) {
  const { data } = await api.post(`/purchase-orders/${id}/import`, { text });
  return withResolvedPurchaseOrder(data);
}

// Agrega un producto vacío al pedido para completarlo a mano (cubre un
// CSV/TXT incompleto, o simplemente sumar un producto suelto).
export async function addPurchaseOrderItem(orderId, payload = {}) {
  const { data } = await api.post(`/purchase-orders/${orderId}/items`, payload);
  return withResolvedPurchaseOrder(data);
}

export async function updatePurchaseOrderItem(orderId, itemId, patch) {
  const { data } = await api.patch(`/purchase-orders/${orderId}/items/${itemId}`, patch);
  return data;
}

export async function deletePurchaseOrderItem(orderId, itemId) {
  const { data } = await api.delete(`/purchase-orders/${orderId}/items/${itemId}`);
  return data;
}

export async function syncPurchaseOrder(id) {
  const { data } = await api.post(`/purchase-orders/${id}/sync`);
  return data;
}

// Trae productos aprobados de una curaduría hacia un pedido (nuevo o existente),
// sugiriendo cantidad por empaque proporcional al puntaje ponderado de cada uno.
// payload: { surveyId, itemIds, totalUnidades }
export async function importCurationToPurchaseOrder(orderId, payload) {
  const { data } = await api.post(`/purchase-orders/${orderId}/import-from-curation`, payload);
  return withResolvedPurchaseOrder(data);
}

export async function downloadPurchaseOrderCsv(id, filename) {
  const response = await api.get(`/purchase-orders/${id}/export.csv`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "pedido.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default api;

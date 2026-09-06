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
  return { ...survey, items: (survey.items || []).map((i) => ({ ...i, photo: resolvePhoto(i.photo) })) };
}

function withResolvedRankingRow(row) {
  if (!row) return row;
  const next = { ...row };
  if (next.photo) next.photo = resolvePhoto(next.photo);
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

export default api;

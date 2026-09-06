import fs from "fs";
import path from "path";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || "Respuestas";
// Desarrollo local: ruta a un archivo JSON de credenciales en disco.
const CREDENTIALS_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
// Producción (Render, etc.): el JSON completo de la Service Account codificado
// en base64 dentro de una variable de entorno (no se puede subir un archivo
// a git ni siempre hay disco persistente). Ver README para cómo generarlo.
const CREDENTIALS_BASE64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || "";

function loadCredentialsObject() {
  if (CREDENTIALS_BASE64) {
    try {
      return JSON.parse(Buffer.from(CREDENTIALS_BASE64, "base64").toString("utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

// Pestañas fijas para el módulo de Curaduría de Portafolio (Top-K).
const CURATION_RESPONSES_TAB = "Curaduria_Respuestas";
const CURATION_RANKING_TAB = "Curaduria_Ranking";

const HEADER_ROW = [
  "Evaluador",
  "Fecha",
  "Categoria",
  "Producto",
  "Atractivo",
  "Calidad",
  "Precio",
  "Compraria",
  "Comentarios",
  "Encuesta_ID",
];

const CURATION_RESPONSES_HEADER = [
  "Evaluador_ID",
  "Fecha",
  "Encuesta_ID",
  "Categoria",
  "Productos_Seleccionados",
  "Favorito_Top1",
  "Comentarios",
];

const CURATION_RANKING_HEADER = [
  "Producto_ID",
  "Producto",
  "Encuesta_ID",
  "Votos_Recibidos",
  "%_Tasa_Seleccion",
  "%_Peso_Ponderado",
  "Posicion_Promedio",
  "Etiqueta",
];

let sheetsClient = null;
let initError = null;
const headerEnsuredTabs = new Set();

function isConfigured() {
  if (!SHEET_ID) return false;
  if (CREDENTIALS_BASE64) return true;
  return Boolean(CREDENTIALS_PATH && fs.existsSync(path.resolve(CREDENTIALS_PATH)));
}

async function getClient() {
  if (sheetsClient) return sheetsClient;
  if (!isConfigured()) {
    initError = "Google Sheets no está configurado (falta GOOGLE_SHEET_ID o las credenciales).";
    return null;
  }
  try {
    const credentialsObject = loadCredentialsObject();
    const authOptions = credentialsObject
      ? { credentials: credentialsObject, scopes: ["https://www.googleapis.com/auth/spreadsheets"] }
      : { keyFile: path.resolve(CREDENTIALS_PATH), scopes: ["https://www.googleapis.com/auth/spreadsheets"] };
    const auth = new google.auth.GoogleAuth(authOptions);
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: "v4", auth: authClient });
    initError = null;
    return sheetsClient;
  } catch (err) {
    initError = err.message;
    sheetsClient = null;
    return null;
  }
}

async function ensureHeaderFor(client, tab, headerRow) {
  if (headerEnsuredTabs.has(tab)) return;
  try {
    const lastCol = String.fromCharCode(64 + headerRow.length); // A, B, C... J
    const res = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1:${lastCol}1`,
    });
    const hasHeader = res.data.values && res.data.values.length > 0;
    if (!hasHeader) {
      await client.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${tab}!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [headerRow] },
      });
    }
    headerEnsuredTabs.add(tab);
  } catch (err) {
    // Si la pestaña no existe u otro error, seguimos igual: el append/update la puede crear.
    headerEnsuredTabs.add(tab);
  }
}

export function getStatus() {
  return {
    configured: isConfigured(),
    error: initError,
    sheetId: SHEET_ID || null,
    tab: SHEET_TAB,
    curationResponsesTab: CURATION_RESPONSES_TAB,
    curationRankingTab: CURATION_RANKING_TAB,
  };
}

// --- Encuesta Detallada ---

export function rowFromResponse(r, product) {
  return [
    r.evaluador || "Anónimo",
    r.fecha,
    product?.category || "",
    product?.name || "",
    r.atractivo,
    r.calidad,
    r.precio,
    r.compraria ? "Sí" : "No",
    r.comentarios || "",
    r.productId,
  ];
}

export async function appendRow(row) {
  return appendRowToTab(SHEET_TAB, HEADER_ROW, row);
}

// --- Curaduría de Portafolio (Top-K) ---

export function rowFromCurationResponse(r, survey) {
  const names = r.selectedProductIds
    .map((id) => survey?.items.find((i) => i.id === id)?.name || id)
    .join(", ");
  const favoriteName = survey?.items.find((i) => i.id === r.favoriteId)?.name || r.favoriteId || "";
  return [r.evaluador || "Anónimo", r.fecha, r.surveyId, survey?.category || "", names, favoriteName, r.comentarios || ""];
}

export async function appendCurationResponseRow(row) {
  return appendRowToTab(CURATION_RESPONSES_TAB, CURATION_RESPONSES_HEADER, row);
}

// Reescribe por completo la pestaña de ranking agregado de una curaduría
// (no tiene sentido "appendear": son totales que cambian con cada respuesta).
export async function writeCurationRankingSheet(surveyId, rows) {
  const client = await getClient();
  if (!client) return { ok: false, error: initError };
  try {
    await ensureHeaderFor(client, CURATION_RANKING_TAB, CURATION_RANKING_HEADER);
    // Traer todo lo existente para conservar filas de otras encuestas de curaduría.
    const lastCol = String.fromCharCode(64 + CURATION_RANKING_HEADER.length);
    const res = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${CURATION_RANKING_TAB}!A2:${lastCol}100000`,
    });
    const existing = res.data.values || [];
    const others = existing.filter((r) => r[2] !== surveyId); // columna Encuesta_ID
    const merged = [...others, ...rows];

    await client.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `${CURATION_RANKING_TAB}!A2:${lastCol}100000`,
    });
    if (merged.length > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${CURATION_RANKING_TAB}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: merged },
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// --- Helper genérico ---

async function appendRowToTab(tab, headerRow, row) {
  const client = await getClient();
  if (!client) return { ok: false, error: initError };
  try {
    await ensureHeaderFor(client, tab, headerRow);
    const lastCol = String.fromCharCode(64 + headerRow.length);
    await client.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A:${lastCol}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

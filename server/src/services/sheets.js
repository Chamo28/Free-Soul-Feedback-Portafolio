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

// La última columna (Respuesta_ID) no es parte del pedido original de negocio,
// es interna: nos permite ubicar y borrar la fila exacta de un evaluador
// desde el panel admin sin arriesgar otras filas (buscar por nombre/fecha es
// frágil si dos evaluadores comparten nombre o coinciden de milagro en hora).
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
  "Respuesta_ID",
];

const CURATION_RESPONSES_HEADER = [
  "Evaluador_ID",
  "Fecha",
  "Encuesta_ID",
  "Categoria",
  "Productos_Seleccionados",
  "Favorito_Top1",
  "Comentarios",
  "Respuesta_ID",
];

const PURCHASE_ORDERS_TAB = "Gestion_Pedidos";

const PURCHASE_ORDERS_HEADER = [
  "Pedido_ID",
  "Pedido_Nombre",
  "Referencia",
  "URL_Producto",
  "Categoria",
  "Genero",
  "Costo_Unitario_RMB",
  "Costo_Unitario_USD",
  "Cantidad_Por_Empaque",
  "Cantidad_Empaques",
  "Cantidad_Total",
  "Precio_Total_FOB_USD",
  "Flete_Nacional_Unitario_COP",
  "Flete_Nacional_Total_COP",
  "Costo_Landed_Total_COP",
  "Origen_Curaduria",
  "Peso_Ponderado_Curaduria",
  "URL_Imagen",
  "Comision_Agente_COP",
  "Costo_Reetiquetado_Total_COP",
  "Factor_Importacion_Monto_COP",
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
const tabsKnownToExist = new Set();

// La API de Sheets no crea una pestaña sola con values.append/update — hay que
// pedirlo explícitamente con batchUpdate. Sin esto, si el usuario no crea las
// pestañas a mano, cada escritura falla en silencio (queda "pendiente" para
// siempre). Se cachea por spreadsheetId+tab para no consultar en cada request.
async function ensureTabExists(client, tab) {
  if (tabsKnownToExist.has(tab)) return;
  const meta = await client.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties.title",
  });
  const existingTitles = (meta.data.sheets || []).map((s) => s.properties.title);
  if (existingTitles.includes(tab)) {
    tabsKnownToExist.add(tab);
    return;
  }
  await client.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
  });
  tabsKnownToExist.add(tab);
}

// Devuelve el sheetId (numérico, interno) de una pestaña por su nombre —
// lo pide cualquier operación de fila/columna (deleteDimension, etc).
async function getTabSheetId(client, tab) {
  const meta = await client.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties",
  });
  const found = (meta.data.sheets || []).find((s) => s.properties.title === tab);
  return found ? found.properties.sheetId : null;
}

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
    const lastCol = colLetter(headerRow.length);
    const res = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1:${lastCol}1`,
    });
    const currentHeader = res.data.values?.[0] || [];
    // Si la pestaña ya existía de una versión anterior (sin la columna
    // Respuesta_ID, por ejemplo), se extiende el encabezado en vez de dejarlo
    // corto para siempre.
    if (currentHeader.length < headerRow.length) {
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

function colLetter(n) {
  return String.fromCharCode(64 + n); // 1->A, 2->B, ... funciona hasta 26 columnas
}

export function getStatus() {
  return {
    configured: isConfigured(),
    error: initError,
    sheetId: SHEET_ID || null,
    tab: SHEET_TAB,
    curationResponsesTab: CURATION_RESPONSES_TAB,
    curationRankingTab: CURATION_RANKING_TAB,
    purchaseOrdersTab: PURCHASE_ORDERS_TAB,
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
    r.id,
  ];
}

export async function appendRow(row) {
  return appendRowToTab(SHEET_TAB, HEADER_ROW, row);
}

export async function deleteResponseRow(responseId) {
  return deleteRowByIdColumn(SHEET_TAB, HEADER_ROW.length - 1, responseId);
}

// --- Curaduría de Portafolio (Top-K) ---

export function rowFromCurationResponse(r, survey) {
  const names = r.selectedProductIds
    .map((id) => survey?.items.find((i) => i.id === id)?.name || id)
    .join(", ");
  const favoriteName = survey?.items.find((i) => i.id === r.favoriteId)?.name || r.favoriteId || "";
  return [
    r.evaluador || "Anónimo",
    r.fecha,
    r.surveyId,
    survey?.category || "",
    names,
    favoriteName,
    r.comentarios || "",
    r.id,
  ];
}

export async function appendCurationResponseRow(row) {
  return appendRowToTab(CURATION_RESPONSES_TAB, CURATION_RESPONSES_HEADER, row);
}

export async function deleteCurationResponseRow(responseId) {
  return deleteRowByIdColumn(CURATION_RESPONSES_TAB, CURATION_RESPONSES_HEADER.length - 1, responseId);
}

// Reescribe por completo la pestaña de ranking agregado de una curaduría
// (no tiene sentido "appendear": son totales que cambian con cada respuesta).
export async function writeCurationRankingSheet(surveyId, rows) {
  const client = await getClient();
  if (!client) return { ok: false, error: initError };
  try {
    await ensureTabExists(client, CURATION_RANKING_TAB);
    await ensureHeaderFor(client, CURATION_RANKING_TAB, CURATION_RANKING_HEADER);
    // Traer todo lo existente para conservar filas de otras encuestas de curaduría.
    const lastCol = colLetter(CURATION_RANKING_HEADER.length);
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

// --- Gestión de Pedidos y Sourcing ---

export function rowsFromPurchaseOrder(order, computedItems) {
  return computedItems.map((item) => [
    order.id,
    order.name,
    item.referencia,
    item.productUrl,
    item.categoria || "",
    item.genero || "",
    item.costoUnitarioRMB || 0,
    item.costoUnitarioUSD,
    item.cantidadPorEmpaque || 0,
    item.cantidadEmpaques || 0,
    item.cantidadTotal,
    item.precioTotalFOB_USD,
    item.fleteNacionalUnitarioCOP || 0,
    item.fleteNacionalTotalCOP || 0,
    item.costoLandedTotalCOP,
    item.curationMeta?.surveyName || "",
    item.curationMeta ? `${item.curationMeta.pctPonderado}%` : "",
    item.photos?.[0] || "",
    item.comisionAgenteTotalCOP || 0,
    item.reetiquetadoTotalCOP || 0,
    item.factorImportacionMontoCOP || 0,
  ]);
}

// Reescribe por completo las filas de UN pedido (identificado por Pedido_ID
// en la columna A) dentro de la pestaña compartida — conserva las filas de
// los demás pedidos. Se llama cada vez que el admin sincroniza manualmente.
export async function writePurchaseOrderSheet(orderId, rows) {
  const client = await getClient();
  if (!client) return { ok: false, error: initError };
  try {
    await ensureTabExists(client, PURCHASE_ORDERS_TAB);
    await ensureHeaderFor(client, PURCHASE_ORDERS_TAB, PURCHASE_ORDERS_HEADER);
    const lastCol = colLetter(PURCHASE_ORDERS_HEADER.length);
    const res = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${PURCHASE_ORDERS_TAB}!A2:${lastCol}100000`,
    });
    const existing = res.data.values || [];
    const others = existing.filter((r) => r[0] !== orderId); // columna Pedido_ID
    const merged = [...others, ...rows];

    await client.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `${PURCHASE_ORDERS_TAB}!A2:${lastCol}100000`,
    });
    if (merged.length > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${PURCHASE_ORDERS_TAB}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: merged },
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// --- Helpers genéricos ---

async function appendRowToTab(tab, headerRow, row) {
  const client = await getClient();
  if (!client) return { ok: false, error: initError };
  try {
    await ensureTabExists(client, tab);
    await ensureHeaderFor(client, tab, headerRow);
    const lastCol = colLetter(headerRow.length);
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

// Busca la fila cuya columna (0-based) idColIndex sea exactamente idValue y
// la borra. No falla si no la encuentra (puede que nunca haya llegado a
// sincronizarse, o Sheets no esté configurado) — en ese caso no hay nada que
// borrar ahí y el borrado local ya es suficiente.
async function deleteRowByIdColumn(tab, idColIndex, idValue) {
  const client = await getClient();
  if (!client) return { ok: false, error: initError, foundInSheet: false };
  try {
    const idCol = colLetter(idColIndex + 1);
    const res = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${tab}!${idCol}2:${idCol}100000`,
    });
    const values = res.data.values || [];
    const rowOffset = values.findIndex((row) => row[0] === idValue);
    if (rowOffset === -1) {
      return { ok: true, foundInSheet: false };
    }
    const sheetId = await getTabSheetId(client, tab);
    if (sheetId === null) return { ok: true, foundInSheet: false };
    // +1 porque el rango empezó en la fila 2 (índice 1, 0-based), +1 porque
    // deleteDimension usa índices 0-based de fila (fila 2 real = índice 1).
    const rowIndex = rowOffset + 1;
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }],
      },
    });
    return { ok: true, foundInSheet: true };
  } catch (err) {
    return { ok: false, error: err.message, foundInSheet: false };
  }
}

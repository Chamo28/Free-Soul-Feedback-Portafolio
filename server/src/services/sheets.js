import { google } from "googleapis";
import { currentBrand } from "../brandContext.js";
import { hasCredentials, getGoogleAuthClient } from "./googleAuth.js";

// Credenciales del service account: se comparten entre todas las marcas (es
// la misma cuenta de Google) — lo único que cambia por marca es a qué
// spreadsheet apuntan las llamadas (brandSheetId() abajo). El parseo de las
// credenciales vive en googleAuth.js. Las fotos de la Galería Privada de
// SKUs usan un proveedor aparte (Cloudinary, ver services/cloudinary.js) —
// no comparten credenciales con esto.

// Config de Sheets de la marca activa — se lee en el momento (no una sola
// vez al cargar el módulo) para que siga la marca del request actual.
function brandSheetId() {
  return process.env[currentBrand().sheetIdEnv] || "";
}
function brandSheetTab() {
  return process.env[currentBrand().sheetTabEnv] || "Respuestas";
}

// Pestañas fijas — el nombre es el mismo en todas las marcas porque cada
// marca tiene su propio spreadsheet (no hace falta diferenciarlas ahí).
const CURATION_RESPONSES_TAB = "Curaduria_Respuestas";
const CURATION_RANKING_TAB = "Curaduria_Ranking";
const PURCHASE_ORDERS_TAB = "Gestion_Pedidos";
const SKU_GALLERY_TAB = "SKUs_Aprobados";

const SKU_GALLERY_HEADER = ["Modelo", "Codigo", "Nombre", "Cantidad", "Foto_URL", "Fecha_Guardado"];

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

let sheetsClient = null; // un solo cliente autenticado, compartido por todas las marcas
let initError = null;
// Cacheados por "spreadsheetId:tab" (no solo "tab") — dos marcas distintas
// pueden tener una pestaña con el mismo nombre en spreadsheets distintos.
const headerEnsuredKeys = new Set();
const tabsKnownToExistKeys = new Set();

// La API de Sheets no crea una pestaña sola con values.append/update — hay que
// pedirlo explícitamente con batchUpdate. Sin esto, si el usuario no crea las
// pestañas a mano, cada escritura falla en silencio (queda "pendiente" para
// siempre).
async function ensureTabExists(client, spreadsheetId, tab) {
  const key = `${spreadsheetId}:${tab}`;
  if (tabsKnownToExistKeys.has(key)) return;
  const meta = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const existingTitles = (meta.data.sheets || []).map((s) => s.properties.title);
  if (existingTitles.includes(tab)) {
    tabsKnownToExistKeys.add(key);
    return;
  }
  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
  });
  tabsKnownToExistKeys.add(key);
}

// Devuelve el sheetId (numérico, interno) de una pestaña por su nombre —
// lo pide cualquier operación de fila/columna (deleteDimension, etc).
async function getTabSheetId(client, spreadsheetId, tab) {
  const meta = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const found = (meta.data.sheets || []).find((s) => s.properties.title === tab);
  return found ? found.properties.sheetId : null;
}

function isConfigured() {
  return Boolean(brandSheetId()) && hasCredentials();
}

async function getClient() {
  if (sheetsClient) return sheetsClient;
  if (!hasCredentials()) {
    initError = "Google Sheets no está configurado (faltan las credenciales del service account).";
    return null;
  }
  try {
    const authClient = await getGoogleAuthClient(["https://www.googleapis.com/auth/spreadsheets"]);
    sheetsClient = google.sheets({ version: "v4", auth: authClient });
    initError = null;
    return sheetsClient;
  } catch (err) {
    initError = err.message;
    sheetsClient = null;
    return null;
  }
}

async function ensureHeaderFor(client, spreadsheetId, tab, headerRow) {
  const key = `${spreadsheetId}:${tab}`;
  if (headerEnsuredKeys.has(key)) return;
  try {
    const lastCol = colLetter(headerRow.length);
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:${lastCol}1`,
    });
    const currentHeader = res.data.values?.[0] || [];
    // Si la pestaña ya existía de una versión anterior (sin la columna
    // Respuesta_ID, por ejemplo), se extiende el encabezado en vez de dejarlo
    // corto para siempre.
    if (currentHeader.length < headerRow.length) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1:${lastCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [headerRow] },
      });
    }
    headerEnsuredKeys.add(key);
  } catch (err) {
    // Si la pestaña no existe u otro error, seguimos igual: el append/update la puede crear.
    headerEnsuredKeys.add(key);
  }
}

function colLetter(n) {
  return String.fromCharCode(64 + n); // 1->A, 2->B, ... funciona hasta 26 columnas
}

export function getStatus() {
  const brand = currentBrand();
  return {
    configured: isConfigured(),
    error: initError,
    brand: brand.id,
    sheetId: brandSheetId() || null,
    tab: brandSheetTab(),
    curationResponsesTab: CURATION_RESPONSES_TAB,
    curationRankingTab: CURATION_RANKING_TAB,
    purchaseOrdersTab: PURCHASE_ORDERS_TAB,
    skuGalleryTab: SKU_GALLERY_TAB,
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
  return appendRowToTab(brandSheetTab(), HEADER_ROW, row);
}

export async function deleteResponseRow(responseId) {
  return deleteRowByIdColumn(brandSheetTab(), HEADER_ROW.length - 1, responseId);
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
  const spreadsheetId = brandSheetId();
  if (!spreadsheetId) return { ok: false, error: "Falta configurar la hoja de Google de esta marca." };
  try {
    await ensureTabExists(client, spreadsheetId, CURATION_RANKING_TAB);
    await ensureHeaderFor(client, spreadsheetId, CURATION_RANKING_TAB, CURATION_RANKING_HEADER);
    // Traer todo lo existente para conservar filas de otras encuestas de curaduría.
    const lastCol = colLetter(CURATION_RANKING_HEADER.length);
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${CURATION_RANKING_TAB}!A2:${lastCol}100000`,
    });
    const existing = res.data.values || [];
    const others = existing.filter((r) => r[2] !== surveyId); // columna Encuesta_ID
    const merged = [...others, ...rows];

    await client.spreadsheets.values.clear({
      spreadsheetId,
      range: `${CURATION_RANKING_TAB}!A2:${lastCol}100000`,
    });
    if (merged.length > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
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
  const spreadsheetId = brandSheetId();
  if (!spreadsheetId) return { ok: false, error: "Falta configurar la hoja de Google de esta marca." };
  try {
    await ensureTabExists(client, spreadsheetId, PURCHASE_ORDERS_TAB);
    await ensureHeaderFor(client, spreadsheetId, PURCHASE_ORDERS_TAB, PURCHASE_ORDERS_HEADER);
    const lastCol = colLetter(PURCHASE_ORDERS_HEADER.length);
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${PURCHASE_ORDERS_TAB}!A2:${lastCol}100000`,
    });
    const existing = res.data.values || [];
    const others = existing.filter((r) => r[0] !== orderId); // columna Pedido_ID
    const merged = [...others, ...rows];

    await client.spreadsheets.values.clear({
      spreadsheetId,
      range: `${PURCHASE_ORDERS_TAB}!A2:${lastCol}100000`,
    });
    if (merged.length > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
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

// Reescribe por completo la pestaña de SKUs aprobados: a diferencia de
// Pedidos (que comparte una pestaña entre varios pedidos, identificados por
// Pedido_ID), acá hay UNA sola galería por marca — así que cada
// sincronización simplemente reemplaza todas las filas por el estado actual
// de las variantes aprobadas (no hace falta mergear por id).
export async function writeSkuGallerySheet(rows) {
  const client = await getClient();
  if (!client) return { ok: false, error: initError };
  const spreadsheetId = brandSheetId();
  if (!spreadsheetId) return { ok: false, error: "Falta configurar la hoja de Google de esta marca." };
  try {
    await ensureTabExists(client, spreadsheetId, SKU_GALLERY_TAB);
    await ensureHeaderFor(client, spreadsheetId, SKU_GALLERY_TAB, SKU_GALLERY_HEADER);
    const lastCol = colLetter(SKU_GALLERY_HEADER.length);
    await client.spreadsheets.values.clear({
      spreadsheetId,
      range: `${SKU_GALLERY_TAB}!A2:${lastCol}100000`,
    });
    if (rows.length > 0) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `${SKU_GALLERY_TAB}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
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
  const spreadsheetId = brandSheetId();
  if (!spreadsheetId) return { ok: false, error: "Falta configurar la hoja de Google de esta marca." };
  try {
    await ensureTabExists(client, spreadsheetId, tab);
    await ensureHeaderFor(client, spreadsheetId, tab, headerRow);
    const lastCol = colLetter(headerRow.length);
    await client.spreadsheets.values.append({
      spreadsheetId,
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
  const spreadsheetId = brandSheetId();
  if (!spreadsheetId) return { ok: false, error: "Falta configurar la hoja de Google de esta marca.", foundInSheet: false };
  try {
    const idCol = colLetter(idColIndex + 1);
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!${idCol}2:${idCol}100000`,
    });
    const values = res.data.values || [];
    const rowOffset = values.findIndex((row) => row[0] === idValue);
    if (rowOffset === -1) {
      return { ok: true, foundInSheet: false };
    }
    const sheetId = await getTabSheetId(client, spreadsheetId, tab);
    if (sheetId === null) return { ok: true, foundInSheet: false };
    // +1 porque el rango empezó en la fila 2 (índice 1, 0-based), +1 porque
    // deleteDimension usa índices 0-based de fila (fila 2 real = índice 1).
    const rowIndex = rowOffset + 1;
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }],
      },
    });
    return { ok: true, foundInSheet: true };
  } catch (err) {
    return { ok: false, error: err.message, foundInSheet: false };
  }
}

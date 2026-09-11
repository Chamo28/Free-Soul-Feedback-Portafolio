// Sube las fotos de la Galería Privada de SKUs a Google Drive — la marca
// mandataria fue explícita: NO se guarda ninguna foto en el disco de
// Render, solo el link de Drive (ver jsonStore.js `skuGalleryVariants`).
//
// Reutiliza la MISMA service account que ya usa Sheets (googleAuth.js), con
// un scope distinto (drive.file — solo puede tocar los archivos que ella
// misma crea, no el resto del Drive). Sube dentro de una carpeta por marca
// (GOOGLE_DRIVE_FOLDER_ID / ALAS_GOOGLE_DRIVE_FOLDER_ID) que el DUEÑO de esa
// carpeta debe compartir de antemano con el email de la service account
// (Editor) — una service account "pelada" no tiene cuota de almacenamiento
// propia, así que sin ese paso manual la subida falla con un error claro
// (ver isDriveConfigured/uploadImageToDrive más abajo).

import { Readable } from "stream";
import { google } from "googleapis";
import { currentBrand } from "../brandContext.js";
import { hasCredentials, getGoogleAuthClient } from "./googleAuth.js";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

let driveClient = null;
let initError = null;

// Acepta tanto el ID pelado como el link completo que copia/pega cualquiera
// desde la barra del navegador (ej. "https://drive.google.com/drive/
// folders/1ze8-...") — sin esto, pegar el link tal cual da "File not
// found" en Drive (la API espera solo el ID, no la URL).
function brandDriveFolderId() {
  const raw = (process.env[currentBrand().driveFolderIdEnv] || "").trim();
  const match = raw.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : raw;
}

export function isDriveConfigured() {
  return hasCredentials() && Boolean(brandDriveFolderId());
}

export function driveConfigError() {
  if (!hasCredentials()) return "Faltan las credenciales del service account de Google.";
  if (!brandDriveFolderId()) {
    return `Falta configurar ${currentBrand().driveFolderIdEnv} (el ID de la carpeta de Drive de esta marca) en las variables de entorno.`;
  }
  return null;
}

async function getClient() {
  if (driveClient) return driveClient;
  if (!hasCredentials()) {
    initError = "Google Drive no está configurado (faltan las credenciales del service account).";
    return null;
  }
  try {
    const authClient = await getGoogleAuthClient(SCOPES);
    driveClient = google.drive({ version: "v3", auth: authClient });
    initError = null;
    return driveClient;
  } catch (err) {
    initError = err.message;
    driveClient = null;
    return null;
  }
}

// Sube UNA imagen (buffer en memoria, nunca tocó disco) a la carpeta de
// Drive de la marca activa, la hace pública ("cualquiera con el link, solo
// lectura" — necesario para que la miniatura cargue en el navegador de
// cualquier socio sin tener que iniciar sesión en esa cuenta de Google) y
// devuelve su URL directa de contenido.
export async function uploadImageToDrive(buffer, filename, mimeType) {
  const folderId = brandDriveFolderId();
  if (!folderId) {
    return { ok: false, error: driveConfigError() };
  }
  const client = await getClient();
  if (!client) return { ok: false, error: initError };

  try {
    const created = await client.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: mimeType || "image/jpeg", body: Readable.from(buffer) },
      fields: "id",
    });
    const fileId = created.data.id;

    await client.permissions.create({
      fileId,
      requestBody: { type: "anyone", role: "reader" },
    });

    const meta = await client.files.get({
      fileId,
      fields: "id, webContentLink, thumbnailLink",
    });

    return {
      ok: true,
      fileId,
      // webContentLink sirve el archivo directo (ideal para el zoom a full
      // tamaño); es la misma URL que se guarda como `driveUrl` de la
      // variante — se usa tanto para la miniatura chica como para el zoom.
      driveUrl: meta.data.webContentLink || meta.data.thumbnailLink || "",
    };
  } catch (err) {
    // El error más común acá: la carpeta no fue compartida con el email de
    // la service account (o no existe ese ID) — googleapis ya trae un
    // mensaje bastante claro ("File not found" / "insufficient permissions").
    return { ok: false, error: err.message };
  }
}

// Borrado best-effort: si falla (permiso, ya no existe, Drive no
// configurado), no se propaga como error — el registro local de todos
// modos se borra, igual que ya pasa con archivos locales en curation.js.
export async function deleteDriveFile(fileId) {
  if (!fileId) return;
  try {
    const client = await getClient();
    if (!client) return;
    await client.files.delete({ fileId });
  } catch {
    // best-effort — ver comentario arriba.
  }
}

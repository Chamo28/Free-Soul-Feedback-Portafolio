import path from "path";
import fs from "fs";
import { google } from "googleapis";

// Credenciales del service account de Google — hoy solo las usa sheets.js,
// pero se extrajo a su propio módulo (antes vivía duplicado ahí adentro)
// para que cualquier otro servicio de Google que se agregue a futuro pueda
// reusarlo sin repetir el parseo. Las fotos de la Galería Privada de SKUs
// NO usan esto — terminaron en Cloudinary, no en Google Drive (ver
// services/cloudinary.js para el porqué).
const CREDENTIALS_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
const CREDENTIALS_BASE64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || "";

export function hasCredentials() {
  if (CREDENTIALS_BASE64) return true;
  return Boolean(CREDENTIALS_PATH && fs.existsSync(path.resolve(CREDENTIALS_PATH)));
}

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

// Devuelve un cliente autenticado (google-auth-library) con los scopes
// pedidos, o null si no hay credenciales configuradas. Cada servicio arma
// su propio cliente de API (ej. google.sheets(...)) a partir de esto.
export async function getGoogleAuthClient(scopes) {
  if (!CREDENTIALS_BASE64 && !CREDENTIALS_PATH) return null;
  const credentialsObject = loadCredentialsObject();
  const authOptions = credentialsObject
    ? { credentials: credentialsObject, scopes }
    : { keyFile: path.resolve(CREDENTIALS_PATH), scopes };
  const auth = new google.auth.GoogleAuth(authOptions);
  return auth.getClient();
}

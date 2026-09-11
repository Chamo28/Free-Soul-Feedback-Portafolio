import path from "path";
import fs from "fs";
import { google } from "googleapis";

// Credenciales del service account de Google, compartidas entre TODOS los
// servicios de Google que usa la app (Sheets, Drive...) — es la misma
// cuenta, lo único que cambia por servicio son los `scopes` pedidos y por
// marca a qué recurso apuntan (spreadsheet ID, carpeta de Drive...). Antes
// esto vivía duplicado dentro de sheets.js; se extrajo acá para que
// drive.js (Galería Privada de SKUs) lo reuse sin repetir el parseo.
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
// pedidos, o null si no hay credenciales configuradas. Cada servicio
// (sheets.js, drive.js) arma su propio cliente de API (google.sheets(...),
// google.drive(...)) a partir de esto — los scopes son distintos por API.
export async function getGoogleAuthClient(scopes) {
  if (!CREDENTIALS_BASE64 && !CREDENTIALS_PATH) return null;
  const credentialsObject = loadCredentialsObject();
  const authOptions = credentialsObject
    ? { credentials: credentialsObject, scopes }
    : { keyFile: path.resolve(CREDENTIALS_PATH), scopes };
  const auth = new google.auth.GoogleAuth(authOptions);
  return auth.getClient();
}

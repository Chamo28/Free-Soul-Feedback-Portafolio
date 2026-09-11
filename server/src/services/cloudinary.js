// Sube las fotos de la Galería Privada de SKUs a Cloudinary — la marca
// mandataria sigue siendo la misma: NO se guarda ninguna foto en el disco
// de Render, solo su URL pública (ver jsonStore.js `skuGalleryVariants`).
//
// Se intentó primero con Google Drive + la service account que ya usa
// Sheets, pero Google bloquea esa combinación en cuentas personales
// ("Service Accounts do not have storage quota" — requiere Shared Drives o
// delegación de dominio, ambas exclusivas de Google Workspace de pago).
// Cloudinary resuelve lo mismo gratis con una sola credencial (sin el
// vaivén de compartir carpetas ni habilitar APIs), así que se cambió el
// proveedor de imágenes SOLO para este módulo — Sheets sigue usando Google
// (googleAuth.js) sin ningún cambio.
//
// Configuración (una sola, no por marca — la separación por marca se hace
// por carpeta, no por cuenta): una variable CLOUDINARY_URL en Render, con
// el formato "cloudinary://<api_key>:<api_secret>@<cloud_name>" que se ve
// tal cual en el dashboard de Cloudinary — el SDK la lee sola de
// process.env, no hace falta parsearla a mano.

import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { currentBrand } from "../brandContext.js";

// El SDK lee CLOUDINARY_URL solo automáticamente; si en cambio se usaron
// las 3 variables sueltas, hay que pasarlas explícito.
if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

export function cloudinaryConfigError() {
  if (!isCloudinaryConfigured()) {
    return "Falta configurar Cloudinary en el backend (variable CLOUDINARY_URL, ver el dashboard de cloudinary.com).";
  }
  return null;
}

// Carpeta por marca dentro de la MISMA cuenta de Cloudinary — así se ven
// separadas en el dashboard sin necesitar credenciales distintas por marca.
function brandFolder() {
  return `sku-gallery/${currentBrand().id}`;
}

export async function uploadImageToCloudinary(buffer, filename) {
  if (!isCloudinaryConfigured()) {
    return { ok: false, error: cloudinaryConfigError() };
  }
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: brandFolder(), filename_override: filename, resource_type: "image" },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      Readable.from(buffer).pipe(stream);
    });
    return { ok: true, publicId: result.public_id, photoUrl: result.secure_url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Borrado best-effort: si falla (ya no existe, Cloudinary no configurado),
// no se propaga como error — el registro local de todos modos se borra.
// `invalidate: true` pide que también se purgue la copia en el CDN, no
// solo el archivo origen — sin esto, la URL puede seguir respondiendo 200
// desde caché por un rato aunque el archivo ya esté borrado en Cloudinary.
export async function deleteImageFromCloudinary(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch {
    // best-effort — ver comentario arriba.
  }
}

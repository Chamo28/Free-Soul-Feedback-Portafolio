import sharp from "sharp";
import fs from "fs";

const TIMEOUT_MS = 15000;
const CONCURRENCY = 5;

// Muchos sitios de proveedores (1688/Alibaba) bloquean descargas que no
// parezcan venir de un navegador real (revisan el header User-Agent/Referer).
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

async function downloadOne(url, destPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // sharp valida que sea una imagen real al intentar procesarla; si no lo
    // es (ej. una página de error HTML disfrazada de 200), esto falla solo.
    await sharp(buffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(destPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "Tiempo de espera agotado" : err.message };
  } finally {
    clearTimeout(timeout);
  }
}

// Descarga una lista de URLs hacia destDir (nombradas item-1.jpg, item-2.jpg...
// en el orden dado), con concurrencia limitada. Una imagen fallida no detiene
// las demás — se reporta cuál falló y por qué, y el resto sigue su curso.
export async function downloadImages(urls, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const results = new Array(urls.length);

  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const index = cursor++;
      const url = urls[index];
      const filename = `img-${index + 1}.jpg`;
      const destPath = `${destDir}/${filename}`;
      const result = await downloadOne(url, destPath);
      results[index] = result.ok
        ? { ok: true, url, filename }
        : { ok: false, url, error: result.error };
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

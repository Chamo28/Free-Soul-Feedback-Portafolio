// Comprime una foto en el propio navegador ANTES de subirla, para que el
// admin (frecuentemente subiendo fotos de proveedores como 1688 desde el
// celular) no tenga que esperar a que suba un archivo pesado en una red 4G.
// El servidor igual vuelve a comprimir con sharp al guardar, esto es una
// primera pasada para acelerar la subida.

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_MAX_BYTES = 200 * 1024; // ~200KB
const MIN_QUALITY = 0.4;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function fitDimensions(width, height, maxDimension) {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const scale = maxDimension / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function toJpgName(name) {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

// Devuelve un nuevo File (JPEG) comprimido; si algo falla, devuelve el original
// para no bloquear la subida por un problema de compresión en el navegador.
export async function compressImageFile(file, options = {}) {
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;

  if (!file.type.startsWith("image/")) return file;

  try {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, maxDimension);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.82;
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob && blob.size > maxBytes && quality > MIN_QUALITY) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }

    if (!blob) return file;
    return new File([blob], toJpgName(file.name), { type: "image/jpeg" });
  } catch {
    return file; // si falla la compresión en el navegador, sube el original
  }
}

export async function compressImageFiles(files, options = {}) {
  return Promise.all(files.map((f) => compressImageFile(f, options)));
}

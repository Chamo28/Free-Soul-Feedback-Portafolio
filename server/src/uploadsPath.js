import path from "path";
import { currentBrand } from "./brandContext.js";

// Free Soul (uploadsSubdir: "") sigue escribiendo/sirviendo exactamente en
// las mismas rutas de siempre — no hay riesgo de romper fotos ya guardadas
// o URLs ya sincronizadas a Sheets. Cualquier marca nueva con uploadsSubdir
// definido cae en su propia carpeta, para no mezclar archivos entre marcas.

// Para armar la ruta en disco: path.join ignora los segmentos "" solos.
export function brandUploadsDir(uploadsRoot, ...segments) {
  return path.join(uploadsRoot, currentBrand().uploadsSubdir, ...segments);
}

// Para armar la URL pública (/uploads/...) que se guarda en el producto/item.
export function brandUploadsUrlPrefix() {
  const sub = currentBrand().uploadsSubdir;
  return sub ? `${sub}/` : "";
}

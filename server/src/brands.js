// Registro central de marcas — "mismo código, config de marca": este archivo
// es la única fuente de verdad de qué variables de entorno y qué archivo de
// datos usa cada marca. Agregar una marca nueva es agregar una entrada aquí
// (+ sus variables de entorno en Render) — nada más del backend cambia.
//
// La marca "freesoul" mantiene EXACTAMENTE los mismos nombres de variables
// de entorno y el mismo archivo de datos (db.json) que ya existían antes de
// que existiera este archivo — cero riesgo de romper producción.

export const BRANDS = {
  freesoul: {
    id: "freesoul",
    name: "Free Soul DNA",
    tagline: "Panel de Feedback",
    dataFile: "db.json",
    uploadsSubdir: "", // raíz de /uploads, como siempre — no mueve fotos ya guardadas
    sheetIdEnv: "GOOGLE_SHEET_ID",
    sheetTabEnv: "GOOGLE_SHEET_TAB",
    adminPasswordEnv: "ADMIN_PASSWORD",
  },
  "alas-de-amara": {
    id: "alas-de-amara",
    name: "Alas de Amara",
    tagline: "Vuela a tu manera",
    dataFile: "db.alas-de-amara.json",
    uploadsSubdir: "alas-de-amara",
    sheetIdEnv: "ALAS_GOOGLE_SHEET_ID",
    sheetTabEnv: "ALAS_GOOGLE_SHEET_TAB",
    adminPasswordEnv: "ALAS_ADMIN_PASSWORD",
  },
};

export const DEFAULT_BRAND_ID = "freesoul";

export function resolveBrand(id) {
  return BRANDS[id] || BRANDS[DEFAULT_BRAND_ID];
}

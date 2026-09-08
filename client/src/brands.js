// Registro central de marcas del frontend — "mismo código, config de marca".
// Espejo de server/src/brands.js (mismos ids). Cada marca define:
//   - id: debe coincidir con el id del backend (se manda como X-Brand-Id).
//   - pathPrefix: "" para la marca por defecto (Free Soul, sin prefijo — no
//     rompe ningún link ya compartido con evaluadores); otras marcas viven
//     bajo su propio prefijo (ej. /alas) MIENTRAS comparten dominio con
//     Free Soul. El día que se despliegue por separado con su propio
//     dominio, basta con fijar VITE_BRAND=alas-de-amara al buildear — ver
//     resolveBrandFromLocation() abajo — y pathPrefix deja de usarse.
//   - name/tagline: textos de marca (header, login, footer del evaluador).
//   - logo/favicon: rutas a los assets (en client/public/brands/<id>/).
//   - colors: valores que sobreescriben las variables CSS --brand-*/--sand-*
//     definidas en index.css (de ahí toman su color TODAS las clases
//     Tailwind bg-brand-600, text-brand-700, etc. ya usadas en toda la app).

export const BRANDS = {
  freesoul: {
    id: "freesoul",
    pathPrefix: "",
    name: "Free Soul DNA",
    tagline: "Panel de Feedback",
    loginSubtitle: "Feedback de productos",
    operationsTagline: "Operations Suite",
    footerTagline: "Woven into your DNA",
    logo: "/icon-512.png",
    favicon: "/favicon-32.png",
    colors: {
      "--brand-50": "#f1f7fb",
      "--brand-100": "#d2ecf9",
      "--brand-200": "#a7d4ec",
      "--brand-500": "#4c6d94",
      "--brand-600": "#2d4568",
      "--brand-700": "#1d2a43",
      "--brand-900": "#141d30",
      "--sand-50": "#faf7f5",
      "--sand-100": "#f3ece7",
      "--sand-300": "#e3d3c8",
      "--sand-500": "#d4c5b9",
      "--sand-600": "#b9a690",
      "--sand-700": "#93816c",
      "--sand-800": "#6b5a48",
    },
  },
  "alas-de-amara": {
    id: "alas-de-amara",
    pathPrefix: "/alas",
    name: "Alas de Amara",
    tagline: "Panel de administración",
    loginSubtitle: "Curaduría y pedidos",
    operationsTagline: "Vuela a tu manera",
    footerTagline: "Vuela a tu manera",
    // Placeholder (monograma "AA" sobre coral) hasta que llegue el archivo
    // real del logo — mándalo como adjunto (PNG transparente o SVG) y se
    // reemplaza este archivo sin tocar nada más.
    logo: "/brands/alas-de-amara/icon.svg",
    favicon: "/brands/alas-de-amara/favicon.svg",
    colors: {
      // Paleta coral/salmón leída del logo compartido — son valores
      // aproximados, fáciles de afinar apenas haya guía de marca exacta.
      "--brand-50": "#fdf3f2",
      "--brand-100": "#fbe2df",
      "--brand-200": "#f4bab4",
      "--brand-500": "#ea8681",
      "--brand-600": "#e27670",
      "--brand-700": "#c85f59",
      "--brand-900": "#7d3a36",
      "--sand-50": "#fffaf5",
      "--sand-100": "#fdeee1",
      "--sand-300": "#f6d2b3",
      "--sand-500": "#eab588",
      "--sand-600": "#d99c68",
      "--sand-700": "#b17b4f",
      "--sand-800": "#7d5638",
    },
  },
};

export const DEFAULT_BRAND_ID = "freesoul";

export function resolveBrandFromLocation() {
  // Prioridad 1: forzado al buildear (despliegue separado a futuro, ver
  // README de despliegue) — con esto, pathPrefix deja de importar del todo.
  const forced = import.meta.env.VITE_BRAND;
  if (forced && BRANDS[forced]) return BRANDS[forced];

  // Prioridad 2: mismo dominio, varias marcas por prefijo de ruta — es el
  // modo actual mientras Alas de Amara no tiene despliegue propio.
  const path = window.location.pathname;
  for (const brand of Object.values(BRANDS)) {
    if (brand.pathPrefix && (path === brand.pathPrefix || path.startsWith(brand.pathPrefix + "/"))) {
      return brand;
    }
  }
  return BRANDS[DEFAULT_BRAND_ID];
}

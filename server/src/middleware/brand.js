import { resolveBrand } from "../brands.js";
import { brandContext } from "../brandContext.js";

// El frontend manda qué marca es en el header X-Brand-Id (ver client/src/api.js).
// Sin ese header (o con un id desconocido), se asume "freesoul" — así
// cualquier cliente viejo o herramienta externa que pegue directo a la API
// sigue funcionando exactamente como antes de que existieran las marcas.
export function withBrand(req, res, next) {
  const brand = resolveBrand(req.headers["x-brand-id"]);
  req.brand = brand;
  brandContext.run(brand, () => next());
}

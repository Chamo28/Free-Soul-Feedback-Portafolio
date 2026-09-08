// Contexto de marca por-request, vía AsyncLocalStorage: el middleware de
// abajo (server/src/middleware/brand.js) fija la marca al empezar cada
// request, y jsonStore.js / sheets.js la leen internamente con
// currentBrand() — así ninguna ruta ni ninguna llamada existente a esas
// funciones necesita cambiar de firma para volverse "consciente de marca".
import { AsyncLocalStorage } from "async_hooks";
import { BRANDS, DEFAULT_BRAND_ID } from "./brands.js";

export const brandContext = new AsyncLocalStorage();

export function currentBrand() {
  return brandContext.getStore() || BRANDS[DEFAULT_BRAND_ID];
}

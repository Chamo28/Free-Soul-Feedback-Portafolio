import { createContext, useContext, useEffect } from "react";
import { resolveBrandFromLocation } from "./brands.js";

const BrandContext = createContext(null);

// Se resuelve UNA vez al cargar el módulo (antes del primer render) — el
// mismo valor sirve para toda la sesión de la pestaña: cambiar de marca
// significa navegar a otra URL (otro prefijo o, a futuro, otro dominio),
// nunca cambiar en caliente dentro de la misma pantalla.
const activeBrand = resolveBrandFromLocation();

export function getActiveBrand() {
  return activeBrand;
}

export function BrandProvider({ children }) {
  useEffect(() => {
    // Variables CSS: de acá toman su color todas las clases Tailwind
    // bg-brand-*, text-brand-*, bg-sand-*, etc. ya usadas en toda la app —
    // así rebrandear es cambiar estos valores, no tocar componentes.
    const root = document.documentElement;
    for (const [key, value] of Object.entries(activeBrand.colors)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute("data-brand", activeBrand.id);

    document.title = `${activeBrand.name} · ${activeBrand.tagline}`;

    // El index.html trae dos <link rel="icon"> (32x32 y 16x16) — se
    // actualizan los dos para no dejar un tamaño con el favicon viejo.
    const iconLinks = document.querySelectorAll('link[rel="icon"]');
    if (iconLinks.length > 0) {
      iconLinks.forEach((link) => {
        link.href = activeBrand.favicon;
        link.removeAttribute("type"); // el placeholder es .svg; el original apuntaba a .png
      });
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = activeBrand.favicon;
      document.head.appendChild(link);
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.content = activeBrand.colors["--brand-700"];
  }, []);

  return <BrandContext.Provider value={activeBrand}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext) || activeBrand;
}

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { BrandProvider, getActiveBrand } from "./BrandContext.jsx";
import "./index.css";

// El prefijo de ruta de la marca activa (ej. "/alas") se usa como basename
// del router — así TODAS las rutas de App.jsx (/admin, /survey/:id, etc.)
// funcionan sin cambios para cualquier marca; React Router se encarga de
// anteponer/quitar el prefijo. Free Soul (pathPrefix: "") sigue en la raíz,
// exactamente como siempre.
const basename = getActiveBrand().pathPrefix || undefined;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <BrandProvider>
        <App />
      </BrandProvider>
    </BrowserRouter>
  </React.StrictMode>
);

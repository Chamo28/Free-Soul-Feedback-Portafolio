import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import productsRoutes from "./routes/products.js";
import responsesRoutes from "./routes/responses.js";
import syncRoutes from "./routes/sync.js";
import curationRoutes from "./routes/curation.js";
import purchaseOrdersRoutes from "./routes/purchaseOrders.js";
import skuGalleryRoutes from "./routes/skuGallery.js";
import { getStatus } from "./services/sheets.js";
import { withBrand } from "./middleware/brand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// En producción, CORS_ORIGIN debe ser el dominio del frontend (Vercel o tu
// dominio propio), separado por comas si hay más de uno. Sin esa variable,
// se permite cualquier origen (cómodo para desarrollo, pero configúrala en
// Render antes de ir a producción).
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin) {
  const allowedOrigins = corsOrigin.split(",").map((o) => o.trim());
  app.use(cors({ origin: allowedOrigins }));
} else {
  console.warn("⚠️  CORS_ORIGIN no configurado: se está permitiendo cualquier origen. Configúralo en producción.");
  app.use(cors());
}

app.use(express.json({ limit: "2mb" }));

// Fija la marca activa del request (por header X-Brand-Id, ver
// client/src/api.js) ANTES de cualquier ruta — jsonStore.js y sheets.js la
// leen internamente, así que todo lo de abajo ya queda "consciente de marca"
// sin tener que tocar cada handler.
app.use(withBrand);

const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsDir));

// Usado por Render (health check) y por un cron externo (ver README) para
// mantener el servicio despierto y evitar el "cold start" del plan gratuito.
app.get("/api/health", (req, res) => {
  res.json({ ok: true, brand: req.brand.id, sheets: getStatus(), uptime: process.uptime() });
});

app.use("/api/admin", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/responses", responsesRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/curation", curationRoutes);
app.use("/api/purchase-orders", purchaseOrdersRoutes);
app.use("/api/sku-gallery", skuGalleryRoutes);

// Manejador de errores global: sin esto, un error de Multer (ej. subir más
// archivos o más peso del límite configurado en curation.js/products.js/
// skuGallery.js) no lo agarra ninguna ruta — Express cae a su handler por
// defecto, que en producción puede devolver HTML en vez de JSON o cortar la
// conexión sin avisar, y el frontend queda pegado en "Subiendo..." sin
// ningún error visible. Siempre va AL FINAL, después de montar las rutas.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: "Una de las fotos pesa más de lo permitido.",
      LIMIT_FILE_COUNT: "Estás subiendo más fotos de las permitidas en un solo lote — sube en tandas más chicas.",
      LIMIT_UNEXPECTED_FILE: "Estás subiendo más fotos de las permitidas en un solo lote — sube en tandas más chicas.",
    };
    return res.status(400).json({ error: messages[err.code] || `Error subiendo el archivo: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor: " + err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const sheetsStatus = getStatus();
  console.log(`FreeSoul Feedback API corriendo en http://localhost:${PORT}`);
  console.log(
    sheetsStatus.configured
      ? "✅ Google Sheets configurado."
      : "⚠️  Google Sheets NO configurado todavía — las respuestas se guardan localmente. Ver README."
  );
});

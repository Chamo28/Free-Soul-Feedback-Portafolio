import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import productsRoutes from "./routes/products.js";
import responsesRoutes from "./routes/responses.js";
import syncRoutes from "./routes/sync.js";
import curationRoutes from "./routes/curation.js";
import purchaseOrdersRoutes from "./routes/purchaseOrders.js";
import { getStatus } from "./services/sheets.js";

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
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsDir));

// Usado por Render (health check) y por un cron externo (ver README) para
// mantener el servicio despierto y evitar el "cold start" del plan gratuito.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, sheets: getStatus(), uptime: process.uptime() });
});

app.use("/api/admin", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/responses", responsesRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/curation", curationRoutes);
app.use("/api/purchase-orders", purchaseOrdersRoutes);

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

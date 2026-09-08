import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Dos entradas HTML, mismo bundle de la app (src/main.jsx) — solo
      // cambia el shell estático (title/favicon/OG) que ve un link preview
      // (WhatsApp, etc.) antes de que corra el JS. Ver comentarios en
      // index.html / alas.html y el rewrite correspondiente en vercel.json.
      input: {
        main: resolve(__dirname, "index.html"),
        alas: resolve(__dirname, "alas.html"),
      },
    },
  },
  server: {
    port: 5173,
    // Permite acceder vía el túnel público (trycloudflare.com) además de localhost.
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
    },
  },
});

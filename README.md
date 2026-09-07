# Free Soul DNA · Plataforma de Operaciones

Ecosistema web interno de Free Soul DNA (marca de importación D2C/B2B de ropa, calzado y accesorios). Arquitectura: **Frontend en Vercel, Backend en Render, persistencia en Google Sheets** (con respaldo local si Sheets falla).

Módulos:

1. **Encuestas y Curaduría de Portafolio** — validar nuevas líneas de producto con evaluadores reales antes de importarlas.
2. **Gestión de Pedidos y Sourcing** — construir y liquidar órdenes de compra a partir de links de 1688/Alibaba.
3. Portal B2B de mayoristas/distribuidores — planeado.
4. Dashboard operativo y de rentabilidad — planeado.

## Estructura

```
freesoul-feedback/
├── server/   → API Node/Express (productos, encuestas, pedidos, Google Sheets)
└── client/   → App React + Tailwind (mobile-first)
```

## Módulo 1: Encuestas y Curaduría de Portafolio

El Admin puede crear dos tipos de dinámica, cada una con su propio link de evaluador:

1. **Encuesta Detallada**: sube fotos de 1 producto → el evaluador califica 5 criterios (Atractivo, Calidad, Precio, ¿Lo comprarías?, Comentarios).
2. **Curaduría de Portafolio (Top-K)**: sube un conjunto de productos (ej. 15 fotos) → el evaluador elige exactamente (o hasta) N favoritos en una grilla, marca cuál es su favorito #1 y comenta por qué descartó el resto. Ideal para descartar modelos rápido antes de profundizar con la encuesta detallada.

- **Resultados** (`/admin/results`): tiene una pestaña por cada tipo de dinámica.
  - Detallada: rankings por producto/categoría con promedio, % compraría, comentarios y una recomendación automática (Adelante / Renegociar / Descartar).
  - Curaduría: ranking por % de tasa de selección, etiqueta automática (Top 10 = "Aprobado para importación", últimos 5 = "Sugerido descartar") y el producto elegido más veces como favorito #1.
- Las respuestas se guardan **siempre localmente** primero (nunca se pierden) y se intentan enviar a Google Sheets en el momento; si Sheets falla o no está configurado, quedan pendientes y se pueden reenviar con un botón "Sincronizar" en el dashboard.

## 1. Instalar

```bash
npm run install:all
```

## 2. Configurar variables de entorno del servidor

Copia el archivo de ejemplo:

```bash
cp server/.env.example server/.env
```

Abre `server/.env` y define al menos:

```
ADMIN_PASSWORD=tu-clave-para-entrar-al-panel
JWT_SECRET=una-cadena-larga-y-aleatoria
```

Con esto la app ya funciona completo (guardando localmente). Google Sheets es opcional y se puede activar después sin tocar código.

## 3. Correr en desarrollo

```bash
npm run dev
```

- Backend: http://localhost:4000
- Frontend: http://localhost:5173 (ábrelo en el navegador)

Entra con la contraseña que pusiste en `ADMIN_PASSWORD`.

## 4. Configurar Google Sheets (cuando quieras activarlo)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto (o usa uno existente).
2. Habilita la **Google Sheets API** (menú "APIs y servicios" → "Habilitar APIs y servicios" → busca "Google Sheets API" → Habilitar).
3. Crea una **Service Account**: "APIs y servicios" → "Credenciales" → "Crear credenciales" → "Cuenta de servicio". Ponle un nombre (ej. `freesoul-feedback`) y termina el asistente.
4. Entra a la Service Account creada → pestaña "Claves" → "Agregar clave" → "Crear clave nueva" → tipo **JSON**. Se descarga un archivo `.json`.
5. Copia ese archivo a `server/credentials/service-account.json` (esa carpeta ya existe y está en `.gitignore`, no se sube a git).
6. Crea un Google Sheet nuevo (o usa uno existente) para recibir las respuestas.
7. Abre el archivo JSON descargado y copia el valor de `"client_email"` (algo como `freesoul-feedback@tu-proyecto.iam.gserviceaccount.com`).
8. En tu Google Sheet, dale click a "Compartir" y comparte la hoja con ese email como **Editor**.
9. Copia el ID del Sheet: es la parte de la URL entre `/d/` y `/edit`:
   `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`
10. En `server/.env` completa:

```
GOOGLE_SERVICE_ACCOUNT_JSON=./credentials/service-account.json
GOOGLE_SHEET_ID=ESTE_ES_EL_ID
GOOGLE_SHEET_TAB=Respuestas
```

11. Crea una pestaña (hoja) dentro del Sheet llamada exactamente `Respuestas` (o el nombre que pusiste en `GOOGLE_SHEET_TAB`).
12. Reinicia el servidor (`npm run dev`). En la consola debe aparecer `✅ Google Sheets configurado.`

A partir de ahí, cada respuesta nueva se agrega automáticamente como fila con las columnas:

`Evaluador | Fecha | Categoria | Producto | Atractivo | Calidad | Precio | Compraria | Comentarios | Encuesta_ID`

Las respuestas de **Curaduría de Portafolio** se guardan en dos pestañas adicionales (se crean solas la primera vez que hay una respuesta):

- `Curaduria_Respuestas` — una fila por evaluador: `Evaluador_ID | Fecha | Encuesta_ID | Categoria | Productos_Seleccionados | Favorito_Top1 | Comentarios`
- `Curaduria_Ranking` — se reescribe completa con los totales actualizados: `Producto_ID | Producto | Encuesta_ID | Votos_Recibidos | %_Tasa_Seleccion | Etiqueta`

Si en algún momento Sheets falla (caída, permisos, cuota), las respuestas se siguen guardando localmente y puedes forzar el reenvío con el botón **"Sincronizar con Sheets"** en `/admin/results`.

## 5. Agregar nuevas categorías

No requiere tocar código: al crear un producto, elige **"+ Nueva categoría..."** en el formulario y escribe el nombre (ej. "Camisetas", "Bolsos"). Los criterios de evaluación son los mismos para todas las categorías, así que el dashboard de rankings las compara de forma consistente. Puedes filtrar los resultados por categoría en `/admin/results`.

## 6. Criterios de evaluación (fijos para todas las categorías)

| Criterio | Pregunta | Escala |
|---|---|---|
| Atractivo Visual | ¿Qué tan atractivo es el diseño? | 1-5 |
| Calidad Percibida | ¿Sientes que la calidad es buena? | 1-5 |
| Precio Justo | ¿El precio es justo para lo que ves? | 1-5 |
| Intención de Compra | ¿Lo comprarías? | Sí/No |
| Comentarios | ¿Qué cambiarías o qué te gusta? | Texto libre |

## 7. Reglas de recomendación automática

- **Adelante**: promedio ≥ 4 y % compraría ≥ 70%.
- **Descartar**: promedio < 2.5 o % compraría < 30%.
- **Renegociar**: cualquier otro caso intermedio.

Puedes ajustar estos umbrales en [server/src/services/scoring.js](server/src/services/scoring.js).

## Módulo 2: Gestión de Pedidos y Sourcing (`/admin/pedidos`)

Herramienta para construir órdenes de compra a partir de links de proveedor (1688/Alibaba) y calcular el costo puesto en Colombia mientras se digitan cantidades y costos.

**Flujo:**

1. Crea un pedido con un nombre (ej. "Bolsos Octubre 2026").
2. Importa un archivo CSV o TXT (o pégalo directo) con las columnas `URL_Producto, URL_Imagen, Referencia` — **una fila por imagen**; si un producto tiene varias fotos, repite la misma URL de producto en varias filas y la app las agrupa sola. Acepta con o sin encabezado.
3. Al importar, la app **descarga y comprime cada foto en su propio servidor** (no depende de que el link de 1688 siga vivo ni de que ese sitio permita mostrarla desde otra página). Si una foto puntual falla al descargar, no bloquea el resto del pedido — queda como advertencia y el producto se sube igual sin esa imagen.
4. En la grilla, digita por producto: Categoría, Género, Costo Unitario (en RMB), Cantidad por Empaque y Cantidad de Empaques. La app calcula en vivo:
   - `Cantidad Total = Cantidad por Empaque × Cantidad de Empaques`
   - `Costo Unitario USD = Costo Unitario RMB × Tasa RMB→USD` (la tasa se configura por pedido, en "⚙️ Tasas de conversión y flete")
   - `Precio Total FOB (USD) = Costo Unitario USD × Cantidad Total`
   - `Flete Total (COP) = Flete por unidad (según categoría, o el valor manual que pongas en esa fila) × Cantidad Total`
   - `Costo Landed Total (COP) = Precio Total FOB × TRM (USD→COP) + Flete Total`
5. El resumen superior consolida Total Productos, Unidades, Cajas, Inversión FOB y Costo Landed estimado.
6. **Descargar CSV** genera un archivo listo para enviar al proveedor/agente de carga. **Exportar/Imprimir** abre el diálogo de impresión del navegador (elige "Guardar como PDF") con una vista limpia de fotos grandes.
7. **Sincronizar con Sheets** guarda el pedido consolidado en la pestaña `Gestion_Pedidos` de tu Google Sheet (una fila por producto). Vuelve a sincronizar cuando edites algo — reemplaza solo las filas de ese pedido, no toca los demás.

**Importante — las fotos de este módulo NO viven en Google Sheets** (Sheets no guarda imágenes, solo texto/números). Si el servidor de Render no tiene disco persistente contratado (ver sección de despliegue más abajo), las fotos descargadas —y los pedidos que no hayas sincronizado— se pueden perder en un reinicio del servicio. Sincroniza seguido y considera el disco persistente si vas a usar este módulo para pedidos reales.

## 8. Producción / despliegue permanente (Vercel + Render)

La app ya está lista para desplegarse así: **backend en Render**, **frontend en Vercel**. Para la guía rápida (5 minutos), ver [DEPLOY.md](DEPLOY.md). Esta sección explica el detalle de cada paso y el porqué.

### 8.1 Backend en Render

1. Sube este repo a GitHub (ver [DEPLOY.md](DEPLOY.md) si aún no lo has hecho).
2. En [render.com](https://render.com) → **New +** → **Blueprint** → conecta el repo. Render detecta [render.yaml](render.yaml) automáticamente y configura casi todo solo (root dir `server`, build `npm install`, start `npm start`, health check `/api/health`).
3. Antes de confirmar, completa las variables marcadas como "de tu parte" en el dashboard de Render:
   - `ADMIN_PASSWORD` — la clave del panel admin en producción (usa una distinta a la de desarrollo).
   - `CORS_ORIGIN` — la dejas vacía por ahora, la completas en el paso 8.2 una vez tengas la URL de Vercel.
   - `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_TAB` y `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` — opcionales, ver 8.3.
   - `JWT_SECRET` se genera solo (`generateValue: true` en el blueprint).
4. **Importante — disco persistente**: [render.yaml](render.yaml) pide un disco de 1GB montado en `/var/data` (plan `starter`, de pago, ~USD 7/mes). Sin esto, **las fotos subidas y las respuestas guardadas localmente se borran en cada deploy o reinicio** — Render usa filesystem efímero por defecto. Si por ahora solo quieres probar sin costo, puedes cambiar `plan: starter` a `plan: free` y quitar el bloque `disk` en `render.yaml` antes de desplegar, pero ten en cuenta que perderás fotos/respuestas locales cada vez que Render reinicie el servicio (rara vez, pero pasa). Con Google Sheets configurado, las respuestas igual quedan seguras ahí aunque el disco se borre — solo se perderían las fotos y lo que esté pendiente de sincronizar.
5. Al terminar el deploy, copia la URL pública que te da Render (algo como `https://freesoul-feedback-api.onrender.com`) — la necesitas para el frontend.

### 8.2 Frontend en Vercel

1. En [vercel.com](https://vercel.com) → **Add New** → **Project** → importa el mismo repo de GitHub.
2. **Root Directory**: selecciona `client` (importante, si no Vercel intenta compilar la raíz del monorepo).
3. Framework preset: Vercel detecta **Vite** solo.
4. En **Environment Variables**, agrega:
   ```
   VITE_API_URL = https://freesoul-feedback-api.onrender.com
   ```
   (la URL real de tu backend en Render, del paso 8.1 — sin `/` al final).
5. Deploy. Vercel te da una URL como `https://freesoul-feedback.vercel.app`.
6. Vuelve a Render → tu servicio → Environment → completa `CORS_ORIGIN` con esa URL de Vercel (y tu dominio propio si ya lo conectaste, separados por coma) → guarda (Render redeploya solo).

`client/vercel.json` ya incluye el rewrite necesario para que las rutas de React Router (`/admin`, `/survey/:id`, `/curacion/:id`, etc.) funcionen al refrescar o compartir un link directo.

### 8.3 Google Sheets en producción

En local usas un archivo `service-account.json` en disco — en Render no conviene subir ese archivo a git ni depender de que sobreviva un redeploy. En vez de eso, pega el JSON completo codificado en base64 en la variable `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`:

```bash
node -e "console.log(require('fs').readFileSync('server/credentials/service-account.json').toString('base64'))"
```

Copia esa salida (una sola línea larga) y pégala como valor de `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` en Render. Completa también `GOOGLE_SHEET_ID` y `GOOGLE_SHEET_TAB` (ver sección 4 de este README para los pasos de creación del Service Account y de compartir el Sheet, son los mismos).

### 8.4 Mantener el servicio despierto 24/7

Render (planes free/starter) suspende el servicio tras ~15 minutos sin tráfico; la primera visita después de eso tarda ~30-50s en "despertar" (cold start). `/api/health` ya existe para esto. Dos formas de evitarlo:

- **Gratis**: configura un cron externo (ej. [cron-job.org](https://cron-job.org) o [UptimeRobot](https://uptimerobot.com)) que haga un `GET` a `https://tu-backend.onrender.com/api/health` cada 10 minutos. No es 100% garantizado por Render pero funciona bien en la práctica.
- **Garantizado**: en el plan `starter` de pago, Render no suspende el servicio por inactividad — no necesitas el cron.

### 8.5 Conectar tu dominio propio (ej. test.freesoulfashion.com.co)

1. En el proyecto de Vercel → **Settings → Domains** → agrega `test.freesoulfashion.com.co`.
2. Vercel te muestra el registro DNS exacto a crear. Normalmente, para un subdominio:
   - Tipo **CNAME**, nombre `test`, valor `cname.vercel-dns.com`.
   - (Si en cambio fuera el dominio raíz sin subdominio, Vercel pide un registro **A** apuntando a `76.76.21.21`.)
3. Entra al panel DNS de donde compraste `freesoulfashion.com.co` (GoDaddy, Namecheap, tu proveedor local, etc.) y crea ese registro.
4. Espera la propagación (minutos a un par de horas). Vercel emite el certificado SSL solo.
5. Actualiza `CORS_ORIGIN` en Render agregando `https://test.freesoulfashion.com.co` a la lista (separado por coma del dominio de Vercel).

### 8.6 Checklist antes de compartir el link con evaluadores reales

- [ ] `ADMIN_PASSWORD` en Render es distinta a la de desarrollo local.
- [ ] `CORS_ORIGIN` en Render incluye la URL final de Vercel (y tu dominio propio si aplica).
- [ ] Disco persistente activo en Render (o Google Sheets configurado, para no depender solo del disco).
- [ ] Google Sheets conectado y probado (sube un producto de prueba, responde la encuesta, revisa que la fila llegue al Sheet).
- [ ] Cron de keep-alive activo (si usas plan free) o plan starter contratado.
- [ ] Probaste el flujo completo desde un celular real con datos móviles (no wifi), no solo en el navegador de escritorio.

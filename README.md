# FreeSoul · Feedback de Productos

App para validar nuevas líneas de producto (zapatos, camisetas, bolsos, accesorios) **antes** de importarlas, recopilando feedback estructurado de evaluadores reales.

## Estructura

```
freesoul-feedback/
├── server/   → API Node/Express (productos, encuestas, Google Sheets)
└── client/   → App React + Tailwind (mobile-first)
```

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

## 8. Producción / despliegue

Por ahora está pensado para correr localmente (`npm run dev`). Cuando quieras que evaluadores externos entren desde internet, hay que:
- Desplegar `server/` en un host con Node (Render, Railway, Fly.io, VPS, etc.) y `client/` como sitio estático (Vercel, Netlify) apuntando su build a la URL del backend.
- Cambiar el almacenamiento de fotos de disco local a algo persistente en la nube (S3, Cloudinary), ya que la mayoría de hostings gratuitos no conservan archivos subidos entre despliegues.

Avísame cuando llegues a ese punto y lo dejamos configurado.

# Publicar en producción — guía de 5 minutos

Requisito único: tener el código en un repositorio de GitHub (privado o público, da igual). Todo lo demás (Render, Vercel) usa "sign in with GitHub", no necesitas crear contraseñas nuevas.

## 1. Sube el código a GitHub (1 min)

Si ya tienes un repo vacío creado en GitHub, copia su URL y corre:

```bash
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

Si todavía no tienes el repo: entra a [github.com/new](https://github.com/new), créalo vacío (sin README), copia la URL que te da, y corre los dos comandos de arriba.

## 2. Backend en Render (2 min)

1. [render.com](https://render.com) → inicia sesión con GitHub → **New +** → **Blueprint**.
2. Elige tu repo. Render lee `render.yaml` solo y preconfigura todo.
3. Completa estas 2 variables cuando te las pida (las demás quedan vacías o con su valor por defecto por ahora):
   - `ADMIN_PASSWORD`: la clave para entrar al panel admin en producción.
   - `CORS_ORIGIN`: déjala vacía, la completas en el paso 4.
4. **Deploy**. Cuando termine, copia la URL pública (ej. `https://freesoul-feedback-api.onrender.com`).

> ⚠️ El plan por defecto (`starter`) tiene costo (~USD 7/mes) porque incluye disco persistente — necesario para que las fotos y respuestas no se borren en cada reinicio. Si quieres probar gratis primero, edita `render.yaml`: cambia `plan: starter` a `plan: free` y borra el bloque `disk:` antes de subirlo — pero entonces las fotos y el respaldo local se pierden en cada redeploy (Google Sheets, si lo activas, no se ve afectado).

## 3. Frontend en Vercel (1 min)

1. [vercel.com](https://vercel.com) → inicia sesión con GitHub → **Add New → Project** → elige el mismo repo.
2. **Root Directory**: `client` (créalo así, no dejes la raíz).
3. En **Environment Variables** agrega:
   ```
   VITE_API_URL = https://freesoul-feedback-api.onrender.com
   ```
   (la URL de Render del paso 2, sin `/` al final).
4. **Deploy**. Copia la URL que te da (ej. `https://freesoul-feedback.vercel.app`).

## 4. Conectar ambos (30 seg)

Vuelve a Render → tu servicio → **Environment** → completa `CORS_ORIGIN` con la URL de Vercel del paso 3 → Save (redeploya solo).

## Listo

Entra a `https://TU-URL-DE-VERCEL.vercel.app/admin` con el `ADMIN_PASSWORD` que pusiste, crea tu primera encuesta, y comparte el link de evaluador — ya funciona desde cualquier celular con datos móviles, 24/7.

## Después (opcional, cuando quieras)

- **Google Sheets**: ver README.md sección 8.3.
- **Dominio propio** (ej. `test.freesoulfashion.com.co`): ver README.md sección 8.5.
- **Evitar que Render "duerma"** en el plan free: ver README.md sección 8.4.

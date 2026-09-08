/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // brand/sand apuntan a variables CSS (definidas en index.css y
        // sobreescritas por marca en BrandContext.jsx) — así TODA la app
        // (bg-brand-600, text-brand-700, bg-sand-500, etc.) se re-colorea
        // sola según la marca activa, sin tocar ningún componente.
        //
        // Las variables guardan "R G B" (canales separados por espacio, ej.
        // "45 69 104"), NO un hex — y se envuelven en rgb(var(...) /
        // <alpha-value>) para que Tailwind pueda componer la opacidad
        // (text-brand-100/80, bg-brand-700/50, etc.). Con var(--brand-100)
        // a secas esas clases con "/opacidad" generaban un color inválido y
        // el texto se veía negro (bug reportado: subtítulos del banner/login
        // en negro sobre fondo navy en vez de blanco/claro).
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        sand: {
          50: "rgb(var(--sand-50) / <alpha-value>)",
          100: "rgb(var(--sand-100) / <alpha-value>)",
          300: "rgb(var(--sand-300) / <alpha-value>)",
          500: "rgb(var(--sand-500) / <alpha-value>)",
          600: "rgb(var(--sand-600) / <alpha-value>)",
          700: "rgb(var(--sand-700) / <alpha-value>)",
          800: "rgb(var(--sand-800) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

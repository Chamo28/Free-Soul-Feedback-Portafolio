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
        brand: {
          50: "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          900: "var(--brand-900)",
        },
        sand: {
          50: "var(--sand-50)",
          100: "var(--sand-100)",
          300: "var(--sand-300)",
          500: "var(--sand-500)",
          600: "var(--sand-600)",
          700: "var(--sand-700)",
          800: "var(--sand-800)",
        },
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

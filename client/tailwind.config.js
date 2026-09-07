/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta tomada del logo de Free Soul DNA: navy + celeste hielo.
        brand: {
          50: "#f1f7fb",
          100: "#d2ecf9", // celeste hielo exacto del logo
          200: "#a7d4ec",
          500: "#4c6d94",
          600: "#2d4568", // color principal de botones/acentos
          700: "#1d2a43", // navy exacto del logo (hover, headers)
          900: "#141d30",
        },
        // Taupe/arena cálido para acentos secundarios (Operations Suite),
        // complementa al navy sin competir con él.
        sand: {
          50: "#faf7f5",
          100: "#f3ece7",
          300: "#e3d3c8",
          500: "#d4c5b9",
          600: "#b9a690",
          700: "#93816c",
          800: "#6b5a48",
        },
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

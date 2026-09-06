/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f6ff",
          100: "#e6ebff",
          500: "#4f5fe0",
          600: "#3f4dc7",
          700: "#333da3",
        },
      },
    },
  },
  plugins: [],
};

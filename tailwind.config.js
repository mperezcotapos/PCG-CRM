/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce7ff',
          200: '#b9ccff',
          300: '#8aa6ff',
          400: '#567bff',
          500: '#2952f5',
          600: '#1a3edb',
          700: '#152fb2',
          800: '#172891',
          900: '#182773',
        },
      },
    },
  },
  plugins: [],
}

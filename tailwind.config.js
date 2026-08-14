/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        moss: {
          950: '#1b281f',
          900: '#243629',
          850: '#2c4233',
          800: '#354e3d',
          750: '#3e5c48',
          700: '#486a53',
          600: '#557d62',
          500: '#649374',
        },
        sand: {
          50: '#faf7ed',
          100: '#f5f0db',
          200: '#ece3be',
          300: '#dfd29e',
          400: '#cdbd7c',
          500: '#b8a55e',
          600: '#9b8949',
          700: '#796a39',
          800: '#544a29',
          850: '#423a21',
          900: '#312b19',
        },
      },
      fontFamily: {
        bungee: ['"Bungee Shade"', 'cursive'],
        gorton: ['Comfortaa', 'Dosis', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

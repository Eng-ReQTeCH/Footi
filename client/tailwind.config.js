/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#020f0b',
          900: '#04170f',
          800: '#07231a',
          700: '#0b3224',
        },
      },
    },
  },
  plugins: [],
};
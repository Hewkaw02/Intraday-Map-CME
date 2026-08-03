/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0B0E14',
          800: '#151922',
          700: '#1E2330',
          600: '#2A3042',
          500: '#3A4259',
        },
        cme: {
          gold: '#F59E0B',
          call: '#10B981',
          put: '#EF4444',
          accent: '#3B82F6',
          bg: '#0D1117'
        }
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#1a365d',
          600: '#1a365d',
          700: '#2c5282',
        },
        accent: {
          500: '#3182ce',
          600: '#2b6cb0',
        },
        success: '#38a169',
        warning: '#dd6b20',
        error: '#e53e3e',
      },
    },
  },
  plugins: [],
}

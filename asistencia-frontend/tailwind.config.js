/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa (Azul / Naranja / Blanco) // Branding
        brand: {
          blue: '#0B2D5B', // Azul oscuro corporativo (botones/tabs) // Branding
          orange: '#D66A00', // Naranja corporativo (no tan claro) // Branding
          bg: '#FFFFFF', // Blanco (fondo principal) // UI
          soft: '#07263f', // Azul muy suave para círculos decorativos // UI
        },
      },
    },
  },
  plugins: [],
}
    
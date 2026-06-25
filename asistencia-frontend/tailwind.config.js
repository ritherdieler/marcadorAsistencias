/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        syncPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(14, 165, 233, 0.35)' },
          '50%': { boxShadow: '0 0 0 8px rgba(14, 165, 233, 0)' },
        },
        badgeEnter: {
          '0%': { transform: 'scale(0.92) translateY(-4px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        dotPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.55' },
        },
        progressSlide: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(320%)' },
        },
        guidePulseIn: {
          '0%, 100%': { opacity: '0.45', transform: 'translateY(6px)' },
          '50%': { opacity: '1', transform: 'translateY(-4px)' },
        },
        guidePulseOut: {
          '0%, 100%': { opacity: '0.45', transform: 'translateY(-6px)' },
          '50%': { opacity: '1', transform: 'translateY(4px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        'sync-pulse': 'syncPulse 1.6s ease-out infinite',
        'badge-enter': 'badgeEnter 0.5s ease-out forwards',
        'dot-pulse': 'dotPulse 1.2s ease-in-out infinite',
        'progress-slide': 'progressSlide 1.1s ease-in-out infinite',
        'guide-pulse-in': 'guidePulseIn 1.2s ease-in-out infinite',
        'guide-pulse-out': 'guidePulseOut 1.2s ease-in-out infinite',
      },
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
    
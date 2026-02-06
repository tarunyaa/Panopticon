/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Silkscreen"', 'monospace'],
      },
      colors: {
        floor: '#E8E4DC',
        wall: '#D4D0C8',
        'accent-blue': '#7BA3C9',
        'accent-green': '#8FBC8F',
        'accent-coral': '#E8A598',
        'accent-purple': '#B8A9C9',
        'accent-amber': '#D4A574',
        'accent-teal': '#6BAFA6',
        'text-dark': '#4A4A4A',
        highlight: '#FFE4B5',
        // Pixel UI palette — warm wood/parchment tones
        parchment: {
          light: '#E8DCC8',
          DEFAULT: '#D4C8A8',
          dark: '#C4B898',
        },
        wood: {
          light: '#C8B080',
          DEFAULT: '#A08060',
          dark: '#6B5040',
        },
        ink: '#3A2820',
      },
      animation: {
        'idle-bob': 'idle-bob 2s ease-in-out infinite',
        'hover-bounce': 'hover-bounce 0.3s ease-out',
      },
      keyframes: {
        'idle-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        'hover-bounce': {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        floor: '#E8E4DC',
        wall: '#D4D0C8',
        'accent-blue': '#7BA3C9',
        'accent-green': '#8FBC8F',
        'accent-coral': '#E8A598',
        'accent-purple': '#B8A9C9',
        'text-dark': '#4A4A4A',
        highlight: '#FFE4B5',
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

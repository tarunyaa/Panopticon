/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pixel-art limited palette (~20 colors)
        floor: '#E8DCC8',
        'floor-warm': '#F0E8D8',
        wall: '#D0C8B8',

        // Outlines
        'outline-dark': '#2B2B2B',
        'outline-mid': '#4A4A4A',

        // Character skin tones
        'warm-skin': '#FFD5B8',
        'cool-skin': '#FFE4D6',
        'neutral-skin': '#F0C8A0',
        'bright-skin': '#D4A07A',

        // Warm body colors
        'warm-body': '#E07050',
        'warm-accent': '#FF9060',
        'warm-dark': '#C46040',

        // Cool body colors
        'cool-body': '#5088C0',
        'cool-accent': '#70A8E0',
        'cool-dark': '#385898',

        // Nature
        'nature-green': '#60A060',
        'nature-light': '#80C880',
        'nature-dark': '#406840',

        // Accents
        'accent-yellow': '#FFD050',
        'accent-red': '#FF6060',
        'accent-purple': '#A070C0',
        'accent-teal': '#50B8B8',
        'accent-blue': '#5088C0',
        'accent-green': '#60A060',
        'accent-coral': '#E07050',

        // Wood
        'wood-light': '#D09060',
        'wood-dark': '#A07048',

        // Environment
        'env-light': '#E8DCC8',
        'env-mid': '#D0C8B8',
        'env-dark': '#B0A898',

        // Building colors
        'building-hub': '#FF9060',
        'building-workshop': '#5088C0',
        'building-library': '#A070C0',
        'building-cafe': '#E07050',
        'building-greenhouse': '#60A060',
        'building-post': '#50B8B8',

        // UI
        'text-dark': '#2B2B2B',
        'text-light': '#4A4A4A',
        highlight: '#FFD050',
      },
      boxShadow: {
        'soft': '2px 2px 0 rgba(0, 0, 0, 0.15)',
        'soft-lg': '3px 3px 0 rgba(0, 0, 0, 0.2)',
      },
      animation: {
        // Pixel character animations with steps()
        'pixel-idle-0': 'pixel-idle-bob-0 2.0s steps(4) infinite',
        'pixel-idle-1': 'pixel-idle-bob-1 1.8s steps(4) infinite',
        'pixel-idle-2': 'pixel-idle-bob-2 2.4s steps(4) infinite',

        // Legacy names mapping to pixel versions
        'idle-bob-0': 'pixel-idle-bob-0 2.0s steps(4) infinite',
        'idle-bob-1': 'pixel-idle-bob-1 1.8s steps(4) infinite',
        'idle-bob-2': 'pixel-idle-bob-2 2.4s steps(4) infinite',

        // Ambient animations
        'cloud-drift': 'cloud-drift 60s linear infinite',
        'cloud-drift-slow': 'cloud-drift 80s linear infinite',

        // AI hint animations with steps()
        'sparkle-pop': 'pixel-sparkle 3s steps(4) infinite',
        'pulse-glow': 'pixel-pulse 2s steps(2) infinite',

        // Hover/interaction
        'hover-bounce': 'hover-bounce 0.2s steps(2)',
      },
      keyframes: {
        'pixel-idle-bob-0': {
          '0%, 100%': { transform: 'translateY(0)' },
          '25%': { transform: 'translateY(-1px)' },
          '50%': { transform: 'translateY(-2px)' },
          '75%': { transform: 'translateY(-1px)' },
        },
        'pixel-idle-bob-1': {
          '0%, 100%': { transform: 'translateY(0)' },
          '25%': { transform: 'translateY(-1px)' },
          '50%': { transform: 'translateY(-2px)' },
          '75%': { transform: 'translateY(-1px)' },
        },
        'pixel-idle-bob-2': {
          '0%, 100%': { transform: 'translateY(0)' },
          '25%': { transform: 'translateY(-1px)' },
          '50%': { transform: 'translateY(-3px)' },
          '75%': { transform: 'translateY(-1px)' },
        },
        'pixel-sparkle': {
          '0%, 100%': { opacity: '0', transform: 'scale(0) rotate(0deg)' },
          '25%': { opacity: '1', transform: 'scale(1) rotate(45deg)' },
          '50%': { opacity: '1', transform: 'scale(0.8) rotate(90deg)' },
          '75%': { opacity: '0.5', transform: 'scale(0.4) rotate(135deg)' },
        },
        'pixel-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.7' },
        },
        'hover-bounce': {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'cloud-drift': {
          '0%': { transform: 'translateX(-150px)' },
          '100%': { transform: 'translateX(calc(100vw + 150px))' },
        },
      },
    },
  },
  plugins: [],
}

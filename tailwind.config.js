/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#27252a',
        paper: '#f6efdc',
        butter: '#f6d96b',
        coral: '#f28c79',
        aqua: '#8fd8d0',
        lilac: '#b7a3dd',
        tomato: '#ee6b55'
      },
      boxShadow: { sticker: '3px 4px 0 #27252a', soft: '2px 3px 0 rgba(39,37,42,.18)' },
      fontFamily: { display: ['Space Grotesk', 'Arial Rounded MT Bold', 'sans-serif'], sans: ['DM Sans', 'ui-sans-serif', 'sans-serif'] }
    }
  }
}

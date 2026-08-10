/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neroverde: {
          50: '#effcf4',
          100: '#d8f9e5',
          200: '#b4f0cc',
          300: '#7ee2a5',
          400: '#35c36f',
          500: '#20a95a',
          600: '#168946',
          700: '#126e3a',
          800: '#105831',
          900: '#0a2d1b'
        }
      },
      boxShadow: {
        'panel': '0 18px 45px rgba(0, 0, 0, .24)',
        'glow': '0 12px 35px rgba(32, 169, 90, .18)'
      }
    }
  },
  plugins: []
};

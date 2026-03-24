/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#145228',
          800: '#0D3B1E',
          900: '#072514',
          DEFAULT: '#1B4332',
        },
        accent: {
          DEFAULT: '#FCBF49',
          dark: '#E8A82A',
        },
        ethiopia: {
          green: '#078930',
          yellow: '#FCDD09',
          red: '#DA121A',
          blue: '#0F47AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

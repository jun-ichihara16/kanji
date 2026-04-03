/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        green: { DEFAULT: '#22C55E', dark: '#16A34A', light: '#F0FDF4' },
        line: '#06C755',
        sub: '#6B7280',
        border: '#E5E7EB',
        'gray-bg': '#F3F4F6',
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', '"Inter"', 'sans-serif'],
        inter: ['"Inter"', '"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

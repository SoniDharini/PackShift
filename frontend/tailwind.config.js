/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#142923',
        emerald: {
          DEFAULT: '#229C78',
          deep: '#146E54',
        },
        cream: '#F7F8F4',
        amber: '#E9B969',
        muted: '#76857D',
        secondary: '#4A5C54',
        line: '#E4E9E3',
        danger: '#8E2F2F',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 41, 35, 0.04), 0 18px 40px -24px rgba(20, 41, 35, 0.22)',
        float: '0 24px 60px -32px rgba(20, 41, 35, 0.38)',
      },
    },
  },
  plugins: [],
}

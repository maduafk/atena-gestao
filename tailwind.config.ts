import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f1f3',
          100: '#d1e3e7',
          200: '#a3c7cf',
          300: '#75abb7',
          400: '#478f9f',
          500: '#1a5568',
          600: '#0B2D39',
          700: '#092630',
          800: '#071e26',
          900: '#05171d',
        },
      },
    },
  },
  plugins: [],
}
export default config

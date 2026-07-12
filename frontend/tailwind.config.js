/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.25' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
      },
      animation: {
        'blob': 'blob 7s infinite',
        'gradient': 'gradient 3s linear infinite',
      },
    },
  },
  plugins: [],
}


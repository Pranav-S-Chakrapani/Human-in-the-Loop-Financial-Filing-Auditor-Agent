/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#06090e',
        surface: '#0c121d',
        elevated: '#131c2d',
        overlay: '#19253c',
        border: 'rgba(255, 255, 255, 0.08)',
        borderFocus: 'rgba(56, 189, 248, 0.35)',
        primary: '#38bdf8',
        secondary: '#818cf8',
        teal: '#2dd4bf',
        success: '#34d399',
        warning: '#fbbf24',
        destructive: '#f87171',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

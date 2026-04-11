import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', '"Helvetica Neue"', '"Segoe UI"', '"Apple SD Gothic Neo"', '"Noto Sans KR"', '"Malgun Gothic"', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Monaco', '"Courier New"', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd3ff',
          300: '#8eb8ff',
          400: '#5990ff',
          500: '#3366ff',
          600: '#1b44f5',
          700: '#1433e1',
          800: '#172bb6',
          900: '#192a8f',
          950: '#141b57',
        },
        surface: {
          0: '#ffffff',
          50: '#fafbfc',
          100: '#f4f5f7',
          200: '#e8eaed',
          300: '#d1d5db',
        },
        dark: {
          950: '#09090b',
          900: '#0f0f14',
          850: '#141419',
          800: '#1a1a23',
          700: '#27273a',
          600: '#3f3f5c',
        },
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.8' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'morph': {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
        },
        'aurora-1': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.3' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)', opacity: '0.4' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)', opacity: '0.25' },
        },
        'aurora-2': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.25' },
          '33%': { transform: 'translate(-40px, 30px) scale(1.15)', opacity: '0.35' },
          '66%': { transform: 'translate(25px, -40px) scale(0.85)', opacity: '0.2' },
        },
        'aurora-3': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1.05)', opacity: '0.2' },
          '33%': { transform: 'translate(50px, 20px) scale(0.9)', opacity: '0.3' },
          '66%': { transform: 'translate(-30px, -30px) scale(1.1)', opacity: '0.15' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(51,102,255,0.15)' },
          '50%': { borderColor: 'rgba(51,102,255,0.3)' },
        },
        'shimmer-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s ease-out both',
        'shimmer': 'shimmer 2s infinite linear',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'morph': 'morph 8s ease-in-out infinite',
        'aurora-1': 'aurora-1 15s ease-in-out infinite',
        'aurora-2': 'aurora-2 18s ease-in-out infinite',
        'aurora-3': 'aurora-3 21s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'border-glow': 'border-glow 3s ease-in-out infinite',
        'shimmer-bar': 'shimmer-bar 2s ease-in-out infinite',
      },
      backgroundSize: {
        '300%': '300%',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        // Editorial financial palette
        ink: {
          DEFAULT: '#0A0F0D',
          50: '#F4F1EA',
          100: '#E8E2D2',
          200: '#C9C1AE',
          300: '#8A8576',
          400: '#5A574E',
          500: '#3A3833',
          600: '#252420',
          700: '#1A1916',
          800: '#13120F',
          900: '#0A0F0D',
        },
        paper: '#F4F1EA',
        cream: '#EBE5D4',
        moss: {
          DEFAULT: '#3D5A47',
          dark: '#283B2F',
          light: '#6A8970',
        },
        amber: {
          DEFAULT: '#C9A24B',
          dark: '#8C6F2F',
          light: '#E8C982',
        },
        terra: {
          DEFAULT: '#A04A2F',
          dark: '#6E2F1C',
          light: '#D4886E',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-in': 'slideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

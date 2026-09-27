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
      // Escala tipográfica cerrada (ver DESIGN.md). `xs` sube de 12 a 13px: es el
      // piso de lectura (etiquetas, chips, ayudas). Nada por debajo de 13px.
      fontSize: {
        xs: ['13px', { lineHeight: '18px' }],
        label: ['13px', { lineHeight: '18px' }],
        meta: ['14px', { lineHeight: '20px' }],
        body: ['15px', { lineHeight: '22px' }],
      },
      colors: {
        // Voces de color (ver DESIGN.md):
        //   marca/acción/ubicación → amber (logo, primario único, ítem activo)
        //   selección del usuario  → seleccion (filtro/segmento elegido)
        //   estado                 → moss (bien) / terra (mal), siempre con etiqueta
        //   neutros                → ink / paper
        seleccion: {
          DEFAULT: '#F4F1EA', // = paper: lo elegido se "enciende" en neutro fuerte
          tinta: '#0A0F0D',   // texto sobre selección (17:1)
        },
        // Borde de controles (inputs, selects, segmentos): 3.6:1 sobre ink-900 y
        // 3.3:1 sobre ink-700, cumple WCAG 1.4.11. Las hairlines (1.2:1) quedan
        // sólo para separadores decorativos.
        control: '#6E6A62',
        // Editorial financial palette
        ink: {
          DEFAULT: '#0A0F0D',
          50: '#F4F1EA',
          100: '#E8E2D2',
          200: '#C9C1AE',
          300: '#8A8576',
          // #5A574E daba ~2.7:1 sobre ink-900/800 (falla WCAG AA, mínimo 4.5:1 para texto
          // normal) pese a usarse como color de texto secundario en toda la app.
          400: '#84807A',
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
        // Duraciones del catálogo: 180ms fundidos, 260ms entradas de contenido.
        'fade-up': 'fadeUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.18s ease-out forwards',
        'slide-in': 'slideIn 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards',
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

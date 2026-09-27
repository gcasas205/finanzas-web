# Tokens de Corralap (Tailwind v4 `@theme`) — ejemplo trabajado

Pegalo en `app/globals.css`. Los nombres son del rubro a propósito (`suelo`, `chapa`, `pavonado`, `tiza`): un nombre de rol del dominio se recuerda y se discute mejor que `gray-600`. En otro proyecto, conservá la estructura y cambiá los valores.

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-montserrat), ui-sans-serif, system-ui, sans-serif;

  /* Oscuro de marca: riel, barras, bandas, selección. */
  --color-pavonado: #16212b;
  --color-pavonado-2: #1f2e3c;      /* hover sobre oscuro, campo de búsqueda del riel */
  --color-pavonado-3: #2c3f51;      /* magnitud en gráficos */
  --color-pavonado-borde: #34495c;  /* divisores sobre oscuro */
  --color-pavonado-velo: #e3e8ed;   /* NUEVO: fondo de chip "tinta" y columna resaltada (antes bg-[#e3e8ed]) */
  --color-niebla: #a9b8c2;          /* texto secundario sobre oscuro (8.0:1) */

  /* Marca: logo, primario, ubicación. */
  --color-amarillo: #ffc20e;
  --color-amarillo-2: #f2b400;      /* hover del primario */
  --color-amarillo-tinta: #7a5500;
  --color-amarillo-velo: #fff3c4;

  /* Neutros de trabajo. */
  --color-suelo: #eceeed;           /* fondo de la app */
  --color-columna: #e2e6e4;         /* NUEVO: fondo de columnas del tablero (antes bg-[#e2e6e4]) */
  --color-chapa: #ffffff;           /* superficies */
  --color-chapa-2: #f4f6f5;         /* encabezados de tabla, hover, deshabilitado */
  --color-linea: #dce1df;           /* bordes de panel (decorativos) */
  --color-linea-fuerte: #bfc7c4;    /* bordes de botón secundario */
  --color-borde-control: #8a949b;   /* NUEVO: borde de campo que debe cumplir 3:1 (ver auditoría) */
  --color-tinta: #16212b;           /* texto principal y anillo de foco */
  --color-tiza: #5a666f;            /* texto secundario (5.9:1 sobre chapa) */
  --color-placeholder: #66727a;     /* NUEVO: 4.9:1 (antes #7d8a92 = 3.55:1, no pasaba AA) */

  /* Semáforo: familias de cuatro pasos. */
  --color-verde: #1b8049;  --color-verde-tinta: #146337;  --color-verde-claro: #3dbe74;  --color-verde-velo: #e4f3ea;
  --color-ambar: #e8830c;  --color-ambar-tinta: #8a4700;  --color-ambar-claro: #f7b25e;  --color-ambar-velo: #fdebd6;
  --color-rojo:  #cf3a2c;  --color-rojo-tinta:  #a4261b;  --color-rojo-claro:  #f07a6d;  --color-rojo-velo:  #fbe9e6;

  /* Profundidad. */
  --shadow-suave:  0 1px 2px rgb(22 33 43 / 0.05), 0 4px 14px -6px rgb(22 33 43 / 0.14);
  --shadow-alzada: 0 2px 6px rgb(22 33 43 / 0.08), 0 20px 44px -14px rgb(22 33 43 / 0.34);
  --shadow-levantada: 0 24px 48px -12px rgb(22 33 43 / 0.45), 0 4px 10px rgb(22 33 43 / 0.12); /* NUEVO: tarjeta arrastrada */
  --shadow-foco: 0 0 0 3px rgb(22 33 43 / 0.14);  /* NUEVO: halo de campo enfocado (antes repetido inline) */

  /* Radios con nombre de rol (NUEVO: antes rounded-[10px] repetido en 40+ lugares). */
  --radius-ladrillo: 5px;
  --radius-icono: 8px;
  --radius-control: 10px;
  --radius-tarjeta: 12px;
  --radius-panel: 16px;

  /* Movimiento. */
  --ease-salida: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-trazo: cubic-bezier(0.33, 1, 0.68, 1);
  --animate-aparecer: aparecer 180ms ease-out both;
  --animate-subir: subir 260ms var(--ease-salida) both;
  --animate-desplegar: desplegar 160ms var(--ease-salida) both;
  --animate-ladrillo: ladrillo 1.5s ease-in-out infinite both;

  @keyframes aparecer { from { opacity: 0 } to { opacity: 1 } }
  @keyframes subir { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
  @keyframes desplegar { from { opacity: 0; transform: translateY(-4px) scale(0.98) } to { opacity: 1; transform: none } }
  @keyframes ladrillo { 0% { opacity: .12 } 18%, 72% { opacity: 1 } 100% { opacity: .12 } }
}
```

Con `--radius-*` Tailwind v4 genera `rounded-control`, `rounded-tarjeta`, etc.; con `--shadow-foco`, `shadow-foco`; con `--color-placeholder`, `placeholder:text-placeholder`. Reemplazá los valores arbitrarios del código por estas utilidades.

## Base

```css
@layer base {
  html { -webkit-text-size-adjust: 100%; color-scheme: light; }
  body {
    background: var(--color-suelo); color: var(--color-tinta);
    font-size: 16px; line-height: 1.5;
    -webkit-font-smoothing: antialiased; overflow-x: hidden;
  }
  ::selection { background: var(--color-pavonado); color: #fff; }
  :focus-visible { outline: 2.5px solid var(--color-tinta); outline-offset: 2px; }
  .sobre-pavonado :focus-visible { outline-color: var(--color-amarillo); }
  input, select, textarea, button { font: inherit; }
  input[type='number'] { font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  * { scrollbar-width: thin; scrollbar-color: var(--color-linea-fuerte) transparent; }
}

@layer components {
  .titular { font-weight: 800; letter-spacing: -0.025em; line-height: 1.1; text-wrap: balance; }
  .rotulo  { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; line-height: 1.2; }
  .cifra   { font-variant-numeric: tabular-nums lining-nums; letter-spacing: -0.01em; }
  .grano-pavonado {
    background-color: var(--color-pavonado);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  }
}
```

## Escalas de referencia

| Escala | Valores |
|---|---|
| Alturas de control | 36 (`sm`) · **44** (`md`) · 48 (`lg`) · cuadrado de ícono 44 / 36 |
| Separaciones | 6 · 8 · 12 · 16 dentro de bloque · 24 entre bloques |
| Relleno de panel | 20 móvil · 24 `sm+` · banda destacada 28×32 |
| Márgenes de página | 16 móvil · 24 `sm` · 40 `lg` · máx. 1400 |
| Navegación | riel 248 · barra superior 56 · barra inferior 64 · reserva inferior 96 + área segura |
| Breakpoints clave | `sm` 640 (títulos 34px, diálogo centrado) · `md` 768 (filtros en varias filas) · `lg` 1024 (riel) · `xl` 1280 (tabla en vez de lista, kanban en grilla) |

## Colores fuera de CSS

Los gráficos SVG y los íconos de marca necesitan el hex en JS. **No dupliques valores:** leelos de un solo módulo (`lib/tokens.ts`) generado a mano o por script desde el `@theme`, o usá `fill="var(--color-verde)"` directamente en el SVG (funciona en SVG inline). En Corralap el mismo `#1b8049` está en `globals.css`, `Punta.tsx` y `palette.ts`: tres fuentes de verdad que se desincronizan.

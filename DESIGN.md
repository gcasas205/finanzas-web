# DESIGN.md — Finanzas

Sistema de diseño de la app. Mandan estas reglas: si una pantalla las contradice, se corrige la pantalla.
Tokens en `tailwind.config.js` (clases) y `src/lib/palette.ts` (lo que no admite clases: Recharts, SVG, `style`).
Criterio: skill `webapp-designer` (`.claude/skills/webapp-designer/`).

## Carácter

Editorial y oscuro: tinta casi negra (`ink-900`), papel cálido (`paper`), serif de display (Fraunces) para títulos y
cifras héroe, monoespaciada (JetBrains Mono) para el trabajo. Grano sutil de fondo. Hairlines en vez de sombras.

## 1. Voces de color

| Voz | Token | Se usa para | Nunca para |
|---|---|---|---|
| **Marca / acción / ubicación** | `amber` | punto del logo, **un** botón primario por vista, ítem activo de la navegación (barra lateral, píldora de la barra inferior, subrayado de pestañas), foco de teclado | datos, series de gráficos, filtros elegidos, decoración de títulos |
| **Selección** | `seleccion` (= `paper`) + texto `seleccion-tinta` | segmento/filtro elegido (`Segmented`), tarjeta elegida, `::selection` | acción principal |
| **Estado / dirección** | `moss-light` (bueno, entra) · `terra-light` (malo, sale) | balance, resultado por tipo de cambio, variación, "objetivo cumplido", errores; gasto/ingreso y compra/venta elegidos | decoración |
| **Neutros** | `ink-*`, `paper` | todo lo demás | — |

Reglas con nombre, para citar en un review:

- **La marca no reporta.** Si algo ámbar no es el logo, el primario o "estás acá", está mal.
- **Lo elegido se enciende en neutro.** Filtros y segmentos elegidos: fondo `seleccion`, texto `seleccion-tinta`.
- **El semáforo habla de estado y de dirección de la plata.** Verde = entra / suma (ingreso, compra de USD,
  balance positivo); rojo = sale / resta (gasto, venta de USD, balance negativo). Se usa en el tipo elegido de
  los formularios (Gasto/Ingreso, Compro/Vendo), en los chips y totales de Dólares, en la cotización
  (compra/venta), en los montos de ingresos y gastos (listas, vencimientos, importación), en los botones que
  confirman algo que suma (`Button variant="exito"`: Importar, Empezar) y en balances y resultados.
  Siempre con texto, flecha o signo al lado (nunca sólo color).
- **Series de gráficos:** ingresos `PALETTE.positivo`, gastos `PALETTE.negativo`, ahorro/tenencia/capital
  `PALETTE.serie` (neutro), período anterior `PALETTE.serieSecundaria`. Las categorías usan su color propio
  (`lib/categories.ts`), que es identidad, no estado.

## 2. Tipografía (escala cerrada)

| Rol | Clase | Uso |
|---|---|---|
| Display | `display text-3xl sm:text-5xl` | título de vista (va solo) y cifra héroe |
| Título | `display text-2xl` | paneles, diálogos, estados de error |
| Body | `text-sm` / `text-body` (15px) | celdas, campos, navegación |
| Meta | `text-meta` (14px) | datos secundarios |
| Label | `text-xs` (**13px**) | rótulos, chips, ayudas y errores de campo |
| Rótulo | `.eyebrow` (13px, mayúsculas, +0.08em) | encabezado de sección y de columna |

- **Piso de lectura: 13px.** `text-xs` está redefinido a 13px; no se usan `text-[Npx]` por debajo.
- Todo número lleva `.tabular` (cifras tabulares) para que no "baile" al animarse.
- Títulos de vista con una palabra en itálica (`<em className="italic">`), en el mismo color del título.

## 3. Controles y contraste (WCAG AA medido)

| Par | Ratio |
|---|---|
| `paper` / `ink-900` | 17.1 |
| `ink-300` / `ink-900` (texto secundario) | 5.2 |
| `ink-400` / `ink-900` (placeholder) | 4.9 |
| `moss-light` / `ink-900` | 5.0 |
| `terra-light` / `ink-900` | 6.9 |
| `ink-900` / `amber` (botón primario) | 8.1 |
| **`control` / `ink-900`** (borde de campo) | **3.6** (≥ 3:1, WCAG 1.4.11) |
| `control` / `ink-700` | 3.3 |
| `terra` como texto | 3.2 ❌ — usar `terra-light` |
| `moss` como texto | 2.5 ❌ — usar `moss-light` |

- Campos: clase `.form-input` (borde `control`, hover `ink-300`, foco = un solo borde `amber` de 2px sin anillo
  separado, error `terra-light` vía `aria-invalid`). Sin flechitas en `type="number"`; fechas alineadas a la izquierda.
- Objetivo táctil mínimo 44×44 (`min-h-11`); botones de ícono con `p-2.5`–`p-3.5`.
- Foco visible siempre (`:focus-visible` ámbar, 2px). "Saltar al contenido" es el primer foco.

## 4. Layout

- **Desde `lg`:** barra lateral fija de 256px, activo con fondo `ink-700/50` + filete ámbar.
- **Debajo de `lg`:** barra superior de 56px + **barra inferior de 5 pestañas** (Resumen, Movimientos, Dólares,
  Ahorro, **Más**). Activo = ícono en píldora ámbar 48×28. "Más" abre una hoja con Análisis, Importar y Ajustes.
  Ambas barras son negras sólidas (sin transparencia) y su fondo se extiende más allá del borde (arriba la
  superior, abajo la inferior), para que en iOS no se vea el contenido pasando detrás del reloj ni de la barra
  del navegador. La superior mide 56px + `env(safe-area-inset-top)`.
  El contenido reserva `96px + env(safe-area-inset-bottom)`.
- Tablas anchas → tarjetas/listas en celular; cero desborde horizontal de página a 320px.
- Sólo se superponen diálogos: formularios de alta/edición, confirmaciones y la hoja "Más".

## 5. Movimiento

- Curva única de salida: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Duraciones: 150ms color/borde · 180ms fundidos · **260ms** diálogos, avisos y entradas de contenido ·
  **650ms** conteo de cifras · tope 700ms por secuencia. Escalonado 40ms con techo de 220ms.
- Lo que entra animado sale animado (`Dialog` usa `AnimatePresence`).
- Botones: `active:scale-[0.98]`.
- `prefers-reduced-motion`: duraciones a ~0, las cifras saltan al valor final.
- Loader de marca (`LogoLoader`) para cargas de vista; spinner chico sólo dentro de botones.

## 6. Feedback

- **Avisos (sonner):** abajo a la derecha; en celular, encima de la barra inferior. Máximo 3. Éxito 4,5s,
  error 7s. Nombran el registro ("\"Coto\" guardado").
- **Errores de carga:** `ErrorState` (qué pasó + Reintentar) si no hay datos; `StaleDataBanner` si hay datos
  viejos en pantalla. Nunca se muestra "sin movimientos" cuando en realidad falló la planilla.
- **Formularios:** etiqueta arriba con `*` si es obligatorio; ayuda o error debajo (el error reemplaza a la ayuda).
  Validación al enviar; el error del servidor (`{ detail, code, field }`) marca su campo; el foco va al primer
  campo con error; editar un campo limpia su error.
- **Confirmaciones destructivas:** `useConfirm()` con el nombre del registro, botón de peligro y "Cancelar"
  fantasma. Nada de `window.confirm`.
- **Estados vacíos:** `EmptyState` con mensaje y, si aplica, la acción que lo resuelve.
- **Selección múltiple:** botón "Seleccionar" (secundario, `aria-pressed`) que agrega casillas (`accent-paper`)
  y una barra de acciones arriba de la lista con el conteo en vivo. "Listo" sale del modo y limpia la selección.
- **Detalle desplegable:** una fila de lista que abre su detalle es un `button` con `aria-expanded`; lo abierto
  se marca con fondo `ink-700/50` (voz de selección, nunca ámbar).
- **Historiales:** lista con fecha en mono, cambios con signo y color de dirección, y "Mostrar más" de a 15.

## 7. Componentes (`src/components/ui/`)

| Componente | Para qué |
|---|---|
| `Button` / `buttonClasses` | variantes `primario`, `secundario`, `fantasma`, `peligro`; `isLoading` con `aria-busy` |
| `Field` | etiqueta + control + ayuda/error; entrega `{ id, aria-describedby, aria-invalid }` para esparcir |
| `Dialog` / `DialogActions` | modal accesible: foco inicial, trampa de Tab, Escape, foco devuelto, hoja inferior en celular |
| `useConfirm` | confirmación destructiva con promesa |
| `Segmented` | elegir una de pocas opciones (voz de selección) |
| `ErrorState` · `StaleDataBanner` · `EmptyState` | estados de vista |

## Do / Don't

- ✅ `bg-seleccion text-seleccion-tinta` para lo elegido · ❌ `bg-amber` en un filtro.
- ✅ `<Monto>` verde (+) o rojo (−) con signo · ✅ `tone` en `Segmented` para Gasto/Ingreso y Compro/Vendo.
- ✅ Campos numéricos sin flechitas; la rueda del mouse no cambia el valor.
- ✅ `PALETTE.serie` en un gráfico · ❌ `"#C9A24B"` suelto en un componente.
- ✅ `text-xs` (13px) · ❌ `text-[10px]`.
- ✅ `border-control` en campos · ❌ `border-ink-500` (1.6:1) delimitando un control.

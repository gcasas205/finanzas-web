---
name: "webapp-designer"
description: >-
  Usa esta skill cuando el usuario pida evaluar, diseñar o mejorar la UI/UX de una webapp o de una
  pantalla puntual: sistema de diseño y tokens (Tailwind v4 `@theme`), paleta con voces de color
  separadas (marca / selección / estado), escala tipográfica, radios, sombras, layout responsive
  mobile-first con riel y barra inferior, tablas que pasan a listas, formularios y sus estados de
  error, movimiento con propósito (catálogo de animaciones, escalonado, conteo de cifras, gráficos
  que crecen, arrastre) con `prefers-reduced-motion`, feedback (toasts, loaders de marca, estados
  vacíos), visualización de datos accesible y contraste WCAG medido. Aplicala también cuando pidan
  "que se vea mejor", "pulir la UI", un design review, un DESIGN.md, una paleta, animaciones o
  microinteracciones, aunque no digan "sistema de diseño".
---

# Diseñador de Webapps (UI/UX de Producto)

Actuás como Product Designer Senior. La app tiene que verse deliberada y con carácter propio, y usarse rápido, con apuro y en el celular. Diseñás con **tokens con nombre de rol**, cada decisión tiene una razón explicable, y medís (contraste, objetivos táctiles, duraciones) en vez de estimar.

La implementación de referencia es **Corralap** (CRM de presupuestos para corralones: amarillo vial sobre acero pavonado). Sus tokens y reglas están acá como ejemplo trabajado; si el proyecto es otro, conservá la **estructura** (voces de color, familias, escalas, reglas con nombre) y cambiá los valores.

Referencias (leé la que corresponda):
- `references/tokens-corralap.md` — `@theme` completo, escalas y utilidades listas para pegar.
- `references/movimiento.md` — catálogo de animaciones, keyframes, escalonado, conteo, arrastre, entradas y **salidas**.
- `references/componentes.md` — anatomía y estados de cada componente (botones, campos, desplegables, calendario, chips, tablas, toasts, diálogos, navegación).
- `references/datos-y-graficos.md` — color en gráficos, rampa secuencial, tooltip, "Ver tabla", embudo.
- `references/auditoria.md` — checklist de review con los hallazgos típicos y cómo corregirlos.

## 1. Tres voces de color que no se mezclan

El error más caro en un producto es que un mismo color signifique dos cosas. Separá el color por **rol**, y dale a cada rol una regla con nombre para poder citarla en un review:

| Voz | Corralap | Se usa para | Nunca para |
|---|---|---|---|
| **Marca / acción / ubicación** | `amarillo` | logo, el **único** botón primario de la vista, ítem activo de la navegación | estado, salud, selección |
| **Selección del usuario** | `pavonado` | filtro activo, segmento activo, día elegido, switch encendido, `::selection` | acción principal |
| **Estado (semáforo)** | `verde` / `ambar` (naranja) / `rojo` | salud de un registro, resultado (ganado/perdido), error y peligro (rojo) | magnitudes neutras, decoración |
| **Neutros** | `suelo`, `chapa`, `linea`, `tinta`, `tiza` | todo lo demás | — |

- **The Yellow Never Reports Rule:** si algo amarillo no es el logo, el primario o "estás acá", está mal.
- **The Pavonado Selects Rule:** lo elegido por el usuario va en el color de selección con texto blanco.
- **The Three Paints Rule:** el semáforo sólo habla cuando el dato **es** estado. Un monto o una cantidad se pintan en neutro/marca con la etiqueta al lado. Estados de registro que no son salud (abierto, pausa, perdido) usan chips neutros o "fuerte".
- El "ámbar" del semáforo es **naranja** a propósito: si la marca es amarilla, el aviso no puede ser amarillo.

**Familias de cuatro pasos** para cada color de estado: `base` (relleno, punto), `-tinta` (texto sobre claro), `-claro` (acento, texto sobre oscuro), `-velo` (fondo de chip/aviso). Un aviso de éxito = `bg-verde-velo` + borde `verde/35` + texto `verde-tinta` + insignia `bg-verde text-white`. Sobre `-velo` el texto va siempre en `-tinta`.

## 2. Tipografía como escala cerrada

Una sola familia trabajada por peso da carácter sin ruido (Corralap: Montserrat). Definí la escala y no salgas de ella:

| Rol | Tamaño / peso | Uso |
|---|---|---|
| Display | `clamp(26px, 8.6vw, 64px)` / 800, lh 1 | **una** cifra héroe por pantalla (el pipeline activo) |
| Headline | 28px móvil · 34px `sm+` / 800 | título de vista (va solo) |
| Title | 18–20px / 800 | paneles, diálogos, estados vacíos |
| Body | **15px** / 400 | tamaño de trabajo: celdas, campos, navegación |
| Body strong | 15px / 700 | nombre del registro en tarjetas y listas |
| Meta | 14px / 400–600 | cliente, etapa, encabezados de columna |
| Label | 13px / 600 | chips, ayudas y errores de campo — **piso de lectura** |
| Rótulo | 13px / 700, +0.08em, mayúsculas | sólo grupos dentro de desplegables y paleta ⌘K |

Utilidades: `.titular` (800, `-0.025em`, `line-height 1.1`, `text-wrap: balance`), `.rotulo`, `.cifra` (`font-variant-numeric: tabular-nums lining-nums`). **Todo número lleva `.cifra`** para que no "baile" al actualizarse o animarse. Las cifras en tarjetas se escalan con el contenedor (`@container` + `text-[clamp(13px,8cqi,16px)]`) antes de cortarse.

**The Lonely Title Rule:** el título de vista va solo; sin bajadas ni textos explicativos. El contexto lo dan los datos.

## 3. Forma, espacio y profundidad

- **Radios escalonados por tamaño:** 5px (ladrillos de gráfico) · 8px (botón de ícono, segmento interno) · **10px todo lo que se toca** · 12px tarjetas y avisos · 16px paneles, tablas, diálogos · píldora para chips. En celular el diálogo es *bottom sheet*: sólo esquinas superiores.
- **Alturas:** controles 44px (`h-11`), `sm` 36px, `lg` 48px; chips 28px; filtros 36px. Objetivo táctil mínimo 44×44.
- **Espaciado** en 6/8/12/16px dentro de un bloque, 24px entre bloques, paneles con 20px (móvil) / 24px.
- **Sombras con vocabulario:** `suave` (reposo) y `alzada` (lo que flota: diálogos, avisos, desplegables, tarjeta levantada) tintadas con el color oscuro de marca, más el **halo de foco de campo** (`0 0 0 3px rgb(tinta/.14)`). **The Only-What-Floats Rule:** la alzada es sólo para lo que está por encima del contenido.
- **Textura con mesura:** superficies oscuras grandes con grano de ruido fractal al ~7% (SVG inline como `background-image`). Textura, no dibujo.

## 4. Layout responsive: rutas, no paneles

- **Desde `lg` (1024px):** riel fijo oscuro de 248px (logo, buscador ⌘K de 44px, ítems de 44px, activo en color de marca); contenido centrado hasta 1400px, márgenes 40px.
- **Debajo de `lg`:** barra superior de 56px + **barra de pestañas inferior** de 64px con 5 destinos (activo = ícono dentro de píldora de marca 48×28). El contenido reserva `96px + env(safe-area-inset-bottom)` abajo.
- **Rutas, no drawers:** detalle, alta y edición son páginas con "← volver" arriba del título. Sólo se superponen: diálogo de confirmación, desplegables, calendario, paleta ⌘K.
- **Cero desborde horizontal de página** en cualquier ancho. Estrategias: tablas anchas → **lista compacta de un renglón** debajo de `xl`; filtros en pastillas que se deslizan de costado en móvil y bajan de renglón desde `md`; la columna principal de una tabla absorbe el ancho y recorta (`w-full max-w-0` + `truncate`); tableros tipo kanban con `snap-x` en móvil (columnas de `84vw`) y grilla en `xl`.
- **Pie de formulario pegajoso** en móvil (sobre la barra inferior, con fondo `suelo/95` + `backdrop-blur`), estático en escritorio.
- `viewport-fit=cover` + `env(safe-area-inset-*)` en todo lo anclado a los bordes.

## 5. Movimiento con propósito

Animá para **explicar** (de dónde viene algo, qué cambió, cuánto vale), nunca para decorar. Reglas:
- Tokens de animación en `@theme` (`--animate-aparecer`, `--animate-subir`, `--animate-desplegar`) y una curva de salida única: `--ease-salida: cubic-bezier(0.16, 1, 0.3, 1)`.
- **Duraciones:** 150ms cambios de color/borde · 160ms menús · 180ms fundidos · 260ms diálogos y avisos · 420–480ms marcas de gráfico · 650ms conteo de cifras · 700ms tope absoluto de una secuencia.
- **Escalonado** 30–60ms por elemento con techo (Corralap: 40ms, techo 220ms) para que 30 barras no tarden 1,2 s.
- **Presión:** botones `active:scale-[0.98]`. **Arrastre:** la tarjeta se levanta (rotación 2–3°, escala 1.03, sombra profunda), el hueco queda punteado, la columna destino se resalta con un anillo interior, y al soltar vuelve con 220ms.
- **Salidas:** lo que entra animado también debería salir animado (avisos, diálogos, menús). Es la brecha más común; ver `references/movimiento.md`.
- **Loader de marca** en vez de spinner genérico para cargas de vista (Corralap: los cinco ladrillos del logo se encienden de a uno). Spinner chico sólo dentro de botones.
- **`prefers-reduced-motion`** global: duraciones a 1ms y `animation-delay: 0`; los gráficos se dibujan directo en su estado final, las cifras saltan al valor, el loader queda quieto y lleno.

## 6. Formularios y feedback

- Etiqueta arriba (14px/600) con asterisco rojo `aria-hidden` si es obligatorio; ayuda o error debajo (13px). El error **reemplaza** a la ayuda, no se apila.
- Estados de campo: reposo (borde neutro fuerte) → hover (borde medio) → foco (borde tinta + halo 3px) → error (borde rojo + mensaje `rojo-tinta` 600) → deshabilitado (`chapa-2` + texto `tiza`).
- **Máscaras que ayudan mientras se escribe** (CUIT con guiones, prefijo `$`, sufijo de unidad) y **validaciones que distinguen error de advertencia**: "Faltan dígitos: son 11" bloquea; "el dígito verificador no coincide" avisa pero deja guardar.
- Mensajes cortos, en segunda persona y accionables ("Elegí el cliente", "Poné un nombre", "No puede superar al minorista"). Nunca códigos crudos.
- **Opciones visibles pero no elegibles** con el motivo en la línea secundaria ("Inactivo: no se le puede presupuestar") en vez de esconderlas.
- **Avisos (toasts):** abajo a la derecha en escritorio (400px), encima de la barra inferior en móvil; máximo 3 a la vez; éxito/aviso/info ~4,5s, error ~7s; cada tono con su insignia redonda (tilde, cruz, triángulo, "i").
- **Estados vacíos** con ilustración del rubro, título y, si aplica, una acción. **Tablero sin datos** en un gráfico: recuadro punteado con "Sin datos en este período".
- **Confirmaciones destructivas** en diálogo con ícono en `-velo`, botón `peligro` y "Cancelar" fantasma a la izquierda.

## 7. Accesibilidad medida (AA como piso)

- Texto ≥ 4.5:1; texto grande (≥ 24px o ≥ 18.66px bold) y **bordes/íconos que identifican un control ≥ 3:1** (WCAG 1.4.11). Medí, no estimes: ver tabla en `references/auditoria.md`.
- **Foco visible siempre:** `:focus-visible { outline: 2.5px solid var(--color-tinta); outline-offset: 2px }` y sobre superficies oscuras `outline-color` de marca.
- Nada depende sólo del color (el semáforo lleva etiqueta o texto "hace N días"), ni sólo del hover (todo tooltip también aparece con foco), ni sólo del puntero (arrastrar tiene alternativa de teclado y un botón "pasar a la siguiente etapa").
- Enlace "Saltar al contenido" como primer foco.

## Flujo de trabajo

1. **Diagnóstico:** recorré el *journey* principal (en Corralap: abrir → ver qué se enfría → llamar → registrar). Marcá fricciones, jerarquías rotas y lo que sobra de texto.
2. **Tokens primero:** auditá voces de color, familias, escalas y contraste antes de tocar pantallas. Todo valor arbitrario (`text-[#7d8a92]`, `bg-[#e2e6e4]`) es un token faltante.
3. **Layout:** proponé la distribución por breakpoint justificando cada decisión y verificá cero desborde a 320px.
4. **Movimiento y feedback:** asigná a cada cambio de estado su animación del catálogo (entrada **y** salida) y su mensaje.
5. **Documentá:** mantené un `DESIGN.md` con tokens, reglas con nombre, Do's & Don'ts; y una página interna `/sistema` que muestre los componentes vivos.
6. **Entrega:** clases Tailwind exactas con tokens, foco, movimiento reducido y objetivos táctiles resueltos.

Al auditar, priorizá: (1) una voz de color usada para otra (marca como estado, estado como decoración); (2) contraste bajo AA, incluido placeholder y bordes de control, y foco invisible; (3) desborde horizontal u objetivos táctiles < 44px; (4) animaciones sin `prefers-reduced-motion`, sin salida o de más de 700ms; (5) valores sueltos donde debería haber un token; (6) feedback ausente o mensajes crudos. El checklist completo con correcciones está en `references/auditoria.md`.

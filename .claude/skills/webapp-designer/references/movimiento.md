# Movimiento: catálogo, reglas y recetas

Principio: cada animación responde una pregunta del usuario. *¿De dónde salió esto?* (subir, desplegar) · *¿Qué cambió?* (color 150ms, conteo) · *¿Cuánto vale?* (barra que crece desde su base) · *¿Está pasando algo?* (loader) · *¿Dónde lo suelto?* (columna resaltada). Si no responde nada, sacala.

## Catálogo de Corralap (lo que ya tiene la app)

| Nombre | Qué hace | Duración / curva | Dónde |
|---|---|---|---|
| `aparecer` | fundido de opacidad | 180ms ease-out | fondo velado de diálogo, tooltips, globo del embudo |
| `subir` | +12px → 0 con fundido | 260ms salida | diálogos, avisos (toasts) |
| `desplegar` | −4px y 98% → 100% | 160ms salida | desplegables, menú ⋯, calendario |
| `ladrillo` | opacidad .12 → 1 → .12 en bucle, desfasado 0,2s por ladrillo | 1,5s | loader de marca (logo que se "construye") |
| presión | `active:scale-[0.98]` | 150ms | todos los botones |
| color / borde / sombra | `transition-[background-color,border-color,box-shadow]` | 150ms | hover y foco de controles |
| switch | la perilla se desliza `translate-x-5` | 200ms salida | interruptores |
| chevron | `rotate-180` al abrir | 150ms | disparador de desplegable |
| `graf-crecer-y` | `scaleY(0) → 1` con `transform-origin` en la base | 480ms salida | columnas de gráficos |
| `graf-crecer-x` | `scaleX(0) → 1` desde la izquierda | 480ms salida | barras horizontales de ranking |
| `graf-trazar` | `stroke-dashoffset 1 → 0` con `pathLength=1` | 700ms `--ease-trazo` | líneas de tendencia |
| `graf-fundido` / `graf-celda` | fundido | 420 / 320ms | etiquetas, marcas de mediana, celdas de mapa de calor |
| conteo de cifras | valor anterior → nuevo, ease-out cúbico | 650ms (rAF) | indicadores (`StatTile`) |
| arrastre | tarjeta rotada 2,5°, escala 1.03, sombra levantada; hueco punteado; vuelta 220ms salida | — | kanban |
| hover de tarjeta | borde a `linea-fuerte`, sombra a `alzada` | 150ms | tarjetas de presupuesto |

## Keyframes de gráficos

```css
@keyframes graf-crecer-y { from { transform: scaleY(0) } }
@keyframes graf-crecer-x { from { transform: scaleX(0) } }
@keyframes graf-trazar   { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@keyframes graf-aparecer { from { opacity: 0 } }

@layer components {
  .graf-col     { transform-box: fill-box; transform-origin: 50% 100%; animation: graf-crecer-y 480ms var(--ease-salida) both; }
  .graf-col-abajo { transform-origin: 50% 0%; }   /* valores negativos crecen hacia abajo */
  .graf-barra   { transform-origin: 0 50%; animation: graf-crecer-x 480ms var(--ease-salida) both; }
  .graf-linea   { stroke-dasharray: 1; animation: graf-trazar 700ms var(--ease-trazo) both; } /* requiere pathLength="1" en el <path> */
  .graf-fundido { animation: graf-aparecer 420ms ease-out both; }
  .graf-celda   { animation: graf-aparecer 320ms ease-out both; }
}
```

Claves: `transform-box: fill-box` hace que el origen sea la propia barra en SVG (sin eso crece desde la esquina del SVG). `pathLength="1"` normaliza el trazo para que `dasharray: 1` funcione con cualquier largo.

## Escalonado con techo

```ts
/** 40 ms por marca, nunca más de 220 ms de demora: la última barra termina a ~700 ms. */
export const stagger = (i: number, step = 40, cap = 220) => `${Math.min(i * step, cap)}ms`;
// <path className="graf-col" style={{ animationDelay: stagger(i) }} />
```

## Conteo de cifras

Contá **desde el valor anterior** (no desde 0) para que un filtro que cambia el total muestre la diferencia. El lector de pantalla recibe el valor final, no los intermedios:

```tsx
<p className="cifra titular">
  <span aria-hidden>{format(animated)}</span>
  <span className="sr-only">{format(value)}</span>
</p>
```

## Salidas (brecha a cerrar)

En Corralap los avisos, diálogos y menús **entran** animados pero **desaparecen de golpe** al desmontarse. Dos recetas:

**A. Con estado (React, funciona en todos lados).** Marcá el ítem como "saliendo", aplicá la animación y desmontá al terminar:

```css
@theme {
  --animate-bajar: bajar 180ms ease-in both;
  @keyframes bajar { to { opacity: 0; transform: translateY(8px) scale(0.98) } }
}
```
```tsx
// Toast: dismiss → setItems(it => it.map(t => t.id === id ? { ...t, leaving: true } : t))
<div className={t.leaving ? 'animate-bajar' : 'animate-subir'}
     onAnimationEnd={() => t.leaving && remove(t.id)} />
```
Con movimiento reducido la animación dura 1ms y `onAnimationEnd` igual se dispara.

**B. CSS nativo con `@starting-style` y `transition-behavior: allow-discrete`** para `<dialog>` y `[popover]` nativos: la transición cubre entrada y salida sin JS. Verificá soporte de navegadores del público antes de depender de esto.

## Reordenamiento de listas (FLIP)

Cuando una tarjeta cambia de columna o una lista se reordena por un filtro, que los elementos **se deslicen** a su nueva posición en vez de saltar: medí `getBoundingClientRect()` antes y después del cambio, aplicá `transform: translate(dx, dy)` invertido y transicioná a `none` (técnica FLIP, 200–260ms `--ease-salida`). Hacelo sólo si la lista tiene < ~50 elementos visibles.

## Movimiento reducido

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
    transition-duration: 1ms !important;
  }
  .graf-col, .graf-barra, .graf-linea, .graf-fundido, .graf-celda { animation: none !important; }
  .graf-linea { stroke-dasharray: none; }
}
```

En JS: `window.matchMedia('(prefers-reduced-motion: reduce)').matches` antes de arrancar un rAF (conteo) o un `scrollIntoView({ behavior: 'smooth' })`. El loader usa `motion-reduce:animate-none` para quedar lleno y quieto.

## Checklist de movimiento

- [ ] Cada animación usa un token o keyframe con nombre, no `duration-[347ms]` suelto.
- [ ] Entradas y **salidas** definidas para todo lo que flota.
- [ ] Nada supera 700ms de principio a fin (escalonado incluido).
- [ ] Sólo se animan `transform` y `opacity` en lo que se mueve (no `width`, `top`, `height`).
- [ ] `prefers-reduced-motion` probado: la pantalla queda completa y correcta sin animar.
- [ ] Nada parpadea más de 3 veces por segundo.

# Auditoría de diseño: checklist y hallazgos típicos

Formato de entrega de un review: **hallazgo → por qué importa → corrección concreta (clases o token)**, ordenado por gravedad. Citá la regla con nombre cuando aplique ("rompe The Yellow Never Reports Rule").

## Contraste medido (Corralap, WCAG 2.x)

| Par | Ratio | Veredicto |
|---|---|---|
| tinta `#16212b` / chapa | 16.32 | ✅ |
| tiza `#5a666f` / chapa · suelo · chapa-2 | 5.89 · 5.05 · 5.43 | ✅ texto |
| niebla `#a9b8c2` / pavonado | 8.02 | ✅ |
| pavonado / amarillo (botón primario) | 10.09 | ✅ |
| blanco / verde · blanco / rojo | 4.96 · 4.89 | ✅ justo (no aclarar más esos tonos) |
| `-tinta` / `-velo` (verde, ámbar, rojo) | 6.38 · 6.05 · 6.23 | ✅ |
| pavonado / ámbar (insignia de aviso) | 5.97 | ✅ |
| **blanco / ámbar** | **2.73** | ❌ nunca texto ni ícono blanco sobre naranja |
| **ámbar como texto sobre chapa** | **2.73** | ❌ usar `ambar-tinta` |
| **placeholder `#7d8a92` / chapa** | **3.55** | ❌ subir a `#66727a` (4.94) |
| **borde de campo `linea-fuerte` / chapa** | **1.72** | ❌ para 1.4.11 un control necesita 3:1 si el borde es lo único que lo delimita: `#8a949b` (3.09) o fondo de campo distinto de la superficie |
| amarillo / chapa (amarillo como texto) | 1.62 | ❌ jamás texto amarillo sobre claro |

Calculá con la fórmula de luminancia relativa de WCAG; no confíes en "se ve bien".

## Checklist

**Color y voces**
- [ ] ¿El color de marca aparece sólo en logo, primario único y ubicación actual?
- [ ] ¿Toda selección usa el color de selección (no la marca, no verde)?
- [ ] ¿El semáforo sólo pinta datos que son salud/resultado, y siempre con etiqueta?
- [ ] ¿Hay un único primario por vista?
- [ ] ¿Todos los colores salen de tokens? Buscá `\[#[0-9a-f]{3,6}\]` y `rgb(` sueltos en clases.

**Tipografía**
- [ ] ¿Nada de lectura baja de 13px? ¿El tamaño de trabajo es 15px?
- [ ] ¿Todo número tiene cifras tabulares?
- [ ] ¿Los títulos de vista van solos, sin bajadas?

**Layout**
- [ ] ¿Cero scroll horizontal de página a 320, 375, 768, 1024 y 1440px?
- [ ] ¿Las tablas pasan a lista compacta en angosto? ¿La columna principal recorta en vez de ensanchar?
- [ ] ¿Todo lo anclado a bordes respeta `safe-area-inset`?
- [ ] ¿Detalle/alta/edición son rutas con "volver", sin drawers?

**Interacción y accesibilidad**
- [ ] ¿Objetivos táctiles ≥ 44×44 (los botones de ícono de 32–36px dentro de filas compensan con área de toque)?
- [ ] ¿Foco visible en todo, incluido sobre oscuro?
- [ ] ¿Todo lo que aparece con hover aparece con foco? ¿Arrastrar tiene alternativa?
- [ ] ¿Enlace "Saltar al contenido"?

**Movimiento**
- [ ] ¿Entradas y salidas definidas? ¿Nada > 700ms? ¿`prefers-reduced-motion` probado?

**Feedback**
- [ ] ¿Cada acción tiene resultado visible (aviso, cambio en pantalla o ambos)?
- [ ] ¿Errores legibles y accionables, con el campo marcado cuando corresponde?
- [ ] ¿Estados vacíos, de carga y de error diseñados para cada vista?

## Hallazgos del review de Corralap (ejemplos de corrección)

1. **Placeholder bajo AA** (`placeholder:text-[#7d8a92]` en Field, Select, DatePicker, chips de correo). → token `--color-placeholder: #66727a`, clase `placeholder:text-placeholder`.
2. **Borde de campo a 1.72:1** sobre tarjetas blancas. → `--color-borde-control` para campos (dejá `linea-fuerte` para botones secundarios, que tienen texto).
3. **Colores sueltos**: `bg-[#e2e6e4]` (columnas), `bg-[#e3e8ed]` (chip tinta y columna destino), sombra de tarjeta levantada y halo de foco repetidos inline. → tokens `columna`, `pavonado-velo`, `shadow-levantada`, `shadow-foco`.
4. **Hex duplicados en JS** (`Punta.tsx`, `palette.ts`) que copian el `@theme`. → un solo módulo de tokens o `fill="var(--color-…)"`.
5. **Sin animaciones de salida** en avisos, diálogos y menús. → receta de salida en `movimiento.md`.
6. **Radio `rounded-[10px]` repetido** en decenas de componentes. → `--radius-control` y `rounded-control`.
7. **Contradicción documental**: la skill de la NSM del repo pide "badge amarillo" para "en riesgo" y un "drawer" de detalle; el sistema de diseño lo prohíbe (naranja para riesgo, rutas en vez de paneles). Mandan el `DESIGN.md` y las reglas con nombre.
8. **Sólo modo claro** (`color-scheme: light`). Si se pide modo oscuro, derivalo de los mismos roles (suelo/chapa/tinta invertidos) y volvé a medir cada par; no lo improvises por pantalla.

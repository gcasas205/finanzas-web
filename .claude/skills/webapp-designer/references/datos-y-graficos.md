# Datos y gráficos

## Un color, un trabajo

| Trabajo | Color | Regla |
|---|---|---|
| **Magnitud** (una serie: montos, cantidades) | oscuro de marca (`#2c3f51`, hover `#16212b`) | nunca verde/rojo por "bueno/malo" |
| **Magnitud en curso / secundaria** | tono suave (`#96aabe`) | con leyenda |
| **Identidad** (varias series) | paleta categórica en **orden fijo**, nunca ciclada | validada para daltonismo; siempre con leyenda |
| **Salud / resultado** | semáforo | sólo cuando el dato **es** salud o resultado, con etiqueta |
| **Magnitud en grilla** (mapa de calor) | rampa secuencial de un solo tono, claro → oscuro | los valores > 0 arrancan en el paso 1 |
| **Diferenciar dos grises** | trama rayada (`repeating-linear-gradient`) | antes que sumar un color |

El color de marca (amarillo) **no aparece** en gráficos: es acción y ubicación.

Paleta categórica de Corralap (acero, vino, agua, violeta, rosa): `#3d78b2 #901a57 #1d97a3 #5c389f #d0639f` — todas ≥ 3:1 sobre blanco y distinguibles entre vecinas con deuteranopía/protanopía. Si agregás un color, volvé a validar el conjunto (ΔE entre adyacentes y contraste).

Rampa secuencial: `#e3ebf3 #bbcdde #96aabe #72899f #506981 #2f4a64 #16212b`. Texto sobre una celda: elegí blanco o tinta según cuál tenga más contraste (calculalo, no lo fijes).

## Anatomía de una tarjeta de gráfico

- `<figure>` con `<figcaption>`: título (18px/800) y, como mucho, la unidad ("en pesos", "días promedio"). Sin bajadas.
- Leyenda con muestras de la **misma forma** que la marca (cuadrito para barras, trazo para líneas, palito para mediana).
- Botón **"Ver tabla" ↔ "Ver gráfico"** (`aria-pressed`): el gemelo accesible con los mismos datos, encabezados `scope`, filas con `th scope="row"` y números alineados a la derecha.
- Vacío: recuadro punteado de 140px de alto, "Sin datos en este período".

## Marcas

- Barras verticales con esquinas superiores de 4px, ancho máximo 24px (62% de la banda). Barras horizontales de 10px de alto con esquina derecha redondeada; ancho mínimo 3px si el valor es > 0.
- Etiqueta de valor sólo en el máximo (evita ruido).
- **Marca de referencia** (mediana, promedio del equipo): palito oscuro de 3px con halo del color de fondo.
- Grilla horizontal fina en `linea`, la línea del 0 en `linea-fuerte`. Ticks "redondos" (1, 2, 2,5, 5 × 10ⁿ; sin 2,5 si son cantidades enteras).
- Etiquetas del eje X: si no entran todas, una de cada *k* contando desde la **más reciente** (la que importa).
- Se dibuja en píxeles reales (midiendo el contenedor) para que el texto no se achique con el SVG.

## Tooltip

Globo oscuro de marca, 13px, aparece con `aparecer`. El **valor manda** (bold, tabular) y la etiqueta lo sigue en `niebla`; la serie se indica con un trazo corto, nunca tiñendo el texto. Se reubica según la posición (a la izquierda si está en el último 38%, a la derecha si está en el primero). Aparece con **puntero y con foco**; el gráfico se recorre con flechas, Inicio, Fin y Escape.

## Cifras destacadas (tiles)

Etiqueta 14px/600 · cifra 800 que cuenta hasta su valor y escala con el contenedor (`clamp(22px,15cqi,34px)`) · variación contra el período anterior **neutra** (flecha + texto, sin semáforo: subir no siempre es bueno) · aclaración corta · mini línea de tendencia decorativa con el último punto marcado. Versión oscura con grano para la cifra principal.

## Embudo en ladrillos (firma de Corralap)

Una hilada de 24px por etapa, un ladrillo (radio 5px, separación 3px) por registro pintado con su salud, ordenados al día → en riesgo → estancado. Número de etapa en círculo oscuro, conteo, monto compacto a la derecha y totales por salud abajo. Cada ladrillo es un enlace con `aria-label` completo ("Título: En riesgo, $ 1,3 M") y muestra el globo al pasar o enfocar. El ancho de la hilada es proporcional a la etapa con más registros.

## Formatos

- Montos: `$ 1.250.000` sin centavos en tarjetas; con centavos en precios unitarios; compactos (`$ 1,3 M`, `$ 850 mil`) en espacios chicos, con espacio duro entre número y unidad.
- Porcentajes enteros, variaciones de tasas en **puntos porcentuales** ("3 p. p."), días con un decimal ("4,5 días", "menos de 1 día").
- Fechas cortas en ejes ("22 jun", "sept", "ene 26" — el año sólo al principio y en enero); largas en tooltips y tablas ("Semana del 22 de junio").
- Tiempo relativo: "hoy", "ayer", "hace 9 días", "sin contacto".

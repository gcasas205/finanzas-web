# Componentes: anatomía y estados

Cada componente se especifica por **forma, estados y comportamiento**. La implementación (props, teclado, ARIA) está en la skill `frontend-engineer`.

## Botones
- Radio 10px, peso 600 (primario 700), alturas 36/44/48, cuadrados de ícono 44/36.
- Variantes: **primario** (marca + texto oscuro, sombra mínima; **uno por vista**, arriba a la derecha), **secundario** (chapa + borde + texto tinta), **fantasma** (sólo texto tiza), **peligro** (rojo + blanco), **éxito** (verde + blanco; sólo para cerrar una venta), **claro** (blanco 10% + borde blanco 15%, para acciones sobre oscuro).
- Estados: hover (color un paso más profundo) · presión `scale(0.98)` · foco con anillo · cargando (spinner 16px a la izquierda del texto + `aria-busy`, deshabilitado) · deshabilitado 45% sin puntero.
- El mismo aspecto se aplica a enlaces (helper de clases), incluidos `tel:` y `mailto:`.

## Campos
- 44px, chapa, borde de control, radio 10px, texto 15px, placeholder con token AA.
- Etiqueta arriba 14px/600, asterisco rojo si obligatorio, ayuda o error abajo 13px.
- Variantes: **con prefijo** (`$`) o **sufijo** (unidad, recortada a ~7 caracteres: "bolsas", "unid.") en cifras tabulares; **búsqueda** con ícono a la izquierda; **stepper** − / + de 40px por lado para el dedo, con el campo numérico en el medio; **contraseña** con botón ojo (`aria-pressed`).
- **Pastillas de destinatarios** (correo): cada dirección es un chip; la inválida se tiñe de rojo con texto "(correo inválido)" para lectores; Enter, coma, espacio o pegar agregan; Retroceso con el campo vacío borra la última.

## Desplegable propio (Select)
- Disparador con el aspecto de un campo y chevron que gira.
- Panel flotante con sombra alzada, radio 12px, animación `desplegar`; **se voltea hacia arriba** si no hay lugar y nunca se sale de la pantalla (margen 8px).
- Buscador arriba cuando hay más de 7 opciones, insensible a acentos.
- Opciones con línea secundaria (CUIT, dirección, precio), **grupos** con rótulo en mayúsculas, ícono opcional, tilde a la derecha en la elegida, fila activa en `chapa-2`.
- Opciones deshabilitadas visibles con el motivo. Opción de acción al final ("+ Nueva obra — cargarla y volver").

## Calendario propio (DatePicker)
- Semana que arranca el lunes, días en castellano, mes con mayúscula inicial.
- Día elegido en color de selección; hoy con anillo interior; días fuera del mes atenuados; fuera de rango al 30%.
- Pie con "Hoy" y "Borrar". Fecha corta en el campo ("21 sept 2026") para que entre en campos angostos.

## Chips
- **Estado:** píldora 28px, 13px/600, fondo `-velo`, punto de 6px del tono. Tonos: verde, ámbar, rojo (salud), fuerte (oscuro, texto blanco), pausa (punto vacío anillado), neutro.
- **Salud:** "Al día · hace 3 días" o sólo "hace 3 días" en listas compactas; el color del texto de días acompaña la salud.
- **Filtro:** píldora 36px con conteo; activa en color de selección con conteo en `niebla`.
- **Segmentado:** contenedor chapa con borde y p-1; segmento activo en color de selección con sombra suave.

## Tarjeta de registro (presupuesto)
- Punta de salud 18px · título 15px/700 hasta dos renglones · cliente en tiza · días teñidos · monto 800 que escala con el ancho de la tarjeta.
- **Toda la tarjeta es el enlace** (pseudo-elemento `after:absolute after:inset-0` sobre el `<Link>`), y las acciones secundarias quedan por encima con `z-[1]` (botón "pasar a la siguiente etapa", asa de arrastre que aparece al pasar el puntero o con foco).

## Tablero kanban
- Columnas con fondo `columna`, encabezado con número de etapa en círculo oscuro, nombre, conteo en píldora y total compacto (sólo para roles que ven montos).
- Columna vacía: recuadro punteado "Vacío"; durante un arrastre dice "Soltá acá".
- Destino activo: fondo `pavonado-velo` + anillo interior de 2px oscuro.
- Móvil: columnas de 84vw con `snap-x`; escritorio `xl`: grilla de 4 columnas con scroll vertical por columna.

## Tabla y lista compacta
- Contenedor chapa, radio 16px, sombra suave. Encabezado en `chapa-2` con etiquetas 14px/600 que ordenan al tocarlas (flecha arriba/abajo, doble flecha atenuada si no está ordenada).
- Filas 15px con divisores, `py-3` (densa `py-2`), fila entera navegable. Paginación abajo: "1–10 de 42" + flechas + "1 / 5".
- Debajo de `xl` se reemplaza por **lista compacta**: punta, nombre, "cliente · etapa", chip de días y monto a la derecha.

## Avisos (toasts)
Radio 12px, sombra alzada, `subir` al entrar (y `bajar` al salir). Insignia redonda 24px: éxito verde con tilde, error rojo con cruz, aviso naranja con triángulo y **texto oscuro** (blanco sobre naranja no llega a 3:1), info chapa con insignia oscura. Título 15px/700, mensaje 14px, botón cerrar 32px. Región `aria-live`.

## Diálogo
Sólo para confirmar algo puntual. Fondo velado oscuro 50% con `aparecer`, panel `subir`, 460px máx. en escritorio, *bottom sheet* en móvil con relleno inferior que respeta el área segura. Ícono en círculo `-velo` del tono de la acción, título 20px, botón de cierre 40px, pie con acciones alineadas a la derecha.

## Navegación
- **Riel:** oscuro con grano, logo, buscador ⌘K (muestra `⌘K` o `Ctrl K` según plataforma), ítems 44px 15px/600 en `niebla` con ícono 20px, activo en marca con texto oscuro 700, segundo grupo por rol separado por divisor.
- **Barra inferior móvil:** 5 pestañas con ícono + etiqueta 11px; la activa con el ícono en píldora de marca.
- **Paleta ⌘K:** grupos con rótulo ("Crear", "Ir a", "Presupuestos"), búsqueda sin acentos, flechas + Enter.

## Loaders y vacíos
- Loader de vista: logo que se construye (bucle). Con etiqueta visible en cargas de página ("Preparando el formulario").
- Error de vista: tarjeta con punta roja, "Algo se trabó", mensaje, "Reintentar" + "Ir al inicio".
- Vacío: ilustración del rubro (obra, clientes, presupuestos, catálogo, búsqueda), título, una línea opcional y acción.

## Firma de marca
Elegí **una o dos formas propias** y repetilas en todo el sistema. En Corralap: el **ladrillo** (logo de cinco ladrillos en traba, embudo de Inicio donde cada presupuesto es un ladrillo de su color de salud, loader) y la **punta** (disco de salud con núcleo más claro; tilde verde sobre oscuro = ganada; cruz sobre gris = perdida). La firma hace que la app sea reconocible sin logo.

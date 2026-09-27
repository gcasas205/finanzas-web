---
name: "frontend-engineer"
description: >-
  Usa esta skill cuando el usuario necesite implementar, auditar o refactorizar frontend moderno con
  Next.js App Router (16), React 19, TypeScript estricto y Tailwind CSS v4. Cubre design systems
  propios (sin Shadcn) con primitivos accesibles (botón, campo, desplegable con búsqueda,
  calendario, menú, diálogo, avisos, tabla TanStack), validaciones de formularios (cuándo validar,
  máscaras, CUIT, teléfonos, montos, errores del backend mapeados a campos), interacciones ricas
  (kanban con @dnd-kit, actualizaciones optimistas con reversión, borradores que sobreviven a la
  navegación, aviso de cambios sin guardar, polling, paleta ⌘K), gráficos SVG propios animados, capa
  de datos tipada contra una API REST, sesión y rutas protegidas, y tests. Usala siempre que haya
  código React/Next de por medio: componentes, formularios, hooks, fetch, accesibilidad o
  performance, aunque no lo pidan con esas palabras.
---

# Ingeniero de Frontend (Next.js / React / Tailwind)

Actuás como Ingeniero Frontend Principal. Escribís código modular, fuertemente tipado, accesible y rápido, y preferís un **design system propio, chico y consistente** antes que librerías de componentes: los primitivos se construyen sobre elementos nativos. Las decisiones visuales (tokens, colores, movimiento) vienen de la skill `webapp-designer`; el contrato de la API, de `backend-engineer`.

Implementación de referencia: **Corralap** (`EloSanz/crm-web-app`, carpeta `frontend/`). Los patrones de acá están tomados de ese código y corregidos donde tenía fallas.

Referencias (leé la que corresponda antes de codear):
- `references/primitivos.md` — código de `usePopover`, `Select`, `Dialog`, `Toast`, `Field` y reglas de ARIA de cada uno.
- `references/validaciones.md` — catálogo de validaciones de formulario con código (CUIT, teléfono AR/WhatsApp, correo, montos es-AR, pares condicionales, adjuntos) y mapeo de errores del backend.
- `references/interacciones.md` — kanban DnD, optimista con reversión, transiciones que piden datos, borradores y retorno, aviso de salida, polling, ⌘K, gráficos SVG animados.
- `references/datos-y-sesion.md` — capa `lib/` tipada, errores, sesión segura, rutas protegidas, anti-patrones de seguridad.
- `references/testing.md` — qué testear y con qué.

## Stack
- **Next.js 16** (App Router), **React 19** (`useId`, `useSyncExternalStore`, Actions, `useOptimistic`), **TypeScript estricto** (nunca `any` ni `@ts-ignore`; si una librería obliga, aislalo en un tipo con nombre y comentario).
- **Tailwind v4** con `@theme`; clases combinadas con `twMerge(clsx(...))`.
- `lucide-react` (íconos), `@tanstack/react-table` (tablas), `@dnd-kit/core` (arrastre), Tiptap (editor de correo). Nada más sin una razón escrita.

## Arquitectura de carpetas

```
app/<entidad>/page.tsx            listado (tabla ≥ xl, lista compacta debajo)
app/<entidad>/nuevo/page.tsx      alta           ─┐ cada tarea es una RUTA
app/<entidad>/[id]/page.tsx       detalle         │ (nada de drawers)
app/<entidad>/[id]/editar/page.tsx edición       ─┘
app/loading.tsx · app/error.tsx   loader de marca · "Algo se trabó" + Reintentar
components/ui/                    primitivos del design system (sin lógica de dominio)
components/<dominio>/             formularios y piezas del dominio (CompanyForm, KanbanBoard…)
lib/api-*.ts                      una función tipada por operación, agrupadas por dominio
lib/format.ts · lib/validators.ts funciones puras (con tests)
lib/useLoad.ts · lib/useUser.ts   hooks de datos y sesión
types/                            única fuente de tipos (Entity, EntityFormData, EntityUpdateData)
```

El **mismo formulario** sirve para alta y edición (`<CompanyForm company={existing ?? undefined} />`): cambia la etiqueta del botón, el destino de "Cancelar" y el aviso de éxito.

## Servidor vs cliente (decidilo a conciencia)
1. **RSC por defecto** cuando la sesión viaja en una **cookie httpOnly**: la página obtiene datos en el servidor y pasa props; `"use client"` sólo en las hojas interactivas.
2. Si la sesión vive en `localStorage` (como Corralap hoy), **todo lo que pide datos queda en cliente** (44 archivos con `"use client"`) y el HTML inicial es un cascarón. Es aceptable para una herramienta interna, pero entonces: loaders a nivel de módulo, `loading`/`error` explícitos en cada vista y una guarda de sesión en cliente. La migración recomendada está en `references/datos-y-sesion.md`.
3. Empujá el estado hacia abajo: un `"use client"` chico dentro de un árbol de servidor es mejor que marcar la página entera.

## Primitivos del design system
Cada primitivo extiende el elemento nativo, reenvía `...props` y `ref`, y expone sus variantes como mapas `Record<Variant, string>` con nombres de dominio (`primario`, `peligro`, `exito`, `claro`). Exportá el helper de clases (`buttonClasses`) para estilar `<Link>`/`<a>` igual.

```tsx
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primario', size = 'md', isLoading = false, disabled, type = 'button', children, ...props }, ref) => (
    <button ref={ref} type={type} disabled={disabled || isLoading} aria-busy={isLoading || undefined}
      className={buttonClasses(variant, size, className)} {...props}>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ));
Button.displayName = 'Button';
```

Inventario mínimo: `Button`/`ButtonLink`, `Field` + `Input`/`Textarea`/`AffixInput`/`SearchInput`/`Stepper`, `Select` (listbox con búsqueda y grupos), `DatePicker` (grilla con teclado), `Menu` (⋯), `Dialog`/`ConfirmDialog`, `ToastProvider`/`useToast`, `DataTable`, `Segmented`, `FilterChips`, `Switch`, `Chip`, `EmptyState`/`LoadingBlock`, `PageHeader`, `FormActions`/`FormCard`. Todos los flotantes comparten **un** hook de posicionamiento (`usePopover`: `fixed`, se voltea, no se sale de pantalla, cierra con clic afuera, reposiciona en scroll/resize, devuelve el foco al disparador).

**Todo control propio acepta `invalid` y lo refleja como `aria-invalid`**, y acepta `aria-describedby`. Un `Select` que se pinta de rojo pero no lo anuncia es un error de accesibilidad.

## Formularios: el `Field` que no se puede usar mal
El `Field` centraliza label, ayuda y error con `useId()`. Para que nadie se olvide de cablear la accesibilidad, **entregá un objeto para esparcir** en vez de piezas sueltas:

```tsx
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const msgId = hint || error ? `${id}-msg` : undefined;
  const control = { id, 'aria-describedby': msgId, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined };
  return (
    <div className={clsx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-sm font-semibold">
        {label}{required && <span className="text-rojo" aria-hidden>*</span>}
      </label>
      {children(control)}
      {(hint || error) && (
        <p id={msgId} className={clsx('mt-1.5 text-[13px]', error ? 'font-semibold text-rojo-tinta' : 'text-tiza')}>{error || hint}</p>
      )}
    </div>
  );
}
// <Field label="CUIT" error={errors.cuit}>{(c) => <Input {...c} value={cuit} onChange={…} />}</Field>
```

En Corralap el `Field` ya calcula `describedBy`, pero los formularios lo descartan (`{({ id, invalid }) => …}`): los errores se ven pero **no se anuncian**. Esparcir `{...c}` lo resuelve de raíz.

Reglas de validación (detalle y código en `references/validaciones.md`):
- **Cuándo:** obligatorios al enviar · formato al salir del campo (`onBlur`) · máscara mientras se escribe · el error de un campo **se limpia al editarlo**.
- **Error vs advertencia:** lo que impide guardar es error (borde rojo, bloquea); lo sospechoso pero posible es ayuda (dígito verificador de CUIT que no coincide).
- **Al fallar el envío, llevá el foco al primer campo con error**; en formularios largos, un resumen `role="alert"` arriba con enlaces a cada campo.
- **Errores del servidor → campo:** el backend devuelve `{ detail, code, field }`; el formulario marca `errors[field]`. No parsees prefijos del mensaje (`message.startsWith('DNI')`) — se rompe al cambiar el texto.
- Validá igual **en el servidor**: la validación de cliente es comodidad, no seguridad.
- Mientras guarda: botón con `isLoading`; al terminar, aviso de éxito con el nombre del registro y `router.push` al detalle; al fallar, aviso de error con el `detail` del backend y el formulario intacto.

## Interacciones que hacen sentir rápida la app
- **Optimista con reversión:** reflejá el cambio al instante, confirmá con el servidor, y si falla **restaurá la foto previa** (no esperes un `reload` completo) y avisá. `useOptimistic` de React 19 o un `setData` con snapshot.
- **Transiciones que piden datos:** mover a "ganada" abre un diálogo con el valor final; a "perdida", con el motivo. El resto se guarda directo. Encapsulalo en un hook (`useStageTransitions`) que devuelva `{ moveTo, dialogs }`.
- **Kanban accesible:** mouse (distancia 6px) y dedo (mantener 220ms, tolerancia 8px) desde toda la tarjeta; teclado **sólo desde un asa** (así Enter en el título sigue navegando); anuncios en castellano; `DragOverlay` con la tarjeta levantada; alternativa sin arrastre (botón "pasar a la siguiente etapa").
- **Borrador y retorno:** si en medio del alta hay que crear otra entidad ("+ Nueva obra"), guardá el borrador en `sessionStorage`, navegá con `?volver=` y volvé con `?borrador=1&nueva_obra=<id>` para preseleccionarla. Validá `volver` para que sea ruta interna (evita redirecciones abiertas).
- **Aviso de cambios sin guardar:** `beforeunload` + intercepción de clics en enlaces internos → diálogo "¿Salir sin enviar?".
- **Polling cortés:** cada N segundos sólo si la pestaña está visible, refresco inmediato al volver a ella, `setTimeout` encadenado (no `setInterval`).
- **Paleta ⌘K / Ctrl K** con búsqueda sin acentos y grupos ("Crear", "Ir a", registros).

## Capa de datos
Una función tipada por operación en `lib/`, `cache: 'no-store'` para datos vivos, errores traducidos (`readError` lee `detail` de FastAPI; "Failed to fetch" → "Sin conexión con el servidor. Revisá tu internet y probá de nuevo."), **401 → limpiar sesión y mandar a `/login?volver=`**. Nada de secretos en `NEXT_PUBLIC_*`: todo lo que empieza así está en el bundle. Detalle y anti-patrones en `references/datos-y-sesion.md`.

## Formato
Formateadores `Intl` **a nivel de módulo** (no por render): `formatARS` sin centavos, `formatARSCents` para precios unitarios, `formatARSCompact` (`$ 1,3 M`, con espacio duro), `formatDaysAgo`, `formatQty` con pluralización de unidades del rubro ("260 bolsas de 25 kg", "18 m³"), `sentenceCase` con locale. Números con `.cifra`. Fechas ISO de solo-día se parsean como **fecha local** (`new Date(y, m-1, d)`), nunca con `new Date('2026-09-24')` (queda en UTC y en Argentina muestra el día anterior).

## Accesibilidad (no negociable)
- Tablas: `<caption className="sr-only">`, `scope="col"`, `aria-sort`, fila clickeable con `tabIndex={0}`, `aria-label` y **Enter y Espacio**.
- Desplegable: disparador `aria-haspopup="listbox"` + `aria-expanded` + `aria-controls`; lista `role="listbox"`, opciones `role="option"` con `aria-selected`/`aria-disabled`, `aria-activedescendant` en el buscador; flechas, Inicio, Fin, Enter, Escape, Tab.
- Calendario: `role="grid"`, celdas con `aria-label` de fecha larga, *roving tabindex*, flechas, RePág/AvPág.
- Diálogo: `role="dialog"` + `aria-modal` + `aria-labelledby`, foco inicial (`data-autofocus`), trampa de Tab, Escape, bloqueo de scroll y **foco devuelto** al cerrar.
- Avisos en región `aria-live="polite"`, `role="alert"` para errores.
- Cifras animadas: valor final en `sr-only`, animación `aria-hidden`.
- Enlace "Saltar al contenido" y `aria-current="page"` en la navegación.

## Auditoría
Señalá, por gravedad: (1) **seguridad en el cliente**: secretos en `NEXT_PUBLIC_*`, sesión inventada por el cliente, tokens por defecto, credenciales de demo en el bundle, redirecciones abiertas; (2) errores crudos al usuario o errores de servidor sin mapear a campos; (3) accesibilidad: `aria-describedby`/`aria-invalid` sin cablear, controles propios sin roles, DnD sin teclado, foco perdido al cerrar flotantes; (4) `"use client"` de más, `fetch` disperso fuera de `lib/`, formateadores creados por render; (5) valores arbitrarios de Tailwind donde hay token; (6) `any`, `eslint-disable` sin justificación; (7) funciones puras sin tests. Entregá el refactor con una línea de por qué por cada cambio.

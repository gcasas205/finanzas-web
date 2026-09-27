# Primitivos: código y contrato de accesibilidad

Patrones tomados de `frontend/src/components/ui/` de Corralap, con las correcciones marcadas **(mejora)**.

## `usePopover`: un solo motor para todo lo que flota

Desplegable, menú ⋯ y calendario comparten posicionamiento. `position: fixed` calculado desde el disparador + portal a `document.body` evita que un `overflow: hidden` de una tabla o tarjeta recorte el panel.

```ts
'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface PopoverPosition { top: number; left: number; width: number; maxHeight: number; placement: 'abajo' | 'arriba' }

export function usePopover<T extends HTMLElement = HTMLButtonElement>(
  { minWidth = 0, maxHeight = 340, align = 'start' }: { minWidth?: number; maxHeight?: number; align?: 'start' | 'end' } = {},
) {
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPosition | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, gap = 6, margin = 8;
    const width = Math.min(Math.max(r.width, minWidth), vw - margin * 2);
    let left = align === 'end' ? r.right - width : r.left;
    left = Math.max(margin, Math.min(left, vw - width - margin));          // nunca se sale por los costados
    const below = vh - r.bottom - gap - margin, above = r.top - gap - margin;
    const placeBelow = below >= Math.min(maxHeight, 220) || below >= above; // se voltea si abajo no entra
    const room = placeBelow ? below : above;
    setPos({ top: placeBelow ? r.bottom + gap : r.top - gap, left, width,
             maxHeight: Math.max(160, Math.min(maxHeight, room)), placement: placeBelow ? 'abajo' : 'arriba' });
  }, [align, maxHeight, minWidth]);

  useLayoutEffect(() => { if (open) measure(); }, [open, measure]);   // mide antes de pintar: sin salto

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);                   // captura: también scroll de contenedores
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, measure]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) requestAnimationFrame(() => triggerRef.current?.focus()); // Tab cierra SIN devolver el foco
  }, []);

  return { triggerRef, panelRef, open, setOpen, close, pos };
}

export function popoverStyle(pos: PopoverPosition | null): CSSProperties {
  if (!pos) return { position: 'fixed', visibility: 'hidden', top: 0, left: 0 };
  return { position: 'fixed', left: pos.left, width: pos.width, maxHeight: pos.maxHeight,
           ...(pos.placement === 'abajo' ? { top: pos.top } : { bottom: window.innerHeight - pos.top }) };
}
```

Si el proyecto ya usa Floating UI, reemplazá `measure` por `computePosition` con `flip`/`shift`; el contrato (portal, fixed, cierre, foco) es el mismo.

## `Select`: listbox con búsqueda

Contrato:
- Disparador `<button type="button">` con `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` (sólo abierto), `aria-invalid` **(mejora: Corralap sólo pinta el borde)**, `aria-describedby`.
- Flecha ↓/↑ con el disparador enfocado abre la lista.
- Panel: buscador si `options.length > 7` (o `searchable`), lista `role="listbox"` con `tabIndex={-1}`.
- Opción `role="option"`, `id` estable, `aria-selected`, `aria-disabled`; encabezados de grupo con `role="presentation"`.
- Foco: en el buscador (con `aria-activedescendant` apuntando a la opción activa) o en la lista.
- Teclas: ↑ ↓ (circular), Inicio, Fin, Enter elige, Escape cierra y devuelve foco, Tab cierra sin devolverlo.
- La opción activa se lleva a la vista con `scrollIntoView({ block: 'nearest' })`; el puntero también la mueve (`onPointerMove`).
- Búsqueda insensible a acentos y mayúsculas sobre `label + hint + group`:

```ts
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const filtered = q ? options.filter((o) => norm(`${o.label} ${o.hint ?? ''} ${o.group ?? ''}`).includes(norm(q))) : options;
```

- **Mejora:** saltá las opciones deshabilitadas al moverte con flechas (hoy se puede "activar" una deshabilitada y Enter no hace nada).
- Opción de acción ("+ Nueva obra") con un `value` centinela (`'__nuevo__'`) que el `onChange` del formulario intercepta.

## `Dialog`

```tsx
useEffect(() => {
  const prevFocus = document.activeElement as HTMLElement | null;
  const { overflow } = document.body.style;
  document.body.style.overflow = 'hidden';                               // bloquea el scroll de fondo
  const raf = requestAnimationFrame(() => {
    const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button:not([data-cerrar])');
    (target ?? panelRef.current)?.focus();                               // foco inicial útil, no la X
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCloseRef.current();                        // ref: no re-suscribir en cada render
    if (e.key !== 'Tab' || !panelRef.current) return;
    const f = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  };
  document.addEventListener('keydown', onKey);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = overflow;
    prevFocus?.focus?.();                                                // devuelve el foco
  };
}, []);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
```

Panel `role="dialog" aria-modal="true" aria-labelledby={titleId}`, portal, fondo velado con `onClick={onClose}` y `aria-hidden`. Móvil: `items-end` + `rounded-t-2xl` + `pb-[max(1.5rem,env(safe-area-inset-bottom))]`. **Mejora:** incluí `a[href]` y `select` en `FOCUSABLE` (Corralap los omite), y considerá `<dialog>` nativo con `showModal()`, que da trampa de foco e `inert` en el fondo gratis.

## `Toast` con salida animada

```tsx
type Tone = 'exito' | 'error' | 'aviso' | 'info';
interface Item { id: number; tone: Tone; title: string; message?: string; leaving?: boolean }

const DURATION: Record<Tone, number> = { exito: 4500, info: 4500, aviso: 4500, error: 7000 };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);
  const leave = useCallback((id: number) => setItems((p) => p.map((t) => (t.id === id ? { ...t, leaving: true } : t))), []);
  const remove = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);
  const push = useCallback((tone: Tone, title: string, message?: string) => {
    const id = nextId.current++;
    setItems((p) => [...p.slice(-2), { id, tone, title, message }]);    // máximo 3 en pantalla
    window.setTimeout(() => leave(id), DURATION[tone]);
  }, [leave]);
  const api = useMemo(() => ({
    success: (t: string, m?: string) => push('exito', t, m), error: (t: string, m?: string) => push('error', t, m),
    warning: (t: string, m?: string) => push('aviso', t, m), info: (t: string, m?: string) => push('info', t, m),
  }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 z-[90] flex flex-col gap-2 bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-auto lg:right-6 lg:w-[400px]">
        {items.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
               className={clsx('pointer-events-auto …', t.leaving ? 'animate-bajar' : 'animate-subir')}
               onAnimationEnd={() => t.leaving && remove(t.id)}>
            {/* insignia, título, mensaje, botón cerrar → onClick={() => leave(t.id)} */}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

`useToast()` lanza un error claro si se usa fuera del proveedor. **Mejora opcional:** pausar el temporizador con `onPointerEnter`/foco para que un error largo se pueda leer.

## `DataTable` (TanStack)

- Orden por columna con botón dentro del `<th>` (el `th` lleva `aria-sort`), paginación "1–10 de 42", `autoResetPageIndex`.
- Props de diseño: `dense`, `grow` (columna `w-full max-w-0` que recorta), `alignRight`, `caption` obligatorio, `emptyText`.
- Fila navegable: `tabIndex={0}`, `aria-label={rowLabel(row)}`, `onKeyDown` con **Enter y Espacio** (**mejora**: Corralap sólo Enter) y `preventDefault` en Espacio para que no haga scroll.
- **Mejora:** tipá `columns` con el tipo de la librería en vez de `any[]` con `eslint-disable`.

## `Stepper` (cantidad para el dedo)

`role="group"` con `aria-label`, botones − / + con `aria-label` ("Restar"/"Sumar"), − deshabilitado en el mínimo, campo `type="number" inputMode="numeric"` al medio que nunca queda por debajo de `min`. Para decimales (m³), usá `inputMode="decimal"` y `step` fraccional.

## `Switch`

`<button role="switch" aria-checked>` con el rótulo **dentro** del botón (toda la fila es clickeable y el nombre accesible sale solo), `min-h-11`.

## `Segmented` y `FilterChips`

Botones con `aria-pressed` dentro de `role="group" aria-label`. Si el segmento navega, es `<Link aria-current="page">`. Los conteos van con `.cifra`.

## Checklist de un primitivo nuevo

- [ ] Extiende el elemento nativo y reenvía `ref` y `...props`; `displayName`.
- [ ] Acepta `className` y lo fusiona con `twMerge`.
- [ ] Acepta `id`, `aria-describedby`, `invalid`/`aria-invalid`, `disabled`.
- [ ] Teclado completo según el patrón ARIA APG del rol.
- [ ] Foco visible y devuelto al cerrar si flota.
- [ ] Objetivo táctil ≥ 44px (o área de toque ampliada).
- [ ] Se ve en `/sistema` con todos sus estados.

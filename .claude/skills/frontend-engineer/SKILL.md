---
name: "frontend-engineer"
description: Usa esta skill cuando el usuario necesite implementar, auditar o refactorizar frontend moderno con Next.js App Router (16), React 19, TypeScript estricto y Tailwind CSS v4. Cubre design systems propios (sin Shadcn), primitivos accesibles con forwardRef, capa de datos tipada contra una API REST externa, RSC vs Client Components, y accesibilidad real (teclado, ARIA, lectores de pantalla).
---

# Ingeniero de Frontend (Next.js / React / Tailwind)

Actúas como un Ingeniero Frontend Principal. Escribes código modular, fuertemente tipado, accesible y rápido. Prefieres un **design system propio, pequeño y consistente** antes que arrastrar librerías de componentes: los primitivos se construyen a mano sobre elementos nativos.

## Stack
- **Framework:** Next.js 16 (App Router). React 19 (`useId`, `useSyncExternalStore`, Actions).
- **Lenguaje:** TypeScript estricto. Nunca `any` ni `@ts-ignore`.
- **Estilos:** Tailwind CSS v4 (config en CSS con `@theme`, ver skill `webapp-designer`). Combinar clases con `twMerge(clsx(...))`.
- **Iconos:** `lucide-react`.
- **Datos:** API REST externa vía `fetch` tipado (no ORM en el cliente). Tablas con `@tanstack/react-table`, drag & drop con `@dnd-kit/core`, editor con Tiptap cuando haga falta.

## Componentes de servidor vs cliente
1. **RSC por defecto.** Un componente lleva `"use client"` en la primera línea **solo** si necesita estado, efectos, `Context`, o listeners (`onClick`, `onChange`). Si no, es de servidor.
2. **Empujá el estado hacia abajo.** Un `"use client"` chico dentro de un árbol de servidor es mejor que marcar toda la página como cliente.
3. **Data fetching:** obtené datos en Server Components y pasalos como `props`; o, si la vista es interactiva de punta a punta, centralizá las llamadas en una **capa `lib/` tipada** (ver abajo) y consumila desde el cliente.
4. **Loading / error:** usá `loading.tsx` y `error.tsx`, o `<Suspense>` con skeletons para lo lento.

## Primitivos del design system
Construir cada primitivo sobre el elemento nativo, con variantes como mapas y clases fusionadas de forma segura.

```tsx
import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'primario' | 'secundario' | 'fantasma' | 'peligro';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold ' +
  'transition-colors active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none cursor-pointer';

const variants: Record<ButtonVariant, string> = {
  primario: 'bg-amarillo text-pavonado hover:bg-amarillo-2',
  secundario: 'border border-linea-fuerte bg-chapa text-tinta hover:bg-chapa-2',
  fantasma: 'text-tiza hover:text-tinta hover:bg-chapa-2',
  peligro: 'bg-rojo text-white hover:bg-rojo-tinta',
};
const sizes: Record<ButtonSize, string> = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[15px]', lg: 'h-12 px-5' };

export function buttonClasses(v: ButtonVariant = 'primario', s: ButtonSize = 'md', cn?: string) {
  return twMerge(clsx(base, variants[v], sizes[s], cn));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: ButtonSize; isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primario', size = 'md', isLoading = false, disabled, type = 'button', children, ...props }, ref) => (
    <button ref={ref} type={type} disabled={disabled || isLoading} aria-busy={isLoading || undefined}
      className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </button>
  )
);
Button.displayName = 'Button';
```

Reglas de los primitivos:
- **Extendé el elemento nativo** (`extends React.ButtonHTMLAttributes<...>`) y reenviá `...props`: quien lo use no pierde `onClick`, `aria-*`, `name`, etc.
- **`forwardRef` + `displayName`** siempre: los primitivos deben aceptar `ref`.
- **Variantes con nombres de dominio** (`primario`, `peligro`, `exito`) mapeadas a clases con `Record<Variant, string>`; nunca condicionales sueltas de clases.
- Exportá el **helper de clases** (`buttonClasses`) para poder estilar un `<Link>` o `<a>` con la misma apariencia sin duplicar.
- El color sale de **tokens del tema** (`bg-amarillo`, `text-tinta`), no de valores arbitrarios.

## Formularios accesibles con render-prop
Un `Field` centraliza label, hint, error y **cablea la accesibilidad** (`htmlFor`, `aria-describedby`, `aria-invalid`) vía `useId()` y un render-prop:

```tsx
export function Field({ label, hint, error, required, children }: {
  label: string; hint?: string; error?: string; required?: boolean;
  children: (p: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 flex gap-1 text-sm font-semibold">
        {label}{required && <span className="text-rojo" aria-hidden>*</span>}
      </label>
      {children({ id, describedBy: hintId, invalid: Boolean(error) })}
      {(hint || error) && (
        <p id={hintId} className={clsx('mt-1.5 text-[13px]', error ? 'text-rojo-tinta font-semibold' : 'text-tiza')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
// Uso: <Field label="CUIT" error={err}>{({ id, describedBy, invalid }) =>
//   <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} />}</Field>
```

## Accesibilidad (no negociable)
- Toda tabla de datos: `<caption className="sr-only">`, `scope="col"`, `aria-sort` en los encabezados ordenables, y si la fila es clickeable → `tabIndex={0}`, `aria-label`, y manejar `Enter` en `onKeyDown` además del `onClick`.
- Drag & drop (`@dnd-kit`): configurá `KeyboardSensor` + `TouchSensor` con `activationConstraint` (`delay`/`tolerance`) para no romper el scroll táctil, y pasá `accessibility.announcements` (texto para lector de pantalla al levantar, mover y soltar) e instrucciones de teclado.
- Feedback: los toasts van en una región `aria-live="polite"`, con `role="alert"` para errores y `role="status"` para el resto.
- Foco visible siempre; no elimines el outline sin reemplazarlo.

## Capa de datos tipada (`lib/`)
Contra una API REST externa (FastAPI, ver skill `backend-engineer`), centralizá el acceso en `lib/` en vez de esparcir `fetch` por los componentes:

```ts
export function buildApiUrl(endpoint: string, params?: Record<string, string | undefined | null>): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!params) return `${base}${path}`;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') sp.append(k, v);
  const qs = sp.toString();
  return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}

/** Traduce el error del backend (FastAPI usa `detail`: string o lista de validación). */
export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return String(body.detail[0].msg);
  } catch { /* sin JSON */ }
  return fallback;
}

export async function fetchCompanies(params?: { q?: string }): Promise<Company[]> {
  const res = await fetch(buildApiUrl('/api/companies', params), { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res, 'Error al obtener empresas'));
  return res.json();
}
```

Convenciones:
- **Una función por operación** (`fetchX`, `createX`, `updateX`, `deleteX`), con tipos de entrada (`XFormData`) y de salida (`X`) importados de `types/`.
- `cache: 'no-store'` para datos vivos del CRM.
- El mensaje de error viene del backend vía `readError` y se muestra en un toast; **nunca** se filtra un error crudo al usuario.
- Nada de secretos en el cliente: cualquier `NEXT_PUBLIC_*` es visible. Tokens de sesión van a `Authorization` en runtime, no hardcodeados.

## Estado externo y formato
- Para leer `localStorage`/eventos del navegador de forma reactiva y SSR-safe, usá `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` con `getServerSnapshot` devolviendo `null`. No leas `localStorage` en render.
- Los formateadores (`Intl.NumberFormat`, fechas) se crean **una vez a nivel de módulo**, no por render. Números en tablas y cifras con `font-variant-numeric: tabular-nums`.

## TypeScript
- `interface` para props de componentes; `type` para uniones/intersecciones (`type ButtonVariant = 'a' | 'b'`).
- Tipá el retorno de hooks y funciones de la capa de datos.
- Deriva tipos de un solo lugar (`types/`), sin redefinir la misma forma en dos archivos.

## Auditoría
Al revisar código señalá, en orden de gravedad: (1) `"use client"` de más o mal ubicado y re-renders evitables; (2) `fetch` disperso en vez de `lib/` tipada, y errores crudos mostrados al usuario; (3) fallas de accesibilidad (labels sin asociar, tablas sin `scope`/`caption`, DnD sin teclado, foco invisible); (4) valores arbitrarios de Tailwind donde debería haber un token; (5) `any`. Entregá el refactor con una explicación técnica breve del beneficio de cada cambio.

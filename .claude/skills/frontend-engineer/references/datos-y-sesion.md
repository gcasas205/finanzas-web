# Capa de datos y sesión

## `lib/api-*.ts`: una función por operación

```ts
export function buildApiUrl(endpoint: string, params?: Record<string, string | undefined | null>): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';        // '' = mismo origen (rewrite /api → backend)
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== '') sp.append(k, v);
  const qs = sp.toString();
  return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}

interface RequestOptions {
  params?: Record<string, string | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(method: string, endpoint: string, fallback: string, { params, body, signal }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildApiUrl(endpoint, params), {
      method, signal, cache: 'no-store', credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('Sin conexión con el servidor. Revisá tu internet y probá de nuevo.', 0, 'network');
  }
  if (res.status === 401) { onUnauthorized(); throw new ApiError('Tu sesión venció. Ingresá de nuevo.', 401, 'unauthorized'); }
  if (!res.ok) throw await toApiError(res, fallback);         // ver validaciones.md
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const fetchCompanies = (params?: { q?: string; status?: string }, signal?: AbortSignal) =>
  request<Company[]>('GET', '/api/companies', 'Error al obtener empresas', { params, signal });
export const createCompany = (body: CompanyFormData) => request<Company>('POST', '/api/companies', 'No se pudo registrar la empresa', { body });
export const updateCompany = (id: string, body: Partial<CompanyFormData>) => request<Company>('PUT', `/api/companies/${id}`, 'No se pudo guardar', { body });
export const deleteCompany = (id: string) => request<void>('DELETE', `/api/companies/${id}`, 'No se pudo dar de baja');
```

Lo importante es que exista **un solo lugar** con manejo de red, 401 y errores.

Convenciones:
- Tipos de entrada (`XFormData`, `XUpdateData`) y salida (`X`) importados de `types/`, nunca redefinidos.
- La API devuelve decimales como texto (`"9800.00"`): convertí con una función `toNumber` que devuelve `null` si no es finito, no con `Number(x || 0)` disperso.
- Cargas en paralelo con `Promise.all`, y las opcionales por rol con `.catch(() => [])` (un vendedor no puede listar usuarios y la vista no debe romperse por eso).
- Divisiones por dominio (`api.ts`, `api-catalog.ts`, `api-comms.ts`, `api-metrics.ts`) cuando el archivo pasa ~400 líneas.

## Sesión: lo que NO hay que hacer (hallazgos de Corralap)

| Anti-patrón | Por qué es grave | Corrección |
|---|---|---|
| `getAuthHeaders()` **inventa un token de admin** y lo guarda en `localStorage` si no hay sesión | cualquiera que abre la app es administrador sin loguearse | sin sesión → 401 → `/login`. El cliente nunca fabrica credenciales |
| `NEXT_PUBLIC_CRM_API_KEY` con valor por defecto hardcodeado | todo `NEXT_PUBLIC_*` viaja en el JavaScript público: no es un secreto, es decoración | sacar la API key del navegador; si hace falta una clave servidor-a-servidor, que la agregue el **servidor de Next** (route handler / rewrite con header), nunca el bundle |
| Token en `localStorage` | lo lee cualquier script inyectado (XSS) y obliga a renderizar todo en cliente | cookie **httpOnly + Secure + SameSite=Lax** emitida por el backend |
| Credenciales de demo en el bundle (`DEMO_USERS` con contraseñas) | quedan públicas en producción | mostrarlas sólo si `process.env.NEXT_PUBLIC_DEMO === '1'` y que el backend rechace esas cuentas fuera de demo |
| Rol leído de `localStorage` para mostrar/ocultar menús | editable desde la consola | está bien para UX, **siempre** que el backend valide cada permiso (ver `backend-engineer`) |

## Sesión recomendada

1. `POST /api/auth/login` → el backend responde el usuario y setea `Set-Cookie: session=<JWT firmado>; HttpOnly; Secure; SameSite=Lax; Path=/`.
2. El front llama siempre al mismo origen (`/api/...` reescrito por `next.config.ts` hacia el backend), así la cookie viaja sola.
3. `GET /api/auth/me` da el usuario actual; guardalo en un contexto o en `useSyncExternalStore` sobre un store en memoria, no en `localStorage`.
4. Ruta protegida en el borde (Next 16: `proxy.ts`; en Next ≤ 15 se llamaba `middleware.ts` con `export function middleware`):

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has('session');
  const isLogin = req.nextUrl.pathname.startsWith('/login');
  if (!hasSession && !isLogin) {
    const url = new URL('/login', req.url);
    url.searchParams.set('volver', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next|icons|favicon|manifest|apple-icon|icon).*)'] };
```

El proxy sólo mira si **hay** cookie (redirección rápida); la validez la decide el backend en cada pedido. Con esto las páginas pueden volver a ser Server Components que leen datos con la cookie (`cookies()` de `next/headers` reenviada al backend).

5. `onUnauthorized()`: limpiar el estado de usuario y `location.assign('/login?volver=' + encodeURIComponent(location.pathname))`. Tras loguear, `router.replace(safeBackHref(volver, '/'))`.
6. Logout: `POST /api/auth/logout` que borra la cookie en el backend.

Si el proyecto usa Supabase Auth, la cookie la maneja `@supabase/ssr` y el backend valida el JWT de Supabase con su JWKS; el flujo de redirección es el mismo.

## Lectura reactiva de estado del navegador

Para cosas que sí pueden vivir en el navegador (preferencias, vista densa), `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` con `getServerSnapshot` devolviendo `null`, suscribiéndose a `storage` (otras pestañas) y a un evento propio (misma pestaña). Nunca leas `localStorage` durante el render inicial sin esto: rompe la hidratación.

## Permisos en la interfaz

`isManager(user)`, `isAdmin(user)` en `lib/roles.ts` y un `<RequireRole roles={[…]}>` que muestra "No tenés acceso" en vez de una pantalla vacía. Ocultá lo que el rol no puede hacer (reasignar, ver montos totales, indicadores), pero tratá cada 403 del backend como posible y mostralo con su mensaje.

## Checklist

- [ ] Ningún secreto ni credencial en `NEXT_PUBLIC_*` o en el código del cliente.
- [ ] Sin sesión → login; 401 → login con `volver`; 403 → mensaje del backend.
- [ ] Todos los `fetch` pasan por `lib/`; ninguno en componentes.
- [ ] Errores de red traducidos; errores de API con `detail` legible; errores de campo mapeados.
- [ ] Pedidos cancelables (`AbortController`) en vistas que se abandonan rápido o en búsquedas mientras se escribe.
- [ ] Búsqueda mientras se escribe con *debounce* (~250ms) y cancelando el pedido anterior.

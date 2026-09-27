# Auditoría de finanzas-web contra las skills

Fecha: 2026-09-27 · Alcance: backend (`src/app/api`, `src/lib`), frontend (`src/components`, `src/app`) y diseño UI/UX.
Criterio: `backend-engineer`, `frontend-engineer` y `webapp-designer` (`.claude/skills/`), aplicadas **sin migrar el stack** (Next 14 / React 18 / Tailwind 3 / Google Sheets).

Formato: **hallazgo → por qué importa → corrección propuesta**. Prioridad: 🔴 alta · 🟠 media · 🟡 baja. Esfuerzo: S / M / L.

---

## 1. Backend / API

| # | Prio | Hallazgo | Por qué importa | Corrección | Esf. |
|---|---|---|---|---|---|
| B1 | 🔴 | **Login abierto si falta `ALLOWED_EMAILS`** (`api/auth/[...nextauth]/route.ts`: `if (allowed.length === 0) return true`). | Cualquier cuenta de Google entra y lee/escribe tu planilla. La skill pide *fallar cerrado*: sin configuración, no arranca. | Si la lista está vacía, `return false` (o tirar error al iniciar en producción). Validar también que `NEXTAUTH_SECRET` exista. | S |
| B2 | 🔴 | **Fallback silencioso a datos vacíos**: `listTransactions`, `listDolarOps`, etc. atrapan el error y devuelven `[]`; la ruta responde 200 y **lo cachea 3 min**. | Si Sheets falla (cuota, credenciales), la app muestra "sin movimientos" como si fuera real, y lo sigue mostrando después de que se recupera. | Que `lib/sheets` propague el error; la ruta responde 503 `{detail, code:"sheets_unavailable"}` y no cachea. | M |
| B3 | 🔴 | **`PUT /api/transactions` valida y después escribe `rawBody`** (`const tx = rawBody as Transaction`). | La validación no protege nada: campos extra, defaults no aplicados, `fechaPago` sin recalcular. | Usar `parseResult.data`, reusar la misma normalización del POST (extraer `buildTransaction()`), `.strict()` en el schema. | S |
| B4 | 🔴 | **Importación de PDF acepta `transactions` del cliente sin validar** (`JSON.parse(edited)` → `addTransactionsBulk`). | Cualquier forma de objeto termina como fila en la hoja (montos negativos, fechas inválidas, texto arbitrario). | `z.array(TransactionSchema).max(500).safeParse(...)`; 400 si falla. Agregar límite de tamaño (413) y tipo `application/pdf` (415). | S |
| B5 | 🟠 | **`/api/dolar` sin schema Zod**: `normalize(body: any)` con `Number(x) \|\| 0`; `fecha` sin formato; `asigMediano + asigLargo` puede superar `montoUSD`. | Reglas de negocio sólo en el cliente ("Asignaste US$ X de más" es un aviso del front). | `DolarOpSchema` con `fecha` regex, `montoUSD > 0`, `precioARS > 0`, `refine` de asignaciones ≤ monto. | S |
| B6 | 🟠 | **`DELETE` sin validación ni try/catch** (transactions y dolar): `id` puede ser `undefined`; si no existe responde `{ok:false}` con 200. | Errores no distinguibles; 500 con HTML si el body no es JSON. | `z.object({id: z.string().min(1)})`; 404 `not_found` si no existe. | S |
| B7 | 🟠 | **Contrato de errores inconsistente**: `{success, ok, error, details}`, `{ok, error}`, `{error}` según la ruta; `error.message` crudo al cliente. | El front no puede mapear errores a campos ni mostrar mensajes humanos consistentes. | Helper `apiError(status, code, detail, field?)` + `fromZod(error)` que devuelva `{detail, code:"validation", field}`. Mensajes en castellano, trazas sólo en `console.error`. | M |
| B8 | 🟠 | **`POST /api/config` guarda cualquier body** sin validar (días de corte 0–31, TNA ≥ 0, offset de sueldo). | Un valor inválido rompe el cálculo de fechas de pago de toda la app. | `ConfigSchema` con rangos; 400 con `field`. | S |
| B9 | 🟠 | **Las rutas API protegidas redirigen (307 a `/login`)** en vez de 401 cuando vence la sesión. | El `fetch` sigue el redirect, recibe HTML y `r.json()` explota; el usuario ve un error genérico. | En el middleware, para `/api/*` devolver 401 JSON `{detail:"Tu sesión venció…", code:"unauthorized"}`; el front redirige a `/login?volver=`. | S |
| B10 | 🟡 | **`/api/health` expone prefijos de secretos** (`credsPrefix` 30 chars, `sheetIdPrefix`). | Superficie innecesaria; la skill pide no filtrar nada de configuración. | Devolver sólo `{envReady}`. | S |
| B11 | 🟡 | **`.env.example` trae un `GOOGLE_SHEET_ID` que parece real.** | Identifica tu planilla en el repo. | Reemplazar por un placeholder. | S |
| B12 | 🟡 | **Caché en memoria por instancia** (`lib/cache.ts`): en Vercel cada instancia tiene la suya; `cacheInvalidate` sólo limpia la que atendió el POST. | Tras guardar, otra instancia puede servir datos viejos hasta 3 min. | Aceptable para uso personal; documentarlo o bajar TTL tras escrituras / usar `unstable_cache` + `revalidateTag`. | M |
| B13 | 🟡 | **Montos en `float`** (`monto: number`, `Math.round(x*100)/100`). | Errores de redondeo acumulados en totales. | Normalizar a centavos (entero) en la frontera, o redondear siempre con un helper único `toCents()`. | M |
| B14 | 🟡 | **35 usos de `any`**, `strict: false` en `tsconfig`. | Los errores de tipo llegan a producción. | Activar `strict` de a poco (primero `lib/` y `api/`). | L |
| B15 | 🟡 | **Sin tests** para lógica pura crítica (`ahorro-calc`, `dolar-calc`, `calcularFechaPagoTarjeta`, parsers de PDF). | Son las funciones con más reglas y las más fáciles de testear. | Vitest + tests de las funciones puras y de los schemas Zod. | M |

## 2. Frontend / código

| # | Prio | Hallazgo | Por qué importa | Corrección | Esf. |
|---|---|---|---|---|---|
| F1 | 🔴 | **El `fetcher` de SWR no chequea `r.ok`** (`DataProvider`, `ConfigProvider`). | Un 401/500 se toma como datos válidos (`tx.data.transactions` = `undefined` → lista vacía). Sumado a B2, **los errores nunca se ven**. | `fetcher` que tire un `ApiError` con `detail`/`code` si `!r.ok`; 401 → `signIn()`/`/login?volver=`. | S |
| F2 | 🔴 | **Ninguna vista muestra estado de error**: `error` del contexto no se consume en ninguna parte. | Si falla la carga, el usuario ve "Todavía no registraste operaciones". | Componente `ErrorState` ("No pudimos leer tu planilla" + Reintentar) usado en cada vista cuando `error`. | S |
| F3 | 🟠 | **`fetch` disperso en las vistas** (13 llamadas en `Transactions`, `Dolares`, `Settings`, `Import`, `SetupWizard`), cada una con su manejo de `d.ok`/`d.error`. | Duplicación y manejo de errores inconsistente. | `lib/api.ts` con una función tipada por operación (`createTransaction`, `deleteDolarOp`…) y un `readError()` común. | M |
| F4 | 🟠 | **Formularios sin `Field` accesible**: los `<label>` de `Transactions`/`Dolares`/`Settings` no tienen `htmlFor`; no hay `aria-invalid` ni `aria-describedby`; los errores del server no se mapean a campos. | Los lectores de pantalla no asocian etiqueta ni error; al fallar no se lleva el foco al campo. | Primitivo `Field` con `useId` que entrega `{id, aria-describedby, aria-invalid}` para esparcir; foco al primer error. | M |
| F5 | 🟠 | **Modales sin trampa de foco ni foco devuelto** (`Transactions`, `Dolares`, drawer de `AppShell`). Tienen `role="dialog"` y Escape, pero Tab se escapa al fondo. | WCAG 2.4.3; con teclado se pierde el contexto. | Primitivo `Dialog` compartido: foco inicial, trampa de Tab, bloqueo de scroll, devolver foco al disparador. | M |
| F6 | 🟠 | **Borrado con `window.confirm`** nativo. | Sin estilo, sin contexto (qué se borra), bloqueante. | `ConfirmDialog` con descripción del registro y botón de peligro; o borrado optimista con "Deshacer" en el toast. | S |
| F7 | 🟡 | **Formateadores `Intl` creados en cada llamada** (`formatPesos`, `formatUSD`). | Se ejecutan por cada fila en cada render. | Instancias a nivel de módulo. | S |
| F8 | 🟡 | **`aria-current="page"`** ausente en los links de navegación; no hay enlace "Saltar al contenido". | Navegación por teclado/lector. | Agregar ambos en `AppShell`. | S |
| F9 | 🟡 | **Cifras animadas** (`AnimatedNumber`): verificar que el valor final esté en `sr-only` y la animación `aria-hidden`. | El lector anuncia cada paso del conteo. | Patrón de la skill. | S |

## 3. Diseño UI/UX

| # | Prio | Hallazgo | Por qué importa | Corrección | Esf. |
|---|---|---|---|---|---|
| D1 | 🔴 | **El ámbar (marca) cumple tres roles**: botón primario, **selección** (filtro de tipo activo, segmento de moneda) y **decoración** (palabras en itálica de los títulos, badge "USD", "1/3" de cuotas, ícono Info, rótulo "Balance"). | Rompe *The Yellow Never Reports Rule* y *The Pavonado Selects Rule*: el ojo no distingue "acción" de "elegido" de "adorno". | Definir voz de **selección** propia (p. ej. `ink-600` + texto `paper`, o un tono frío); dejar ámbar sólo para logo, primario único y ubicación en la nav. Badge USD y cuotas en neutro. | M |
| D2 | 🟠 | **Tipografía por debajo del piso de lectura**: 81 usos de `text-[8px]`–`text-[12px]` (36 de 10px, 12 de 9px, 2 de 8px), incluida la barra inferior móvil (10px) y el email del usuario (9px). | La skill fija **13px como piso** y 15px como tamaño de trabajo. En celular es ilegible. | Escala cerrada en `tailwind.config` (`label: 13px`, `meta: 14px`, `body: 15px`) y reemplazo de los `text-[Npx]`. | M |
| D3 | 🟠 | **Bordes de campos a 1.65:1** (`border-ink-500` sobre `ink-900`); hairlines a 1.24:1. | WCAG 1.4.11 exige 3:1 cuando el borde es lo único que delimita un control. | Token `borde-control` ≈ `#6B675F` (≥ 3:1) para inputs/selects; hairlines quedan para separadores. | S |
| D4 | 🟠 | **Sólo 4 de 7 destinos en la barra inferior móvil**; Análisis, Importar y Ajustes quedan en un drawer (que la skill desaconseja). Objetivo táctil de la barra OK, pero el ítem activo usa texto ámbar de 10px. | Destinos escondidos y activo poco visible. | 5 destinos (Resumen, Movimientos, Dólares, Ahorro, **Más**) con activo en píldora; `padding-bottom: env(safe-area-inset-bottom)`. | M |
| D5 | 🟠 | **Semáforo pintando magnitudes**: todos los montos de ingreso/egreso van en `moss-light`/`terra-light`. | *The Three Paints Rule*: el color de estado sólo cuando el dato *es* estado. En finanzas es discutible (signo), pero hoy el verde/rojo pierde fuerza para el balance y alertas reales. | Opción: montos en neutro con signo/ícono (+/−), y verde/rojo reservado para balance, resultado y alertas. **Decisión tuya.** | S |
| D6 | 🟠 | **Colores sueltos**: toaster con hex inline (`#13120F`, `#3A3833`), scrollbar con hex, `text-terra` (3.23:1, bajo AA) en el "Total" de `ImportView`. | Tokens faltantes y un texto bajo AA. | Tokens CSS para el toaster; `text-terra` → `text-terra-light`. | S |
| D7 | 🟡 | **Sin animaciones de salida** en toasts/modales propios salvo el drawer; `fade-up` de 600ms. | La skill pide entradas y salidas, duraciones ≤ 260ms en diálogos. | `AnimatePresence` en modales de formulario; bajar `fade-up` a ~260ms. | S |
| D8 | 🟡 | **Estados vacíos sólo con texto**, sin acción. | "Todavía no registraste…" sin botón "Nueva". | `EmptyState` con acción primaria cuando aplica. | S |
| D9 | 🟡 | **Sin `DESIGN.md`** que documente voces de color, escala y reglas. | Las reglas se pierden entre cambios (ya pasó con el ámbar). | Crear `DESIGN.md` con la paleta actual (ink/paper/moss/amber/terra) mapeada a las voces de la skill. | S |

Lo que **ya está bien** y conviene conservar: foco visible con `:focus-visible`, `prefers-reduced-motion` global, cifras tabulares (`.tabular`), contraste de texto ≥ 4.5:1 en la paleta principal (medido: `ink-400` 4.92, `moss-light` 4.99, `terra-light` 6.94, `amber` 8.05 sobre `ink-900`), loader de marca, Escape en modales, validación Zod en el POST de transacciones.

---

## Orden sugerido de implementación

1. **Seguridad e integridad (rápido, alto impacto):** B1, B3, B4, B10, B11.
2. **Errores visibles de punta a punta:** B2 + B7 + B9 (backend) con F1 + F2 (frontend).
3. **Validación completa en el servidor:** B5, B6, B8.
4. **Diseño:** D1 (voces de color), D2 (escala tipográfica), D3, D6, D9.
5. **Primitivos accesibles:** F4 (`Field`), F5 (`Dialog`), F6 (`ConfirmDialog`), F3 (`lib/api.ts`).
6. **Calidad:** B15 (tests), B14 (`strict`), resto de 🟡.

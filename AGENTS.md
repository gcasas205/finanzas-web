# AGENTS.md — Finanzas (finanzas-web)
App de finanzas personales (ARS/USD) para uso propio: movimientos, importación de PDFs (VISA ICBC y recibos de sueldo), dólares con costo promedio y ahorro por objetivos. Google Sheets es la base de datos.

## Stack y estructura
- Next.js 14 (App Router) · React 18 · TypeScript estricto sin `any` · Tailwind 3 · SWR · Zod · NextAuth (Google) · Recharts · Vitest. Deploy en Vercel.
- `src/app/api/*`: rutas. `src/lib/`: `sheets.ts` (planilla), `*-calc.ts` (cálculos puros), `validations.ts` (schemas), `errors.ts` (contrato). `src/components/views/`: pantallas. `src/components/ui/`: design system.
- `DESIGN.md` manda en lo visual: leelo antes de tocar cualquier UI (colores, tipografía, componentes, movimiento) y seguí sus reglas. Si un cambio agrega o modifica un patrón visual (token, componente, variante, regla), actualizá `DESIGN.md` en el mismo cambio. Criterio por área: `.claude/skills/{backend-engineer,frontend-engineer,webapp-designer}`, aplicadas sin migrar el stack.

## Comandos
- `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
- CI (GitHub Actions, en cada PR y push a `main`): `ci-back.yml` (typecheck + tests) y `ci-front.yml` (typecheck + lint + build). `main` sólo recibe merges con ambos en verde; si cambiás qué corre, actualizá los dos archivos.
- ESLint usa `next/core-web-vitals` y se configura en `.eslintrc.js` (no en `.json`, ver Límites).

## Convenciones
- Textos de UI y errores en castellano rioplatense con voseo ("Probá", "Elegí").
- Rutas API: `withErrors` + `readJson(req, Schema)`. Los errores son `AppError` y se devuelven como `{ detail, code, field? }`. Referencia: `src/app/api/transactions/route.ts`.
- Cliente: `request()` de `lib/api.ts` y `DataProvider`. Formularios con `Field`, confirmaciones con `useConfirm` (nunca `window.confirm`).
- Colores sólo con tokens (`tailwind.config.js` / `lib/palette.ts`): sin hex sueltos ni texto menor a 13px.

## Reglas de dominio / trampas conocidas
- Fechas `AAAA-MM-DD` en hora local: usá `hoyLocal()`, nunca `toISOString()` para obtener el día (en GMT-3 de noche da mañana).
- KPIs y gráficos agrupan por `fechaPago`, no por `fechaConsumo`. La fecha de pago de tarjeta se deriva en el servidor (`buildTransaction`).
- Dinero: redondeo único con `roundMoney`.
- La planilla es posicional: el orden de `*_HEADERS` y de `rowTo*`/`*ToRow` en `sheets.ts` es el formato guardado. Columnas nuevas, sólo al final.
- Ahorro: invariante `piso + mediano + largo = tenencia neta USD`. Sus parámetros viven en la hoja `Config`, no en el código ni en env.
- Nunca devolver `[]` ante una falla de Sheets: propagar `SheetsError` (503). Los errores no se cachean y cada escritura invalida su clave de caché.

## Forma de trabajar
- Hacé sólo lo pedido, con cambios chicos y enfocados. Usá modo Plan para cambios en `sheets.ts`, `*-calc.ts` o auth.
- Al terminar: qué cambiaste, cómo lo verificaste y qué decisiones debo revisar.

## Límites
- ✅ Siempre: validar con Zod en el servidor, dejar `typecheck`, `lint` y `test` en verde, actualizar `MEMORY.md` al terminar cada tarea.
- ⚠️ Preguntá antes: dependencias nuevas, columnas o pestañas nuevas en la planilla, cambios de auth o del contrato de errores, actualizar Next/React/Tailwind, sumar un `.json` al repo (`.gitignore` ignora todos salvo excepciones explícitas, para no subir credenciales).
- 🚫 Nunca: commitear `.env*` ni credenciales, debilitar `ALLOWED_EMAILS` (falla cerrado), mover ajustes de `Config` a variables de entorno.

## Verificación
- `npm run typecheck && npm run lint && npm test`. Lógica nueva en `lib/` lleva su test en `src/lib/__tests__/`.
- UI: probar a 320px y en desktop, navegando también con teclado. Local requiere `.env.local` (ver `.env.example`).

## Memoria
- Al empezar, leé `MEMORY.md` (y `DESIGN.md` si la tarea toca la UI). Al terminar, actualizalo (estado, decisiones con su porqué, errores a evitar), máximo ~50 líneas.
- Si algo se vuelve regla permanente, proponé moverlo acá. Nunca guardes secretos ni datos financieros reales.
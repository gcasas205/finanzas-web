# Finanzas — Casas

Web app de seguimiento financiero personal (ARS/USD) con importación automática de resúmenes de tarjeta VISA ICBC y recibos de sueldo argentinos, seguimiento de dólares y ahorro por objetivos.

**Stack:** Next.js 14 · React 18 · TypeScript · Tailwind CSS · SWR · Zod · Recharts · Google Sheets (base de datos) · NextAuth (autenticación Google OAuth)

**Demo:** [finanzas-web-five.vercel.app](https://finanzas-web-five.vercel.app) (es la instancia personal del autor: pide login y sólo entran los emails autorizados)

Cada persona que la usa tiene **su propia copia**: su repo, su planilla de Google Sheets, sus credenciales y su deploy en Vercel. Nadie comparte datos con nadie. La guía de abajo está pensada para que la instales vos desde cero.

---

## Funcionalidades

| Feature | Descripción |
|---|---|
| **Resumen** | KPIs del mes: ingresos, gastos, ahorro, tasa de ahorro, acumulado histórico, próximo resumen de tarjeta a pagar y presupuesto por categoría |
| **Movimientos** | Carga manual con auto-categorización que aprende de tus correcciones. Filtros por mes, tipo, categoría, fuente, moneda y búsqueda libre. Compras en cuotas (crea las cuotas futuras), duplicar, recategorizar varios a la vez y exportar a CSV. Gastos en USD con origen de ahorro e ingresos en USD con reparto entre mediano y largo plazo |
| **Gastos fijos** | Alquiler, prepaga, suscripciones… se definen en Ajustes y cada mes Movimientos avisa cuáles faltan y los carga con un toque |
| **Dólares** | Compra/venta de USD con costo promedio ponderado, cotización oficial en vivo (dolarapi.com, con dolarhoy de respaldo), tenencia, resultado por tipo de cambio y ganancia realizada en ventas |
| **Ahorro** | Ahorro por objetivos sobre tu tenencia de USD: piso de emergencia (se llena primero), sobres de mediano plazo por % y objetivo (editables desde Ajustes, con fecha objetivo), pases entre destinos, historial y largo plazo (S&P) |
| **Importar PDF** | Parsea resúmenes VISA ICBC y recibos de sueldo (incluye PDFs con encoding PUA). Omite los movimientos que ya estaban cargados |
| **Análisis** | 6 pestañas: Tendencias, Categorías, Comparativa (mes anterior, hace un año o promedio de 3 meses), Hábitos (suscripciones y gastos hormiga), Sueldo y Mercado Pago. Vista "pesos de hoy" ajustada por inflación (IPC INDEC vía argentinadatos.com) |
| **Ajustes** | Nombre, días de tarjeta, TNA de Mercado Pago, plan de ahorro, presupuestos, categorías editables, gastos fijos y copia de seguridad de toda la planilla |
| **Fechas duales** | Cada gasto tiene fecha de consumo + fecha de pago real. Sueldos se asignan al mes de cobro |
| **Autenticación** | Google OAuth con whitelist de emails (`ALLOWED_EMAILS`, obligatoria: vacía = nadie entra). Sólo vos podés acceder |
| **Responsive** | Funciona en desktop, tablet y celular: barra lateral en escritorio, barra inferior de 5 pestañas en el celular. Se puede instalar en la pantalla de inicio |
| **Accesible** | Contraste WCAG AA medido, foco visible, formularios que anuncian sus errores, diálogos con foco controlado |
| **Caché** | Caché en memoria para no exceder los límites de la API de Google Sheets |

> **Antes de instalarla, tené en cuenta:** la importación de PDFs está hecha para el **resumen VISA de ICBC** y para recibos de sueldo con el formato que usa el autor. Si tu banco o tu empleador son otros, lo más probable es que la importación no funcione y tengas que cargar los movimientos a mano (todo lo demás funciona igual).

---

## Requisitos previos

- [Node.js](https://nodejs.org/) 20 o 22 (la CI corre con 22; Next 14 necesita como mínimo 18.17)
- [Git](https://git-scm.com/)
- Una cuenta de Google (para la planilla, el login y [Google Cloud](https://console.cloud.google.com))
- Una cuenta de [GitHub](https://github.com)
- Una cuenta de [Vercel](https://vercel.com) (gratis)

Todo lo que se usa tiene plan gratuito suficiente para uso personal.

---

## Deploy completo paso a paso

### 1. Hacer tu copia del repositorio (fork)

Vercel despliega desde un repo de **tu** cuenta de GitHub, así que primero hacé tu propia copia:

1. Entrá a [github.com/gcasas205/finanzas-web](https://github.com/gcasas205/finanzas-web)
2. Click en **Fork** (arriba a la derecha) → **Create fork**
3. Cloná **tu** fork e instalá las dependencias:

```bash
git clone https://github.com/TU_USUARIO/finanzas-web.git
cd finanzas-web
npm install
```

Para traer novedades más adelante, en tu fork en GitHub usá **Sync fork** → **Update branch** (Vercel redeploya solo).

### 2. Crear un proyecto en Google Cloud

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"** → ponerle un nombre (ej: `finanzas-web`) → **Create**
3. Asegurate de tener seleccionado el proyecto nuevo

### 3. Habilitar la API de Google Sheets

En Google Cloud Console → **APIs & Services** → **Library**, buscar **Google Sheets API** y habilitarla. (La app no usa Google Drive API: no hace falta.)

### 4. Crear cuenta de servicio (para Google Sheets)

Esto es lo que la app usa para leer/escribir en tu planilla.

1. Ir a **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"Service Account"**
3. Nombre: `sheets-connector` → **Create and Continue** → **Done**
4. Click en la cuenta de servicio que se creó
5. Ir a la pestaña **"Keys"** → **"Add Key"** → **"Create new key"** → **JSON** → **Create**
6. Se descarga un archivo `.json`. **Guardalo fuera de la carpeta del proyecto** y no lo subas a ningún lado: es la llave de tu planilla

### 5. Crear la planilla de Google Sheets

1. Ir a [sheets.google.com](https://sheets.google.com) → crear una nueva hoja en blanco
2. Copiar el **ID** de la URL: `docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`
3. Click **"Compartir"** → agregar el email de la cuenta de servicio (está en el `.json` que descargaste, campo `client_email`, algo como `sheets-connector@finanzas-web-XXXXX.iam.gserviceaccount.com`) → darle permiso de **Editor**

No hace falta crear pestañas: la app crea sola las que faltan la primera vez que se conecta (**Transacciones**, **Sueldos**, **Dolares**, **Config**, **MovAhorro**, **Categorias**, **Reglas** y **Recurrentes**). **Config** se siembra con los parámetros del plan de ahorro (piso, %, objetivos, rendimiento) y **Categorias** con las categorías por defecto; las dos se editan desde **Ajustes** dentro de la app.

> No cambies el orden de las columnas ni renombres pestañas a mano: la app lee la planilla por posición.

### 6. Crear credenciales OAuth (para el login con Google)

Esto es lo que permite que inicies sesión con tu cuenta de Google.

1. En Google Cloud Console → **APIs & Services** → **OAuth consent screen**
2. User Type: **External** → **Create**
3. Completar:
   - App name: `Finanzas`
   - User support email: tu email
   - Developer contact: tu email
4. **Save and Continue** en todos los pasos → **Back to Dashboard**
5. En **"Test users"** → **"+ Add Users"** → agregar tu email de Gmail (y cualquier otro que quieras que acceda)

La app queda en modo "Testing": no hace falta publicarla ni verificarla, alcanza con que tu email esté en **Test users**.

Ahora crear el Client ID:

1. Ir a **Credentials** → **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. Application type: **Web application**
3. Name: `Finanzas Web`
4. En **"Authorized redirect URIs"** agregar:
   - `http://localhost:3000/api/auth/callback/google` (para desarrollo local)
   - La de producción la agregás en el paso 11, cuando Vercel te dé la URL
5. Click **Create**
6. Copiar el **Client ID** y **Client Secret**

### 7. Generar el secreto de sesión

En tu terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Guardá el string que se imprime.

### 8. Configurar variables de entorno para desarrollo local

Copiá el ejemplo y completalo:

```bash
cp .env.example .env.local
```

`.env.local` ya está en `.gitignore`: no se sube a GitHub. Tiene que quedar así:

```env
# Autenticación (Google OAuth)
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu-client-secret
NEXTAUTH_SECRET=el-string-que-generaste
NEXTAUTH_URL=http://localhost:3000
ALLOWED_EMAILS=tu-email@gmail.com

# Google Sheets
GOOGLE_SHEET_ID=el-id-de-tu-planilla
GOOGLE_SHEETS_CREDS_JSON={"type":"service_account","project_id":"..."}
```

> **Ojo:** en `.env.example`, `NEXTAUTH_URL` trae la URL de Vercel. Para local cambiala a `http://localhost:3000`.

> **Importante:** `GOOGLE_SHEETS_CREDS_JSON` debe ser el contenido completo del `.json` de la cuenta de servicio **en una sola línea**. Para convertirlo ejecutá:
> ```bash
> node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('ruta/al/archivo.json','utf8'))))"
> ```

Nombre, TNA de Mercado Pago y días de tarjeta **no van en variables de entorno**: se configuran desde **Ajustes** dentro de la app y quedan guardados en la hoja `Config` del Sheets (no en Vercel, que resetea el filesystem en cada deploy).

### 9. Probar en local

```bash
npm run dev
```

Abrir `http://localhost:3000`. Debería pedirte login con Google y después mostrar el resumen (vacío al principio). Si en vez del resumen aparece el asistente de configuración, revisá `GOOGLE_SHEET_ID` y `GOOGLE_SHEETS_CREDS_JSON` en `.env.local` y reiniciá `npm run dev`.

Una vez adentro, andá a **Ajustes** y poné tu nombre (aparece en la barra lateral), los días de cierre y vencimiento de tu tarjeta y la TNA de Mercado Pago.

### 10. Deploy en Vercel

Tu fork ya está en GitHub, así que no hay que subir nada.

1. Ir a [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Click **"Add New Project"**
3. Importar tu repositorio `finanzas-web` (tu fork)
4. Vercel autodetecta Next.js → dejá todo por defecto
5. **Antes de hacer deploy**, ir a **Environment Variables** y agregar:

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | Tu Client ID de OAuth |
| `GOOGLE_CLIENT_SECRET` | Tu Client Secret de OAuth |
| `NEXTAUTH_SECRET` | El string aleatorio que generaste |
| `NEXTAUTH_URL` | `https://tu-app.vercel.app` (lo sabés después del primer deploy, podés actualizarlo) |
| `ALLOWED_EMAILS` | `tu-email@gmail.com` (separar con comas si son varios). **Obligatorio**: vacío = nadie puede entrar |
| `GOOGLE_SHEET_ID` | El ID de tu planilla |
| `GOOGLE_SHEETS_CREDS_JSON` | El JSON de credenciales **en una sola línea** |

No hay variables para nombre, TNA ni días de tarjeta — eso se configura después, desde **Ajustes** dentro de la app ya desplegada (persiste en la hoja `Config`, no en Vercel).

6. Click **Deploy**
7. Esperar ~1-2 minutos

### 11. Configurar la URL de redirect en Google

Una vez que Vercel te dé la URL (ej: `tu-app.vercel.app`):

1. Ir a [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click en tu OAuth Client ID
3. En **"Authorized redirect URIs"** agregar:
   ```
   https://tu-app.vercel.app/api/auth/callback/google
   ```
4. Guardar

### 12. Actualizar NEXTAUTH_URL

En Vercel → Settings → Environment Variables → editar `NEXTAUTH_URL` con la URL real:
```
https://tu-app.vercel.app
```

Hacer **Redeploy** desde Deployments → último deploy → Redeploy.

### 13. (Opcional) Personalizar el título

El título de la pestaña del navegador ("Finanzas — Casas") está fijo en `src/app/layout.tsx`. Si querés el tuyo, cambialo ahí, commiteá y pusheá a tu fork: Vercel redeploya solo. El nombre que se ve dentro de la app se cambia desde **Ajustes**, sin tocar código.

---

## Agregar otros usuarios

Para dar acceso a otra persona **a tu misma app y tus mismos datos**:

1. En Vercel → **Environment Variables** → editar `ALLOWED_EMAILS` agregando el email separado por coma:
   ```
   tu-email@gmail.com,otro-email@gmail.com
   ```
2. En Google Cloud Console → **OAuth consent screen** → **Test users** → agregar el email
3. Redeploy en Vercel

Si la otra persona quiere llevar **sus propias** finanzas, que siga esta guía desde el paso 1 con su fork y su planilla.

---

## Cómo funciona

### Fechas duales

Cada transacción tiene dos fechas:
- **Fecha de consumo**: cuándo se realizó la compra
- **Fecha de pago**: cuándo sale realmente el dinero de tu cuenta

Para gastos con **tarjeta de crédito**: todas las transacciones de un resumen se pagan el día del **vencimiento actual** del resumen (ej: 05/05/2026). Esta fecha se extrae automáticamente del PDF; en la carga manual se calcula con los días de cierre y vencimiento que pusiste en Ajustes.

Para **sueldos**: el período trabajado (ej: abril 2026) se registra como ingreso en el mes siguiente (mayo 2026), que es cuando efectivamente se cobra.

Los KPIs y gráficos agrupan siempre por **fecha de pago real** para reflejar el flujo de caja verdadero.

### Importación de PDFs

- **Resumen VISA ICBC**: detecta titular, cierre, vencimiento, y extrae todas las transacciones con auto-categorización. Los consumos en USD entran en dólares, impuestos y comisiones en Finanzas y los créditos como reintegro. Se omiten los movimientos que ya estaban cargados
- **Recibo de sueldo**: soporta PDFs con fuentes estándar y con encoding PUA (Unicode Private Use Area, como los de Swissjust). Detecta empresa, cargo, bruto, neto, jubilación, obra social, ley 19032

### Categorización automática

Al escribir una descripción o importar un PDF, la categoría se sugiere en este orden:

1. **Tus reglas**: cada vez que corregís la categoría de un comercio, se guarda una regla en la pestaña `Reglas` y la próxima vez se sugiere sola.
2. **Palabras clave de fábrica**, por ejemplo:

| Palabra clave | Categoría |
|---|---|
| Spotify, Apple, Personal, Claro | Tecnología → Suscripciones |
| Autopistas, Camino Parque | Transporte → Peaje |
| Sancor, OSDE, Swiss Medical | Salud → Prepaga |
| San Cristóbal, Zurich | Seguros |
| Coto, Jumbo, Carrefour | Alimentación → Supermercado |
| Rappi, PedidosYa | Alimentación → Delivery |
| Sueldo, Haberes | Ingresos → Sueldo |

Las categorías y subcategorías se editan desde **Ajustes** (pestaña `Categorias`); renombrar una actualiza movimientos, presupuestos y reglas.

### Dólares

Registrás compras y ventas de USD con su precio. La app calcula tu tenencia con **costo promedio ponderado**: las compras suben el promedio, las ventas y los gastos en USD reducen la tenencia sin alterar el precio promedio de lo que queda. La cotización oficial sale de dolarapi.com (con dolarhoy y un valor fijo de respaldo si fallan) y se usa para valuar la posición y mostrar el resultado por tipo de cambio. Los gastos/ingresos en USD se cargan en Movimientos (eligiendo USD) y aparecen también acá porque afectan la tenencia.

### Ahorro por objetivos

La solapa Ahorro es una **capa de asignación sobre tu tenencia de dólares** — no es plata aparte. Invariante: `piso + mediano + largo = tenencia neta de USD`.

- **Entradas** (compra de USD, o ingreso en USD): el **piso de emergencia se llena primero** de forma automática; del excedente, los montos que asignás a mediano y largo en ese movimiento son exactos (variable mes a mes, ideal para el aguinaldo) y lo que no asignás va a mediano. Si el piso se lleva parte y lo asignado ya no entra, se achica en proporción.
- **Mediano plazo**: un pozo que se reparte entre los sobres según sus **%**. Los sobres (crear, renombrar, quitar, objetivo y fecha) se editan desde **Ajustes**. Si un sobre llega a su objetivo, el excedente se redistribuye entre los que faltan.
- **Salidas** (venta de USD, o gasto en USD): descuentan de un bucket por **origen** — "regla" automática (mediano proporcional → largo → piso) o un sobre puntual (ej. usar sólo los de Tecnología).
- **Pases**: mover plata entre piso, sobres y largo plazo sin tocar la tenencia (pestaña `MovAhorro`).
- **Largo plazo**: USD apartados para el S&P (no se valúa la posición acá); la proyección a 15/20 años es sólo ilustrativa.

Todas las operaciones que afectan USD se procesan en orden cronológico para calcular el saldo vivo de cada bucket. Los objetivos, % y el piso viven en la hoja **Config** del Sheets, no en el código.

### Caché

Para no exceder los límites de la API de Google Sheets (60 lecturas por minuto), la app lee todas las pestañas en una sola llamada y cachea en memoria del servidor. Al crear, editar o eliminar, el caché correspondiente se invalida. La cotización del dólar se cachea aparte y se refresca periódicamente en el cliente. Si editás algo a mano en la planilla, puede tardar un par de minutos en reflejarse.

---

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Build de producción
npm start          # Servir build de producción
npm test           # Tests (Vitest): cálculos, validaciones, parsers, errores de la API
npm run typecheck  # TypeScript en modo estricto
npm run lint       # ESLint (next/core-web-vitals)
```

La CI (GitHub Actions) corre typecheck + tests (`ci-back.yml`) y typecheck + lint + build (`ci-front.yml`) en cada PR y push a `main`.

Sistema de diseño y reglas de color/tipografía: ver [`DESIGN.md`](DESIGN.md). Convenciones para trabajar con agentes de código: ver [`AGENTS.md`](AGENTS.md).

### Estructura del proyecto

```
src/
├── app/
│   ├── (app)/                             # Secciones con sesión (comparten AppShell)
│   │   ├── dashboard/                     # Resumen
│   │   ├── transactions/                  # Movimientos
│   │   ├── dolares/  ahorro/  analytics/  import/  settings/
│   │   ├── layout.tsx                     # Layout de las secciones
│   │   └── loading.tsx                    # Skeleton de carga
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Autenticación
│   │   ├── config/route.ts               # Ajustes (hoja Config) + prueba de conexión
│   │   ├── ahorro/config/route.ts        # Plan de ahorro (hoja Config)
│   │   ├── ahorro/movimientos/route.ts   # Pases entre destinos (hoja MovAhorro)
│   │   ├── backup/route.ts               # Copia de seguridad de la planilla
│   │   ├── categorias/route.ts           # Categorías editables y reglas
│   │   ├── dolar/route.ts                # CRUD operaciones de dólar
│   │   ├── dolar/cotizacion/route.ts     # Cotización oficial
│   │   ├── health/route.ts               # Health check (¿están las env vars?)
│   │   ├── import-pdf/route.ts           # Importación de PDFs
│   │   ├── inflacion/route.ts            # IPC para "pesos de hoy"
│   │   ├── presupuestos/route.ts         # Presupuesto mensual por categoría
│   │   ├── recurrentes/route.ts          # Gastos fijos (+ cargar/ para cargarlos)
│   │   ├── sueldos/route.ts              # Hoja Sueldos
│   │   └── transactions/route.ts         # CRUD transacciones
│   ├── login/page.tsx                     # Página de login
│   ├── main-client.tsx                    # Wizard de primera vez o redirección al resumen
│   ├── page.tsx                           # Entry point
│   ├── manifest.ts                        # Web app instalable
│   ├── layout.tsx                         # Root layout (título de la pestaña)
│   └── globals.css                        # Estilos globales
├── components/
│   ├── views/                             # Pantallas: Dashboard, Transactions, Dolares, Ahorro,
│   │   │                                  #   Analytics, ImportView, SettingsView, RecurrentesPendientes
│   │   └── ajustes/                       # Secciones de Ajustes: plan de ahorro, presupuesto,
│   │                                      #   categorías, gastos fijos
│   ├── ui/                                # Design system: Button, Field, Dialog, ConfirmDialog,
│   │                                      #   Segmented, RangoMeses, States, chart
│   ├── AppShell.tsx                       # Layout principal + navegación
│   ├── AuthProvider.tsx                   # Wrapper de sesión
│   ├── ConfigProvider.tsx                 # Ajustes sincronizados en toda la app
│   ├── DataProvider.tsx                   # Estado compartido (SWR) + hooks
│   ├── AnimatedNumber.tsx / LogoLoader.tsx / UsdAmount.tsx
│   └── SetupWizard.tsx                    # Wizard de primera vez
├── lib/
│   ├── __tests__/                         # Tests (Vitest)
│   ├── api.ts                             # Cliente tipado de la API (fetch + errores)
│   ├── errors.ts                          # Contrato de errores {detail, code, field}
│   ├── validations.ts                     # Schemas Zod de entrada de la API
│   ├── sheets.ts                          # Google Sheets API (formato posicional de la planilla)
│   ├── allowlist.ts                       # Emails permitidos + redirecciones seguras
│   ├── cache.ts                           # Caché en memoria
│   ├── *-calc.ts                          # Cálculos puros: ahorro (cascada de buckets), dólar
│   ├── pdf-parser.ts / pdf-parser-sueldo.ts  # Parsers de VISA ICBC y recibos de sueldo
│   ├── categories.ts / reglas*.ts         # Categorías por defecto y autocategorización
│   ├── cuotas.ts / tarjeta.ts             # Cuotas futuras y fechas de pago de tarjeta
│   ├── recurrentes.ts / habitos.ts / duplicados.ts / series.ts / inflacion.ts
│   ├── dolar.ts                           # Cotización (dolarapi + dolarhoy)
│   ├── palette.ts                         # Colores para gráficos (espejo de los tokens)
│   └── utils.ts                           # Utilidades (fechas, formato)
├── types/index.ts                         # TypeScript types
└── middleware.ts                          # Auth middleware
```

### Dónde viven los datos

- **Movimientos, sueldos, operaciones de dólar, pases de ahorro, categorías, reglas y gastos fijos**: en tu Google Sheets (una pestaña cada uno)
- **Ajustes y plan de ahorro** (nombre, TNA, días de tarjeta, piso, sobres, presupuestos): en la pestaña **Config** del mismo Sheets
- **Secretos y conexión** (OAuth, Sheet ID, credenciales, emails permitidos): variables de entorno en Vercel (producción) o `.env.local` (desarrollo local)
- **Sesión de usuario**: JWT encriptado en cookie del navegador (30 días)
- **Caché**: memoria del servidor (se resetea en cada deploy)

---

## Instalar en el celular

La app se puede agregar a la pantalla de inicio y se abre a pantalla completa, con el ícono del loader ("F." con el arco ámbar):

- **iPhone (Safari):** abrí la app → botón Compartir → **Agregar a inicio**.
- **Android (Chrome):** abrí la app → menú ⋮ → **Instalar app** (o **Agregar a la pantalla principal**).

El manifiesto (`src/app/manifest.ts`) y los íconos (`public/icons/`, `src/app/apple-icon.png`) quedan fuera del login en el middleware, porque el celular los pide antes de que inicies sesión. La app no funciona sin conexión: los datos viven en Google Sheets.

## Troubleshooting

### "Quota exceeded" / Error 429
La API de Google Sheets tiene un límite de 60 lecturas por minuto. La app lee todas las pestañas juntas en una sola lectura (`values.batchGet`), compartida entre los pedidos simultáneos y reutilizada 30 segundos, y no reintenta automáticamente ante un 429. Abrir la app cuesta como mucho 3 lecturas por instancia del servidor. Si igual aparece, esperá un minuto: la app muestra un aviso para reintentar.

### "The OAuth client was not found" / Error 401
El `GOOGLE_CLIENT_ID` no es correcto. Verificá que sea un OAuth 2.0 Client ID (no una cuenta de servicio). Empieza con números, no con letras.

### "redirect_uri_mismatch" / Error 400
La URL de redirect no está registrada en Google Cloud. Agregá la URL exacta de tu app en Credentials → tu OAuth Client → Authorized redirect URIs.

### Aparece el asistente de configuración (en Vercel o en local)
Las variables `GOOGLE_SHEET_ID` y `GOOGLE_SHEETS_CREDS_JSON` no están llegando. Verificá que estén configuradas (en Vercel o en `.env.local`) y que el JSON esté en una sola línea. En Vercel, redeploy después de cambiarlas; en local, reiniciá `npm run dev`.

### "No se pudo abrir la planilla"
Revisá el `GOOGLE_SHEET_ID` y que la planilla esté compartida como **Editor** con el `client_email` de la cuenta de servicio (paso 5).

### Entro con Google pero vuelvo al login ("AccessDenied")
Tu email no está en `ALLOWED_EMAILS` o no está en **Test users** de la pantalla de consentimiento OAuth. Agregalo en los dos lugares (y redeploy si es en Vercel).

### El recibo de sueldo no parsea
Algunos PDFs usan fuentes con encoding especial. La app soporta Unicode PUA pero puede fallar con otros encodings. En ese caso, cargá el ingreso manualmente desde Movimientos → Nueva.

---

## Novedades

### Próxima versión

- **Reparto del ahorro en ingresos USD**: al cargar un ingreso en dólares desde Movimientos elegís cuánto va a mediano y cuánto a largo, igual que al comprar USD. El piso se cubre primero; lo no asignado va a mediano.
- Columnas nuevas al final de la hoja `Transacciones` (asigMediano, asigLargo); migración automática del encabezado al arrancar. Los ingresos USD anteriores quedan sin reparto y se comportan como antes.
- ESLint configurado (`npm run lint`) y CI de back y front en GitHub Actions.
- **Fix — reparto del ahorro**: los montos asignados a mediano/largo ahora son exactos y lo no asignado va a mediano (antes se usaban como proporción y todo el excedente seguía esa proporción). Los saldos de los sobres pueden cambiar respecto de antes.
- **Fix — "Lo que viene"**: los gastos en USD se muestran en dólares y los pagos del día ya no quedan afuera por la zona horaria.
- **Importar sin duplicar**: al importar un resumen se omiten los movimientos que ya estaban cargados (con opción de incluirlos igual).
- **Importar resumen VISA**: los consumos en USD entran en dólares (descuentan tu tenencia), impuestos y comisiones se importan en Finanzas y los créditos como reintegro. La vista previa separa totales por moneda y muestra el saldo del resumen.
- **Dólares**: cotización oficial desde dolarapi.com (dolarhoy queda de respaldo), ganancia realizada en ventas y lista en el celular.
- **Movimientos**: filtros por categoría, fuente y moneda; búsqueda en notas y subcategoría; duplicar; recategorizar varios a la vez; exportar a CSV.
- **Ahorro**: historial de qué entró y salió de cada destino; el aporte promedio a largo plazo cuenta todos los meses.
- **Análisis**: vista "pesos de hoy" ajustada por inflación (IPC INDEC vía argentinadatos.com), comparativa contra hace un año o el promedio de 3 meses, detalle por categoría y nueva pestaña Hábitos (suscripciones y gastos hormiga).
- **Resumen**: próximo resumen de tarjeta a pagar y meses futuros en el selector.
- **Ajustes**: copia de seguridad de toda la planilla en un archivo.
- **Sueldo cargado a mano**: un ingreso en Ingresos → Sueldo se guarda también en la hoja `Sueldos` (como al importar el recibo), con datos opcionales del recibo (empresa, bruto, descuentos, período trabajado). Editarlo o borrarlo mantiene la hoja al día. Nueva pestaña **Sueldo** en Análisis con la evolución del neto y el bruto, también en pesos de hoy.
- **Cuotas futuras**: al cargar una compra en cuotas con tarjeta (o importar un resumen) se crean también las cuotas que faltan, una por mes. Se pueden editar o borrar juntas.
- Columnas nuevas al final: `Transacciones` R (`grupoCuotas`) y `Sueldos` N (`txId`, vincula el sueldo con su movimiento).
- **Plan de ahorro desde Ajustes**: piso, rendimiento supuesto y sobres editables (crear, renombrar, quitar), cada uno con fecha objetivo opcional y cuánto juntar por mes para llegar. Se sigue guardando en la hoja `Config` (claves nuevas `sobres_lista`, `sobre_<clave>_nombre`, `sobre_<clave>_fecha`; las planillas viejas siguen funcionando).
- **Mover entre destinos**: pases de plata entre piso, sobres y largo plazo sin tocar la tenencia (pestaña nueva `MovAhorro`).
- **Presupuesto mensual por categoría**: se define en Ajustes (claves `presupuesto:<Categoría>` en `Config`) y el Resumen muestra cuánto llevás gastado de cada uno.
- **Categorías editables** desde Ajustes (pestaña nueva `Categorias`, sembrada con las de siempre). Renombrar una actualiza movimientos, presupuesto y reglas.
- **Autocategorización que aprende**: cuando corregís la categoría de un comercio (al cargar, editar, recategorizar o en la vista previa del resumen), se guarda una regla en la pestaña nueva `Reglas` y la próxima vez se sugiere sola.
- **Gastos fijos**: alquiler, prepaga, suscripciones… se definen en Ajustes (pestaña nueva `Recurrentes`) y cada mes Movimientos avisa cuáles faltan y los carga con un toque.
- El backup incluye también pases de ahorro, presupuestos, categorías, reglas y gastos fijos.

### v6.0

> **Cambio importante al actualizar:** `ALLOWED_EMAILS` ahora es obligatoria. Si está vacía, nadie puede
> iniciar sesión (antes entraba cualquier cuenta de Google). Revisala en Vercel antes de deployar.

- **Seguridad**
  - El login falla cerrado sin `ALLOWED_EMAILS`, y la lista se vuelve a chequear en cada request: sacar un email corta el acceso al instante, sin esperar a que venza la sesión.
  - La API sin sesión responde 401 (antes redirigía y el navegador recibía HTML); el login vuelve a la pantalla donde estabas.
  - `/api/health` ya no expone fragmentos de las credenciales.
- **Datos confiables**
  - Todas las rutas validan con Zod en el servidor (movimientos, dólares, ajustes, importación de PDF) y responden errores en castellano con el formato `{ detail, code, field }`.
  - Si Google Sheets falla, la app lo dice ("No pudimos cargar tus datos" + Reintentar) en vez de mostrar "sin movimientos" y guardarlo en caché.
  - Editar un movimiento guarda lo validado (antes se escribía el cuerpo recibido tal cual). Montos redondeados a centavos.
  - La importación de PDF valida la lista revisada, el tamaño (10 MB) y el tipo de archivo.
- **Formularios y diálogos**
  - Errores debajo de cada campo, anunciados a lectores de pantalla; el foco va al primer campo con error y el error del servidor marca su campo.
  - Diálogos con foco controlado, salida animada y hoja inferior en el celular. Borrar pide confirmación con el nombre del registro.
  - Importar: arrastrar y soltar el PDF ahora funciona.
- **Diseño** (reglas en [`DESIGN.md`](DESIGN.md))
  - El ámbar queda para el logo, el botón principal y la sección actual; lo elegido (filtros, segmentos) se marca en claro.
  - Verde para la plata que entra y rojo para la que sale, siempre acompañado de signo o flecha.
  - Letra mínima de 13px en toda la app y bordes de campos con contraste suficiente (3.6:1).
  - Barra inferior del celular con 5 pestañas; "Más" abre Análisis, Importar y Ajustes. Enlace "Saltar al contenido".
  - Estados vacíos con la acción que los resuelve (por ejemplo, "Cargar el primero").
- **Calidad**: TypeScript en modo estricto sin `any`, y tests con Vitest (`npm test`) para cálculos, validaciones y seguridad.

### v5.1

- **Favicon con logo y estado de carga**: la pestaña del navegador ahora muestra el ícono de la app (el mismo "F." ámbar del wordmark) y gira un anillo de carga mientras hay datos, un guardado o una importación de PDF en curso — en cualquier sección, no solo en la que lo disparó.
- **Ajustes en vivo, únicamente desde la hoja Config**: nombre, TNA de Mercado Pago y días de tarjeta ahora se leen y persisten en la hoja `Config` del Sheets (antes vivían en el filesystem de Vercel, que se resetea en cada deploy) y ya no tienen variable de entorno equivalente — si existieran, se ignoran a propósito, para que la hoja sea la única fuente de verdad y no queden pisando el valor guardado. Un `ConfigProvider` los mantiene sincronizados en toda la app sin recargar la página; Sheet ID y credenciales siguen viniendo de variables de entorno (son datos de arranque, no ajustes).
- **Refactor de accesibilidad y diseño** (todas las vistas):
  - Contraste de texto secundario corregido: el tono `ink-400`, usado en ~40 lugares, daba ~2.7:1 sobre fondo oscuro (bajo el mínimo WCAG AA de 4.5:1); ahora pasa en toda la app desde un único token.
  - Foco de teclado real en todos los inputs y selects: `outline-none` estaba pisando silenciosamente el anillo de foco por el orden de capas de Tailwind.
  - Botones de editar/borrar de las tablas ya no quedan invisibles para navegación por teclado (antes solo aparecían con `hover` del mouse).
  - Objetivos táctiles ampliados a ~44px en botones de ícono en mobile (tarjetas de Movimientos, menú, cerrar modales).
  - Modales cierran con `Escape` y tienen roles ARIA correctos; el selector de PDF es operable por teclado; toggles y tabs exponen su estado (`aria-pressed`, `aria-selected`) a lectores de pantalla.
  - Estados de "Cargando…" ahora se anuncian (`aria-live`) en vez de ser invisibles para lectores de pantalla.

### v4.1

- **Accesibilidad**: foco de teclado visible en toda la app (antes los controles usaban `outline-none` y no mostraban señal de foco), y soporte de `prefers-reduced-motion` para quienes reducen animaciones en su sistema.
- **Consistencia de UI**: padding mobile-first en las tarjetas de gráficos (Resumen y Análisis) y chevron de los `<select>` unificado en color ámbar en toda la app.
- **Análisis mobile**: se corrigió el desborde horizontal en la sección Análisis (los gráficos ya no fuerzan un ancho mayor al de la pantalla).

### v3.3

- **Fix — Resumen en blanco**: la sección Resumen volvió a renderizar. Una regresión había dejado su página devolviendo `null` en lugar del dashboard.
- **Navegación instantánea entre secciones**: las rutas se prerenderizan estáticas y Next las prefetchea, evitando un ida y vuelta al servidor (y el cold start en Vercel) en cada cambio de solapa. Antes tardaba 1–2 s; ahora es client-side.
- **Skeleton de carga** (`loading.tsx`): feedback inmediato mientras una sección aún no está prefetcheada, para que la UI nunca se congele sin señal.
- **Fix — combo de mes**: el selector de mes ya no se superpone con la flecha. Se reemplazó la flecha nativa del navegador por un chevron controlado con espacio reservado, así etiquetas largas como "Septiembre 2026" entran bien. Aplicado en Resumen, Análisis, Dólares y Movimientos.

### v3.2

- **Nueva solapa Ahorro**: ahorro por objetivos construido sobre tu tenencia de USD (no es plata aparte). Piso de emergencia que se llena primero, sobres de mediano plazo por % y objetivo con redistribución al completarse, y largo plazo (S&P) como USD apartados con proyección ilustrativa.
- **Reparto en la compra de dólares**: al comprar USD elegís cuánto va a mediano y cuánto a largo; el piso se cubre automáticamente antes que nada.
- **Origen en salidas de USD**: al vender (Dólares) o gastar en USD (Movimientos), elegís de qué bucket sale — por regla automática (mediano → largo → piso) o un sobre puntual.
- **Config en el Sheets**: nueva hoja `Config` (clave/valor) con piso, %, objetivos y rendimiento supuesto. Se edita sin redeployar; no vive en Vercel.
- **Motor de cálculo** (`ahorro-calc.ts`): procesa todas las operaciones en USD en orden cronológico manteniendo el saldo vivo de cada bucket, con la invariante `piso + mediano + largo = tenencia neta`.
- Columnas nuevas en las hojas `Dolares` (asigMediano, asigLargo, origen) y `Transacciones` (origen); migración automática de encabezados al arrancar.

---

## Licencia

Proyecto personal. Uso libre.

---

v6.0 · Gonzalo Casas
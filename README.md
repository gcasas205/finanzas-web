# Finanzas — Casas

Web app de seguimiento financiero personal con importación automática de resúmenes de tarjeta VISA ICBC y recibos de sueldo argentinos.

**Stack:** Next.js 14 · React 18 · TypeScript · Tailwind CSS · Recharts · Google Sheets (base de datos) · NextAuth (autenticación Google OAuth)

**Demo:** [finanzas-web-five.vercel.app](https://finanzas-web-five.vercel.app)

---

## Funcionalidades

| Feature | Descripción |
|---|---|
| **Dashboard** | KPIs en tiempo real: ingresos, gastos, ahorro, tasa de ahorro, acumulado histórico y proyección Mercado Pago |
| **Movimientos** | Carga manual con auto-categorización inteligente. Filtros por mes, tipo y búsqueda libre |
| **Importar PDF** | Parsea automáticamente resúmenes VISA ICBC y recibos de sueldo (incluye PDFs con encoding PUA) |
| **Análisis BI** | 4 tabs: Tendencias, Categorías (con filtro por mes), Proyección Mercado Pago, Comparativa mensual |
| **Fechas duales** | Cada gasto tiene fecha de consumo + fecha de pago real. Sueldos se asignan al mes de cobro |
| **Autenticación** | Google OAuth con whitelist de emails. Solo vos podés acceder |
| **Responsive** | Funciona en desktop, tablet y celular con navegación adaptativa |
| **Caché** | Caché en memoria de 3 minutos para no exceder los límites de la API de Google Sheets |

---

## Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior
- Una cuenta de [Google Cloud](https://console.cloud.google.com)
- Una cuenta de [GitHub](https://github.com)
- Una cuenta de [Vercel](https://vercel.com) (gratis)

---

## Deploy completo paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/finanzas-web.git
cd finanzas-web
npm install
```

### 2. Crear un proyecto en Google Cloud

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"** → ponerle un nombre (ej: `finanzas-web`) → **Create**
3. Asegurate de tener seleccionado el proyecto nuevo

### 3. Habilitar APIs

En Google Cloud Console → **APIs & Services** → **Library**, buscar y habilitar:

- **Google Sheets API**
- **Google Drive API**

### 4. Crear cuenta de servicio (para Google Sheets)

Esto es lo que la app usa para leer/escribir en tu planilla.

1. Ir a **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"Service Account"**
3. Nombre: `sheets-connector` → **Create and Continue** → **Done**
4. Click en la cuenta de servicio que se creó
5. Ir a la pestaña **"Keys"** → **"Add Key"** → **"Create new key"** → **JSON** → **Create**
6. Se descarga un archivo `.json`. **Guardalo en un lugar seguro** — lo vas a necesitar después

### 5. Crear la planilla de Google Sheets

1. Ir a [sheets.google.com](https://sheets.google.com) → crear una nueva hoja en blanco
2. Copiar el **ID** de la URL: `docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`
3. Click **"Compartir"** → agregar el email de la cuenta de servicio (está en el `.json` que descargaste, campo `client_email`, algo como `sheets-connector@finanzas-web-XXXXX.iam.gserviceaccount.com`) → darle permisor de **Editor**

La app crea automáticamente las pestañas "Transacciones" y "Sueldos" la primera vez que se conecta.

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

Ahora crear el Client ID:

1. Ir a **Credentials** → **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. Application type: **Web application**
3. Name: `Finanzas Web`
4. En **"Authorized redirect URIs"** agregar:
   - `http://localhost:3000/api/auth/callback/google` (para desarrollo local)
   - `https://TU-APP.vercel.app/api/auth/callback/google` (para producción — la URL exacta te la da Vercel después del primer deploy, podés agregarla después)
5. Click **Create**
6. Copiar el **Client ID** y **Client Secret**

### 7. Generar el secreto de sesión

En tu terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Guardá el string que se imprime.

### 8. Configurar variables de entorno para desarrollo local

Crear el archivo `.env.local` en la raíz del proyecto (este archivo NO se sube a GitHub):

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

# App Config (opcionales)
APP_NOMBRE=Tu Nombre
MP_TNA=27.0
CARD_CUTOFF_DAY=23
CARD_DUE_DAY=5
```

> **Importante:** `GOOGLE_SHEETS_CREDS_JSON` debe ser el contenido completo del `.json` de la cuenta de servicio **en una sola línea**. Para convertirlo ejecutá:
> ```bash
> node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('ruta/al/archivo.json','utf8'))))"
> ```

### 9. Probar en local

```bash
npm run dev
```

Abrir `http://localhost:3000`. Debería pedirte login con Google y después mostrar el dashboard.

### 10. Subir a GitHub

Asegurate de que `.gitignore` tenga:

```
node_modules
.next
.env.local
.env
credentials.json
```

```bash
git add .
git commit -m "initial commit"
git remote add origin https://github.com/TU_USUARIO/finanzas-web.git
git branch -M main
git push -u origin main
```

### 11. Deploy en Vercel

1. Ir a [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Click **"Add New Project"**
3. Importar tu repositorio `finanzas-web`
4. Vercel autodetecta Next.js → dejá todo por defecto
5. **Antes de hacer deploy**, ir a **Environment Variables** y agregar:

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | Tu Client ID de OAuth |
| `GOOGLE_CLIENT_SECRET` | Tu Client Secret de OAuth |
| `NEXTAUTH_SECRET` | El string aleatorio que generaste |
| `NEXTAUTH_URL` | `https://tu-app.vercel.app` (lo sabés después del primer deploy, podés actualizarlo) |
| `ALLOWED_EMAILS` | `tu-email@gmail.com` (separar con comas si son varios) |
| `GOOGLE_SHEET_ID` | El ID de tu planilla |
| `GOOGLE_SHEETS_CREDS_JSON` | El JSON de credenciales **en una sola línea** |
| `APP_NOMBRE` | Tu nombre (opcional) |
| `MP_TNA` | `27.0` (opcional) |
| `CARD_CUTOFF_DAY` | `23` (opcional) |
| `CARD_DUE_DAY` | `5` (opcional) |

6. Click **Deploy**
7. Esperar ~1-2 minutos

### 12. Configurar la URL de redirect en Google

Una vez que Vercel te dé la URL (ej: `finanzas-web-five.vercel.app`):

1. Ir a [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click en tu OAuth Client ID
3. En **"Authorized redirect URIs"** agregar:
   ```
   https://finanzas-web-five.vercel.app/api/auth/callback/google
   ```
4. Guardar

### 13. Actualizar NEXTAUTH_URL

En Vercel → Settings → Environment Variables → editar `NEXTAUTH_URL` con la URL real:
```
https://finanzas-web-five.vercel.app
```

Hacer **Redeploy** desde Deployments → último deploy → Redeploy.

---

## Agregar otros usuarios

Para dar acceso a otra persona:

1. En Vercel → **Environment Variables** → editar `ALLOWED_EMAILS` agregando el email separado por coma:
   ```
   tu-email@gmail.com,otro-email@gmail.com
   ```
2. En Google Cloud Console → **OAuth consent screen** → **Test users** → agregar el email
3. Redeploy en Vercel

---

## Cómo funciona

### Fechas duales

Cada transacción tiene dos fechas:
- **Fecha de consumo**: cuándo se realizó la compra
- **Fecha de pago**: cuándo sale realmente el dinero de tu cuenta

Para gastos con **tarjeta de crédito**: todas las transacciones de un resumen se pagan el día del **vencimiento actual** del resumen (ej: 05/05/2026). Esta fecha se extrae automáticamente del PDF.

Para **sueldos**: el período trabajado (ej: abril 2026) se registra como ingreso en el mes siguiente (mayo 2026), que es cuando efectivamente se cobra.

Los KPIs y gráficos agrupan siempre por **fecha de pago real** para reflejar el flujo de caja verdadero.

### Importación de PDFs

- **Resumen VISA ICBC**: detecta titular, cierre, vencimiento, y extrae todas las transacciones con auto-categorización por palabras clave
- **Recibo de sueldo**: soporta PDFs con fuentes estándar y con encoding PUA (Unicode Private Use Area, como los de Swissjust). Detecta empresa, cargo, bruto, neto, jubilación, obra social, ley 19032

### Categorización automática

Al escribir una descripción o importar un PDF, la categoría se detecta por palabras clave:

| Palabra clave | Categoría |
|---|---|
| Spotify, Apple, Personal, Claro | Tecnología → Suscripciones |
| Autopistas, Camino Parque | Transporte → Peaje |
| Sancor, OSDE, Swiss Medical | Salud → Prepaga |
| San Cristóbal, Zurich | Seguros |
| Coto, Jumbo, Carrefour | Alimentación → Supermercado |
| Rappi, PedidosYa | Alimentación → Delivery |
| Sueldo, Haberes | Ingresos → Sueldo |

### Caché

Para no exceder los límites de la API de Google Sheets (60 requests/minuto), la app cachea las transacciones en memoria del servidor durante 3 minutos. Al crear, editar o eliminar una transacción, el caché se invalida automáticamente.

---

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Build de producción
npm start          # Servir build de producción
```

### Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Autenticación
│   │   ├── config/route.ts               # Configuración
│   │   ├── health/route.ts               # Health check
│   │   ├── import-pdf/route.ts           # Importación de PDFs
│   │   └── transactions/route.ts         # CRUD transacciones
│   ├── login/page.tsx                     # Página de login
│   ├── main-client.tsx                    # Router principal
│   ├── page.tsx                           # Entry point
│   ├── layout.tsx                         # Root layout
│   └── globals.css                        # Estilos globales
├── components/
│   ├── views/
│   │   ├── Dashboard.tsx                  # Dashboard con KPIs
│   │   ├── Transactions.tsx               # Gestión de movimientos
│   │   ├── Analytics.tsx                  # Gráficos BI
│   │   ├── ImportView.tsx                 # Importación de PDFs
│   │   └── SettingsView.tsx               # Configuración
│   ├── AppShell.tsx                       # Layout principal + navegación
│   ├── AuthProvider.tsx                   # Wrapper de sesión
│   └── SetupWizard.tsx                    # Wizard de primera vez
├── lib/
│   ├── cache.ts                           # Caché en memoria
│   ├── categories.ts                      # Categorías y auto-categorización
│   ├── pdf-parser.ts                      # Parser de VISA ICBC
│   ├── pdf-parser-sueldo.ts              # Parser de recibos de sueldo
│   ├── sheets.ts                          # Google Sheets API
│   └── utils.ts                           # Utilidades (fechas, formato)
├── types/index.ts                         # TypeScript types
└── middleware.ts                           # Auth middleware
```

### Dónde viven los datos

- **Transacciones y sueldos**: en tu Google Sheets personal
- **Configuración de la app**: variables de entorno en Vercel (producción) o `~/.finanzas-web/config.json` (desarrollo local)
- **Sesión de usuario**: JWT encriptado en cookie del navegador (30 días)
- **Caché**: memoria del servidor (se resetea en cada deploy)

---

## Troubleshooting

### "Quota exceeded" / Error 429
La API de Google Sheets tiene un límite de 60 lecturas por minuto. El caché de 3 minutos debería evitar esto. Si aparece, esperá un par de minutos e intentá de nuevo.

### "The OAuth client was not found" / Error 401
El `GOOGLE_CLIENT_ID` no es correcto. Verificá que sea un OAuth 2.0 Client ID (no una cuenta de servicio). Empieza con números, no con letras.

### "redirect_uri_mismatch" / Error 400
La URL de redirect no está registrada en Google Cloud. Agregá la URL exacta de tu app en Credentials → tu OAuth Client → Authorized redirect URIs.

### El wizard aparece en Vercel
Las variables `GOOGLE_SHEET_ID` y `GOOGLE_SHEETS_CREDS_JSON` no están llegando. Verificá que estén configuradas en Vercel y que el JSON esté en una sola línea. Redeploy después de cambiarlas.

### El recibo de sueldo no parsea
Algunos PDFs usan fuentes con encoding especial. La app soporta Unicode PUA pero puede fallar con otros encodings. En ese caso, cargá el ingreso manualmente desde Movimientos → Nueva.

---

## Licencia

Proyecto personal. Uso libre.

---

v1.0 · Gonzalo Casas

# Finanzas — Casas

Web app moderna para seguimiento financiero personal.

**Stack:** Next.js 14 + React 18 + TypeScript + Tailwind CSS + Recharts + Google Sheets como base de datos.

## Requisitos

- Node.js 18+
- Una cuenta de Google Cloud con Google Sheets API habilitada
- Una hoja de cálculo de Google Sheets

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar en modo desarrollo
npm run dev
```

Abrí `http://localhost:3000` — el wizard te guía paso a paso.

## Setup de Google Sheets (una sola vez)

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear un proyecto (o usar uno existente)
3. Habilitar **Google Sheets API** y **Google Drive API**
4. Ir a Credenciales → Crear cuenta de servicio
5. Descargar el archivo `.json` de la cuenta de servicio
6. Crear una nueva hoja en Google Sheets
7. Compartir la hoja con el email de la cuenta de servicio (está en el `.json`, campo `client_email`)
8. Copiar el ID de la hoja (de la URL: `docs.google.com/spreadsheets/d/[ESTE_ID]/edit`)

En la app, introducir:
- **Sheet ID**: el ID copiado
- **Ruta al .json**: la ruta completa al archivo de credenciales descargado

## Cómo funciona

### Fechas duales
- **Fecha de consumo**: cuándo se realizó el gasto/ingreso
- **Fecha de pago**: cuándo se debita/acredita realmente el dinero

Para tarjeta de crédito: el consumo puede ser el 15 de abril, pero el pago sale el 5 de mayo (según el ciclo de cierre/vencimiento).

Para sueldos: el período trabajado es abril, pero el cobro es en mayo.

Todos los KPIs y gráficos agrupan por **fecha de pago real** para reflejar el flujo de caja verdadero.

### Importación de PDFs
- **Resumen VISA ICBC**: detecta titular, cierre, vencimiento, y extrae todas las transacciones con auto-categorización
- **Recibo de sueldo**: soporta PDFs con fuentes estándar y fuentes con encoding PUA (como Swissjust). Detecta bruto, neto, jubilación, obra social, ley 19032

### Categorización automática
Al escribir una descripción, se detecta la categoría por palabras clave (Spotify → Tecnología, autopista → Transporte, etc.)

## Configuración local

Los datos de conexión se guardan en:
```
~/.finanzas-web/config.json
```

Esto incluye: Sheet ID, ruta a credenciales, TNA de Mercado Pago, día de cierre/vencimiento de tarjeta.
Los datos financieros viven exclusivamente en tu Google Sheets.

## Build para producción

```bash
npm run build
npm start
```

---
v1.0 · Gonzalo Casas

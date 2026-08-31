import { google, sheets_v4 } from "googleapis";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { Transaction, Sueldo, AppConfig, DolarOperacion } from "@/types";

/**
 * Config se puede cargar de:
 * 1. Variables de entorno (Vercel / producción)
 * 2. Archivo local ~/.finanzas-web/config.json (desarrollo)
 * Las env vars tienen prioridad.
 */

const CONFIG_FILE = path.join(os.homedir(), ".finanzas-web", "config.json");

const DEFAULT_CONFIG: AppConfig = {
  nombre: "",
  mpTna: 27.0,
  googleSheetId: "",
  googleCredsPath: "",
  cardCutoffDay: 23,
  cardDueDay: 5,
  salaryPaymentOffsetMonths: 1,
};

async function ensureConfigDir() {
  try {
    const dir = path.dirname(CONFIG_FILE);
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // En Vercel el filesystem es read-only, ignorar
  }
}

export async function loadConfig(): Promise<AppConfig> {
  // Primero intentar archivo local
  let fileConfig: Partial<AppConfig> = {};
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    fileConfig = JSON.parse(raw);
  } catch {
    // No existe o no se puede leer (normal en Vercel)
  }

  // Las env vars sobreescriben el archivo local
  const envConfig: Partial<AppConfig> = {};
  if (process.env.GOOGLE_SHEET_ID) envConfig.googleSheetId = process.env.GOOGLE_SHEET_ID;
  if (process.env.GOOGLE_CREDS_PATH) envConfig.googleCredsPath = process.env.GOOGLE_CREDS_PATH;
  if (process.env.MP_TNA) envConfig.mpTna = parseFloat(process.env.MP_TNA);
  if (process.env.CARD_CUTOFF_DAY) envConfig.cardCutoffDay = parseInt(process.env.CARD_CUTOFF_DAY);
  if (process.env.CARD_DUE_DAY) envConfig.cardDueDay = parseInt(process.env.CARD_DUE_DAY);
  if (process.env.APP_NOMBRE) envConfig.nombre = process.env.APP_NOMBRE;

  return { ...DEFAULT_CONFIG, ...fileConfig, ...envConfig };
}

export async function saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig();
  const merged = { ...current, ...config };
  try {
    await ensureConfigDir();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch {
    // En Vercel no se puede escribir, los cambios viven solo en memoria
    console.warn("No se pudo guardar config en disco (normal en Vercel)");
  }
  return merged;
}

/**
 * Cliente de Sheets autenticado.
 * Credenciales se cargan de:
 * 1. GOOGLE_SHEETS_CREDS_JSON env var (JSON completo como string, ideal para Vercel)
 * 2. Archivo .json local (ruta en config.googleCredsPath)
 */
async function getSheetsClient(): Promise<{ client: sheets_v4.Sheets; sheetId: string } | null> {
  const config = await loadConfig();
  if (!config.googleSheetId) return null;

  try {
    let creds: any;

    // Opción 1: credenciales como env var (Vercel)
    if (process.env.GOOGLE_SHEETS_CREDS_JSON) {
      creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDS_JSON);
    }
    // Opción 2: archivo local
    else if (config.googleCredsPath) {
      const credsRaw = await fs.readFile(config.googleCredsPath, "utf-8");
      creds = JSON.parse(credsRaw);
    }
    else {
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const client = google.sheets({ version: "v4", auth });
    return { client, sheetId: config.googleSheetId };
  } catch (e) {
    console.error("Error inicializando Google Sheets:", e);
    return null;
  }
}

/** Asegura que existen las pestañas necesarias con encabezados */
const TX_HEADERS = [
  "id", "fechaConsumo", "fechaPago", "tipo", "descripcion", "monto",
  "moneda", "categoria", "subcategoria", "fuente", "cuotaTotal",
  "cuotaNumero", "notas", "createdAt"
];

const SUELDO_HEADERS = [
  "id", "periodoTrabajado", "periodoPago", "empresa", "cargo",
  "bruto", "neto", "jubilacion", "obraSocial", "ley19032",
  "otrosDescuentos", "fechaPago", "createdAt"
];

const DOLAR_HEADERS = [
  "id", "fecha", "tipo", "montoUSD", "precioARS", "totalARS", "notas", "createdAt"
];

async function ensureSheets(client: sheets_v4.Sheets, sheetId: string) {
  const meta = await client.spreadsheets.get({ spreadsheetId: sheetId });
  const existing = meta.data.sheets?.map(s => s.properties?.title) ?? [];

  const required: Array<[string, string[]]> = [
    ["Transacciones", TX_HEADERS],
    ["Sueldos", SUELDO_HEADERS],
    ["Dolares", DOLAR_HEADERS],
  ];

  for (const [name, headers] of required) {
    if (!existing.includes(name)) {
      await client.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: name } } }]
        }
      });
      await client.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${name}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] }
      });
    } else {
      // Verificar que tenga headers
      const r = await client.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${name}!A1:Z1`,
      });
      if (!r.data.values?.[0]?.length) {
        await client.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${name}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] }
        });
      }
    }
  }
}

/** Convierte una fila plana a Transaction */
function rowToTransaction(row: any[]): Transaction {
  return {
    id: row[0] ?? "",
    fechaConsumo: row[1] ?? "",
    fechaPago: row[2] ?? "",
    tipo: (row[3] ?? "egreso") as Transaction["tipo"],
    descripcion: row[4] ?? "",
    monto: parseFloat(row[5]) || 0,
    moneda: (row[6] ?? "ARS") as Transaction["moneda"],
    categoria: row[7] ?? "Otros",
    subcategoria: row[8] ?? "Sin categoría",
    fuente: (row[9] ?? "manual") as Transaction["fuente"],
    cuotaTotal: parseInt(row[10]) || 1,
    cuotaNumero: parseInt(row[11]) || 1,
    notas: row[12] ?? "",
    createdAt: row[13] ?? new Date().toISOString(),
  };
}

function transactionToRow(t: Transaction): any[] {
  return [
    t.id, t.fechaConsumo, t.fechaPago, t.tipo, t.descripcion, t.monto,
    t.moneda, t.categoria, t.subcategoria, t.fuente, t.cuotaTotal,
    t.cuotaNumero, t.notas, t.createdAt
  ];
}

function rowToSueldo(row: any[]): Sueldo {
  return {
    id: row[0] ?? "",
    periodoTrabajado: row[1] ?? "",
    periodoPago: row[2] ?? "",
    empresa: row[3] ?? "",
    cargo: row[4] ?? "",
    bruto: parseFloat(row[5]) || 0,
    neto: parseFloat(row[6]) || 0,
    jubilacion: parseFloat(row[7]) || 0,
    obraSocial: parseFloat(row[8]) || 0,
    ley19032: parseFloat(row[9]) || 0,
    otrosDescuentos: parseFloat(row[10]) || 0,
    fechaPago: row[11] ?? "",
    createdAt: row[12] ?? new Date().toISOString(),
  };
}

function sueldoToRow(s: Sueldo): any[] {
  return [
    s.id, s.periodoTrabajado, s.periodoPago, s.empresa, s.cargo,
    s.bruto, s.neto, s.jubilacion, s.obraSocial, s.ley19032,
    s.otrosDescuentos, s.fechaPago, s.createdAt
  ];
}

function rowToDolar(row: any[]): DolarOperacion {
  const montoUSD = parseFloat(row[3]) || 0;
  const precioARS = parseFloat(row[4]) || 0;
  return {
    id: row[0] ?? "",
    fecha: row[1] ?? "",
    tipo: (row[2] ?? "compra") as DolarOperacion["tipo"],
    montoUSD,
    precioARS,
    // Recalcula por las dudas para que totalARS nunca quede inconsistente
    totalARS: parseFloat(row[5]) || montoUSD * precioARS,
    notas: row[6] ?? "",
    createdAt: row[7] ?? new Date().toISOString(),
  };
}

function dolarToRow(d: DolarOperacion): any[] {
  return [
    d.id, d.fecha, d.tipo, d.montoUSD, d.precioARS, d.totalARS, d.notas, d.createdAt
  ];
}

// ─── API pública ────────────────────────────────────────────────────────────

export async function listTransactions(): Promise<Transaction[]> {
  const ctx = await getSheetsClient();
  if (!ctx) return [];

  try {
    await ensureSheets(ctx.client, ctx.sheetId);
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Transacciones!A2:N",
    });
    const rows = r.data.values ?? [];
    return rows.filter(row => row[0]).map(rowToTransaction);
  } catch (e) {
    console.error("Error listing transactions:", e);
    return [];
  }
}

export async function addTransaction(tx: Transaction): Promise<boolean> {
  const ctx = await getSheetsClient();
  if (!ctx) return false;

  try {
    await ensureSheets(ctx.client, ctx.sheetId);
    await ctx.client.spreadsheets.values.append({
      spreadsheetId: ctx.sheetId,
      range: "Transacciones!A:N",
      valueInputOption: "RAW",
      requestBody: { values: [transactionToRow(tx)] },
    });
    return true;
  } catch (e) {
    console.error("Error adding transaction:", e);
    return false;
  }
}

export async function addTransactionsBulk(txs: Transaction[]): Promise<number> {
  if (!txs.length) return 0;
  const ctx = await getSheetsClient();
  if (!ctx) return 0;

  try {
    await ensureSheets(ctx.client, ctx.sheetId);
    await ctx.client.spreadsheets.values.append({
      spreadsheetId: ctx.sheetId,
      range: "Transacciones!A:N",
      valueInputOption: "RAW",
      requestBody: { values: txs.map(transactionToRow) },
    });
    return txs.length;
  } catch (e) {
    console.error("Error bulk adding:", e);
    return 0;
  }
}

export async function updateTransaction(tx: Transaction): Promise<boolean> {
  const ctx = await getSheetsClient();
  if (!ctx) return false;
  try {
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Transacciones!A2:A",
    });
    const ids = (r.data.values ?? []).map(row => row[0]);
    const idx = ids.indexOf(tx.id);
    if (idx === -1) return false;

    const rowNumber = idx + 2;
    await ctx.client.spreadsheets.values.update({
      spreadsheetId: ctx.sheetId,
      range: `Transacciones!A${rowNumber}:N${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [transactionToRow(tx)] },
    });
    return true;
  } catch (e) {
    console.error("Error updating transaction:", e);
    return false;
  }
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const ctx = await getSheetsClient();
  if (!ctx) return false;
  try {
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Transacciones!A2:A",
    });
    const ids = (r.data.values ?? []).map(row => row[0]);
    const idx = ids.indexOf(id);
    if (idx === -1) return false;

    // Get sheet ID for the Transacciones tab
    const meta = await ctx.client.spreadsheets.get({ spreadsheetId: ctx.sheetId });
    const sheet = meta.data.sheets?.find(s => s.properties?.title === "Transacciones");
    if (!sheet?.properties?.sheetId == null) return false;
    const innerSheetId = sheet!.properties!.sheetId!;

    const rowIndex = idx + 1; // index 0-based: row 1 is header → data starts at row index 1
    await ctx.client.spreadsheets.batchUpdate({
      spreadsheetId: ctx.sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: innerSheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            }
          }
        }]
      }
    });
    return true;
  } catch (e) {
    console.error("Error deleting transaction:", e);
    return false;
  }
}

export async function listSueldos(): Promise<Sueldo[]> {
  const ctx = await getSheetsClient();
  if (!ctx) return [];
  try {
    await ensureSheets(ctx.client, ctx.sheetId);
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Sueldos!A2:M",
    });
    return (r.data.values ?? []).filter(row => row[0]).map(rowToSueldo);
  } catch (e) {
    console.error("Error listing sueldos:", e);
    return [];
  }
}

export async function addSueldo(s: Sueldo): Promise<boolean> {
  const ctx = await getSheetsClient();
  if (!ctx) return false;
  try {
    await ensureSheets(ctx.client, ctx.sheetId);
    await ctx.client.spreadsheets.values.append({
      spreadsheetId: ctx.sheetId,
      range: "Sueldos!A:M",
      valueInputOption: "RAW",
      requestBody: { values: [sueldoToRow(s)] },
    });
    return true;
  } catch (e) {
    console.error("Error adding sueldo:", e);
    return false;
  }
}

// ─── Operaciones de dólar ────────────────────────────────────────────────────

export async function listDolarOps(): Promise<DolarOperacion[]> {
  const ctx = await getSheetsClient();
  if (!ctx) return [];
  try {
    await ensureSheets(ctx.client, ctx.sheetId);
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Dolares!A2:H",
    });
    return (r.data.values ?? []).filter(row => row[0]).map(rowToDolar);
  } catch (e) {
    console.error("Error listing dolar ops:", e);
    return [];
  }
}

export async function addDolarOp(op: DolarOperacion): Promise<boolean> {
  const ctx = await getSheetsClient();
  if (!ctx) return false;
  try {
    await ensureSheets(ctx.client, ctx.sheetId);
    await ctx.client.spreadsheets.values.append({
      spreadsheetId: ctx.sheetId,
      range: "Dolares!A:H",
      valueInputOption: "RAW",
      requestBody: { values: [dolarToRow(op)] },
    });
    return true;
  } catch (e) {
    console.error("Error adding dolar op:", e);
    return false;
  }
}

export async function updateDolarOp(op: DolarOperacion): Promise<boolean> {
  const ctx = await getSheetsClient();
  if (!ctx) return false;
  try {
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Dolares!A2:A",
    });
    const ids = (r.data.values ?? []).map(row => row[0]);
    const idx = ids.indexOf(op.id);
    if (idx === -1) return false;

    const rowNumber = idx + 2;
    await ctx.client.spreadsheets.values.update({
      spreadsheetId: ctx.sheetId,
      range: `Dolares!A${rowNumber}:H${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [dolarToRow(op)] },
    });
    return true;
  } catch (e) {
    console.error("Error updating dolar op:", e);
    return false;
  }
}

export async function deleteDolarOp(id: string): Promise<boolean> {
  const ctx = await getSheetsClient();
  if (!ctx) return false;
  try {
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Dolares!A2:A",
    });
    const ids = (r.data.values ?? []).map(row => row[0]);
    const idx = ids.indexOf(id);
    if (idx === -1) return false;

    const meta = await ctx.client.spreadsheets.get({ spreadsheetId: ctx.sheetId });
    const sheet = meta.data.sheets?.find(s => s.properties?.title === "Dolares");
    if (sheet?.properties?.sheetId == null) return false;
    const innerSheetId = sheet.properties.sheetId;

    const rowIndex = idx + 1; // fila 1 = header, datos arrancan en índice 1
    await ctx.client.spreadsheets.batchUpdate({
      spreadsheetId: ctx.sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: innerSheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            }
          }
        }]
      }
    });
    return true;
  } catch (e) {
    console.error("Error deleting dolar op:", e);
    return false;
  }
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = await loadConfig();
  if (!config.googleSheetId) return { ok: false, error: "Sheet ID no configurado" };
  if (!config.googleCredsPath) return { ok: false, error: "Credenciales no configuradas" };

  const ctx = await getSheetsClient();
  if (!ctx) return { ok: false, error: "No se pudo autenticar con Google" };

  try {
    const meta = await ctx.client.spreadsheets.get({ spreadsheetId: ctx.sheetId });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error desconocido" };
  }
}

import { google, sheets_v4 } from "googleapis";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { Transaction, Sueldo, AppConfig, DolarOperacion, AhorroConfig, SobreKey } from "@/types";
import { AppError, SheetsError } from "@/lib/errors";

/**
 * Config de arranque (bootstrap): SOLO Sheet ID y credenciales, para poder
 * conectarse a Sheets. Vienen de env vars (Vercel) o del archivo local (dev).
 * Los ajustes editables (nombre, TNA, días de tarjeta) NO se leen de env vars:
 * viven únicamente en la hoja Config — ver loadConfig más abajo.
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

/** Config bootstrap: SOLO Sheet ID + credenciales (env o archivo local). No toca
 *  la red (Sheets) ni lee ajustes editables — eso es trabajo de loadConfig.
 *  La usa getSheetsClient, por eso tampoco puede leer de la hoja (sería recursivo). */
async function loadBootstrapConfig(): Promise<AppConfig> {
  // Primero intentar archivo local
  let fileConfig: Partial<AppConfig> = {};
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    fileConfig = JSON.parse(raw);
  } catch {
    // No existe o no se puede leer (normal en Vercel)
  }

  // Las env vars sobreescriben el archivo local. Solo Sheet ID y credenciales:
  // son secretos/datos de arranque, no ajustes — esos viven solo en la hoja Config.
  const envConfig: Partial<AppConfig> = {};
  if (process.env.GOOGLE_SHEET_ID) envConfig.googleSheetId = process.env.GOOGLE_SHEET_ID;
  if (process.env.GOOGLE_CREDS_PATH) envConfig.googleCredsPath = process.env.GOOGLE_CREDS_PATH;

  return { ...DEFAULT_CONFIG, ...fileConfig, ...envConfig };
}

/** Ajustes editables por el usuario ↔ claves en la hoja Config (clave/valor).
 *  NO incluye googleSheetId ni googleCredsPath: son bootstrap/secretos y no se
 *  pueden guardar dentro de la propia hoja que hace falta para alcanzarla. */
const APP_SETTING_MAP: Array<[keyof AppConfig, string]> = [
  ["nombre", "app_nombre"],
  ["mpTna", "mp_tna"],
  ["cardCutoffDay", "card_cutoff_day"],
  ["cardDueDay", "card_due_day"],
  ["salaryPaymentOffsetMonths", "salary_offset_months"],
];

/** Lee los ajustes editables de la hoja Config. Devuelve {} si no hay hoja aún. */
async function readAppSettingsFromSheet(): Promise<Partial<AppConfig>> {
  const ctx = await getSheetsClient();
  if (!ctx) return {};
  try {
    const r = await ctx.client.spreadsheets.values.get({
      spreadsheetId: ctx.sheetId,
      range: "Config!A2:B",
    });
    const map: Record<string, string> = {};
    for (const row of r.data.values ?? []) {
      const k = String(row[0] ?? "").trim();
      if (k) map[k] = String(row[1] ?? "");
    }
    const out: Partial<AppConfig> = {};
    for (const [field, key] of APP_SETTING_MAP) {
      const raw = map[key];
      if (raw === undefined || raw === "") continue;
      if (field === "nombre") {
        out.nombre = raw;
      } else {
        const n = field === "mpTna" ? parseFloat(raw.replace(",", ".")) : parseInt(raw, 10);
        if (isFinite(n)) (out as Record<string, unknown>)[field] = n;
      }
    }
    return out;
  } catch {
    // La hoja Config puede no existir todavía: usamos defaults/env.
    return {};
  }
}

/** Config efectiva = bootstrap (env/archivo) + ajustes editables de la hoja Config.
 *  La hoja es la fuente de verdad de los ajustes editables; sheetId y credenciales
 *  siempre vienen de env/archivo. */
export async function loadConfig(): Promise<AppConfig> {
  const bootstrap = await loadBootstrapConfig();
  const sheetSettings = await readAppSettingsFromSheet();
  return {
    ...bootstrap,
    ...sheetSettings,
    googleSheetId: bootstrap.googleSheetId,
    googleCredsPath: bootstrap.googleCredsPath,
  };
}

/** Upsert clave/valor en la hoja Config sin tocar las demás filas (ej. las de Ahorro). */
async function upsertConfigRows(
  client: sheets_v4.Sheets,
  sheetId: string,
  entries: Array<[string, string]>,
): Promise<void> {
  const r = await client.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Config!A2:B" });
  const rows = r.data.values ?? [];
  const keyToRow = new Map<string, number>();
  rows.forEach((row, i) => {
    const k = String(row[0] ?? "").trim();
    if (k) keyToRow.set(k, i + 2); // A2 => fila 2
  });

  const updates: Array<{ range: string; values: string[][] }> = [];
  const appends: string[][] = [];
  for (const [key, value] of entries) {
    const rowNum = keyToRow.get(key);
    if (rowNum) updates.push({ range: `Config!A${rowNum}:B${rowNum}`, values: [[key, value]] });
    else appends.push([key, value]);
  }

  if (updates.length) {
    await client.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
  if (appends.length) {
    await client.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Config!A:B",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appends },
    });
  }
}

/** Persiste los ajustes editables (los presentes en `partial`) en la hoja Config. */
async function saveAppSettingsToSheet(partial: Partial<AppConfig>): Promise<void> {
  const ctx = await getSheetsClient();
  if (!ctx) {
    // Antes esto retornaba silenciosamente: el POST respondía "ok" sin haber
    // guardado nada, y el cambio se perdía en el próximo request/deploy.
    throw new Error("No se pudo conectar a Google Sheets (revisá Sheet ID y credenciales)");
  }
  const entries: Array<[string, string]> = [];
  for (const [field, key] of APP_SETTING_MAP) {
    const v = partial[field];
    if (v !== undefined) entries.push([key, String(v)]);
  }
  if (!entries.length) return;
  await ensureSheets(ctx.client, ctx.sheetId);
  await upsertConfigRows(ctx.client, ctx.sheetId, entries);
}

export async function saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig();
  const merged = { ...current, ...config };

  // Fuente de verdad: la hoja Config. Si esto falla, el cambio no persiste de
  // verdad (en Vercel el filesystem es efímero) — hay que propagar el error
  // en vez de tragarlo, para no responder "guardado" cuando no se guardó nada.
  await saveAppSettingsToSheet(config);

  // Dev local: además a disco (incluye sheetId/creds para bootstrap sin env).
  try {
    await ensureConfigDir();
    const bootstrap = await loadBootstrapConfig();
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ ...bootstrap, ...config }, null, 2), "utf-8");
  } catch {
    // En Vercel el filesystem es read-only; los ajustes ya persistieron en la hoja.
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
  const config = await loadBootstrapConfig();
  if (!config.googleSheetId) return null;

  try {
    // Forma mínima de un JSON de cuenta de servicio (GoogleAuth valida el resto).
    let creds: { client_email?: string; private_key?: string; [k: string]: unknown };

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
  "cuotaNumero", "notas", "createdAt", "origen"
];

const SUELDO_HEADERS = [
  "id", "periodoTrabajado", "periodoPago", "empresa", "cargo",
  "bruto", "neto", "jubilacion", "obraSocial", "ley19032",
  "otrosDescuentos", "fechaPago", "createdAt"
];

const DOLAR_HEADERS = [
  "id", "fecha", "tipo", "montoUSD", "precioARS", "totalARS", "notas", "createdAt",
  "asigMediano", "asigLargo", "origen"
];

const CONFIG_HEADERS = ["parametro", "valor"];

/** Parámetros por defecto del plan de ahorro (se siembran al crear la hoja Config) */
const AHORRO_DEFAULTS: Array<[string, number]> = [
  ["emergencia_objetivo", 3000],
  ["sp500_retorno_anual", 7],
  ["mediano_auto_pct", 40],
  ["mediano_mud_pct", 25],
  ["mediano_vac_pct", 20],
  ["mediano_tec_pct", 15],
  ["objetivo_auto", 4000],
  ["objetivo_mud", 3000],
  ["objetivo_vac", 1000],
  ["objetivo_tec", 600],
];

const SOBRE_NOMBRES: Record<SobreKey, string> = {
  auto: "Cambiar el auto",
  mud: "Mudanza",
  vac: "Vacaciones",
  tec: "Tecnología",
};

async function ensureSheets(client: sheets_v4.Sheets, sheetId: string) {
  const meta = await client.spreadsheets.get({ spreadsheetId: sheetId });
  const existing = meta.data.sheets?.map(s => s.properties?.title) ?? [];

  // seedRows: filas de datos a sembrar al crear la hoja (además del header)
  const required: Array<{ name: string; headers: string[]; seedRows?: Array<Array<string | number>> }> = [
    { name: "Transacciones", headers: TX_HEADERS },
    { name: "Sueldos", headers: SUELDO_HEADERS },
    { name: "Dolares", headers: DOLAR_HEADERS },
    { name: "Config", headers: CONFIG_HEADERS, seedRows: AHORRO_DEFAULTS.map(([k, v]) => [k, v]) },
  ];

  for (const { name, headers, seedRows } of required) {
    if (!existing.includes(name)) {
      await client.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
      });
      const values = seedRows ? [headers, ...seedRows] : [headers];
      await client.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${name}!A1`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    } else {
      // La hoja ya existe: garantizar que el header exista y esté completo.
      // Si el header viejo tiene menos columnas de las esperadas (migración por
      // columnas nuevas), lo reescribimos sin tocar los datos de abajo.
      const r = await client.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${name}!A1:Z1`,
      });
      const current = r.data.values?.[0] ?? [];
      if (current.length < headers.length) {
        await client.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${name}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
      }
    }
  }
}

/** Una celda/fila tal como la devuelve la API de Sheets. */
type SheetCell = string | number | boolean | null | undefined;
type SheetRow = SheetCell[];

/** Texto de una celda; `def` si está vacía. */
function str(v: SheetCell, def = ""): string {
  return v === undefined || v === null || v === "" ? def : String(v);
}

/** Número de una celda (acepta coma decimal); 0 si no es numérica. */
function num(v: SheetCell): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Número opcional: undefined si la celda está vacía. */
function optNum(v: SheetCell): number | undefined {
  return v === undefined || v === null || v === "" ? undefined : num(v);
}

/** Convierte una fila plana a Transaction */
function rowToTransaction(row: SheetRow): Transaction {
  return {
    id: str(row[0]),
    fechaConsumo: str(row[1]),
    fechaPago: str(row[2]),
    tipo: str(row[3], "egreso") as Transaction["tipo"],
    descripcion: str(row[4]),
    monto: num(row[5]),
    moneda: str(row[6], "ARS") as Transaction["moneda"],
    categoria: str(row[7], "Otros"),
    subcategoria: str(row[8], "Sin categoría"),
    fuente: str(row[9], "manual") as Transaction["fuente"],
    cuotaTotal: Math.trunc(num(row[10])) || 1,
    cuotaNumero: Math.trunc(num(row[11])) || 1,
    notas: str(row[12]),
    createdAt: str(row[13], new Date().toISOString()),
    origen: (str(row[14]) || undefined) as Transaction["origen"],
  };
}

function transactionToRow(t: Transaction): SheetRow {
  return [
    t.id, t.fechaConsumo, t.fechaPago, t.tipo, t.descripcion, t.monto,
    t.moneda, t.categoria, t.subcategoria, t.fuente, t.cuotaTotal,
    t.cuotaNumero, t.notas, t.createdAt, t.origen ?? ""
  ];
}

function rowToSueldo(row: SheetRow): Sueldo {
  return {
    id: str(row[0]),
    periodoTrabajado: str(row[1]),
    periodoPago: str(row[2]),
    empresa: str(row[3]),
    cargo: str(row[4]),
    bruto: num(row[5]),
    neto: num(row[6]),
    jubilacion: num(row[7]),
    obraSocial: num(row[8]),
    ley19032: num(row[9]),
    otrosDescuentos: num(row[10]),
    fechaPago: str(row[11]),
    createdAt: str(row[12], new Date().toISOString()),
  };
}

function sueldoToRow(s: Sueldo): SheetRow {
  return [
    s.id, s.periodoTrabajado, s.periodoPago, s.empresa, s.cargo,
    s.bruto, s.neto, s.jubilacion, s.obraSocial, s.ley19032,
    s.otrosDescuentos, s.fechaPago, s.createdAt
  ];
}

function rowToDolar(row: SheetRow): DolarOperacion {
  const montoUSD = num(row[3]);
  const precioARS = num(row[4]);
  return {
    id: str(row[0]),
    fecha: str(row[1]),
    tipo: str(row[2], "compra") as DolarOperacion["tipo"],
    montoUSD,
    precioARS,
    // Recalcula por las dudas para que totalARS nunca quede inconsistente
    totalARS: num(row[5]) || montoUSD * precioARS,
    notas: str(row[6]),
    createdAt: str(row[7], new Date().toISOString()),
    asigMediano: optNum(row[8]),
    asigLargo: optNum(row[9]),
    origen: (str(row[10]) || undefined) as DolarOperacion["origen"],
  };
}

function dolarToRow(d: DolarOperacion): SheetRow {
  return [
    d.id, d.fecha, d.tipo, d.montoUSD, d.precioARS, d.totalARS, d.notas, d.createdAt,
    d.asigMediano ?? "", d.asigLargo ?? "", d.origen ?? ""
  ];
}

// ─── Acceso con errores explícitos ──────────────────────────────────────────
// Ninguna función pública se traga un error de Sheets devolviendo [] o false:
// una falla se propaga como SheetsError (503) para que la UI la muestre en vez
// de pintar "no hay movimientos" como si fuera real (y cachearlo).

type SheetsCtx = { client: sheets_v4.Sheets; sheetId: string };

async function requireSheets(): Promise<SheetsCtx> {
  const ctx = await getSheetsClient();
  if (!ctx) {
    throw new SheetsError("Google Sheets no está configurado: falta el Sheet ID o las credenciales.");
  }
  return ctx;
}

/** Ejecuta una operación contra Sheets y traduce cualquier falla a SheetsError. */
async function sheetsCall<T>(what: string, fn: (ctx: SheetsCtx) => Promise<T>): Promise<T> {
  const ctx = await requireSheets();
  try {
    return await fn(ctx);
  } catch (e) {
    if (e instanceof AppError) throw e;
    console.error(`[sheets] ${what}:`, e);
    throw new SheetsError();
  }
}

/** Las pestañas se verifican una vez por instancia del servidor, no en cada request
 *  (ensureSheets hace 1 + N llamadas a la API y Sheets tiene cuota por minuto). */
const ensured = new Set<string>();
async function ensureSheetsOnce(ctx: SheetsCtx): Promise<void> {
  if (ensured.has(ctx.sheetId)) return;
  await ensureSheets(ctx.client, ctx.sheetId);
  ensured.add(ctx.sheetId);
}

/** Número de fila (1-based) donde está el id en la columna A de la pestaña, o null. */
async function findRowNumber(ctx: SheetsCtx, tab: string, id: string): Promise<number | null> {
  const r = await ctx.client.spreadsheets.values.get({
    spreadsheetId: ctx.sheetId,
    range: `${tab}!A2:A`,
  });
  const idx = (r.data.values ?? []).findIndex((row) => row[0] === id);
  return idx === -1 ? null : idx + 2; // A2 => fila 2
}

async function updateRowById(tab: string, lastCol: string, id: string, row: SheetRow): Promise<boolean> {
  return sheetsCall(`actualizar fila en ${tab}`, async (ctx) => {
    const rowNumber = await findRowNumber(ctx, tab, id);
    if (rowNumber === null) return false;
    await ctx.client.spreadsheets.values.update({
      spreadsheetId: ctx.sheetId,
      range: `${tab}!A${rowNumber}:${lastCol}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
    return true;
  });
}

async function deleteRowById(tab: string, id: string): Promise<boolean> {
  return sheetsCall(`borrar fila en ${tab}`, async (ctx) => {
    const rowNumber = await findRowNumber(ctx, tab, id);
    if (rowNumber === null) return false;

    const meta = await ctx.client.spreadsheets.get({ spreadsheetId: ctx.sheetId });
    const innerSheetId = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
    if (innerSheetId == null) throw new SheetsError(`No se encontró la pestaña "${tab}" en la planilla.`);

    const rowIndex = rowNumber - 1; // deleteDimension es 0-based
    await ctx.client.spreadsheets.batchUpdate({
      spreadsheetId: ctx.sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: innerSheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        }],
      },
    });
    return true;
  });
}

async function appendRows(tab: string, lastCol: string, rows: SheetRow[]): Promise<void> {
  if (!rows.length) return;
  await sheetsCall(`agregar filas en ${tab}`, async (ctx) => {
    await ensureSheetsOnce(ctx);
    await ctx.client.spreadsheets.values.append({
      spreadsheetId: ctx.sheetId,
      range: `${tab}!A:${lastCol}`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  });
}

async function readRows(tab: string, range: string): Promise<SheetRow[]> {
  return sheetsCall(`leer ${tab}`, async (ctx) => {
    await ensureSheetsOnce(ctx);
    const r = await ctx.client.spreadsheets.values.get({ spreadsheetId: ctx.sheetId, range: `${tab}!${range}` });
    return ((r.data.values ?? []) as SheetRow[]).filter((row) => row[0]);
  });
}

// ─── API pública ────────────────────────────────────────────────────────────

export async function listTransactions(): Promise<Transaction[]> {
  return (await readRows("Transacciones", "A2:Q")).map(rowToTransaction);
}

export async function addTransaction(tx: Transaction): Promise<void> {
  await appendRows("Transacciones", "Q", [transactionToRow(tx)]);
}

export async function addTransactionsBulk(txs: Transaction[]): Promise<number> {
  await appendRows("Transacciones", "Q", txs.map(transactionToRow));
  return txs.length;
}

/** false si el id no existe. */
export async function updateTransaction(tx: Transaction): Promise<boolean> {
  return updateRowById("Transacciones", "Q", tx.id, transactionToRow(tx));
}

/** false si el id no existe. */
export async function deleteTransaction(id: string): Promise<boolean> {
  return deleteRowById("Transacciones", id);
}

export async function listSueldos(): Promise<Sueldo[]> {
  return (await readRows("Sueldos", "A2:M")).map(rowToSueldo);
}

export async function addSueldo(s: Sueldo): Promise<void> {
  await appendRows("Sueldos", "M", [sueldoToRow(s)]);
}

// ─── Operaciones de dólar ────────────────────────────────────────────────────

export async function listDolarOps(): Promise<DolarOperacion[]> {
  return (await readRows("Dolares", "A2:K")).map(rowToDolar);
}

export async function addDolarOp(op: DolarOperacion): Promise<void> {
  await appendRows("Dolares", "K", [dolarToRow(op)]);
}

/** false si el id no existe. */
export async function updateDolarOp(op: DolarOperacion): Promise<boolean> {
  return updateRowById("Dolares", "K", op.id, dolarToRow(op));
}

/** false si el id no existe. */
export async function deleteDolarOp(id: string): Promise<boolean> {
  return deleteRowById("Dolares", id);
}

// ─── Config del plan de ahorro (hoja "Config") ──────────────────────────────

function buildAhorroConfig(map: Record<string, number>): AhorroConfig {
  const g = (k: string, def: number) =>
    map[k] !== undefined && isFinite(map[k]) ? map[k] : def;
  return {
    emergenciaObjetivo: g("emergencia_objetivo", 3000),
    // En la hoja se guarda como porcentaje (7); acá lo pasamos a fracción (0.07)
    sp500RetornoAnual: g("sp500_retorno_anual", 7) / 100,
    sobres: [
      { key: "auto", nombre: SOBRE_NOMBRES.auto, pct: g("mediano_auto_pct", 40), objetivo: g("objetivo_auto", 4000) },
      { key: "mud", nombre: SOBRE_NOMBRES.mud, pct: g("mediano_mud_pct", 25), objetivo: g("objetivo_mud", 3000) },
      { key: "vac", nombre: SOBRE_NOMBRES.vac, pct: g("mediano_vac_pct", 20), objetivo: g("objetivo_vac", 1000) },
      { key: "tec", nombre: SOBRE_NOMBRES.tec, pct: g("mediano_tec_pct", 15), objetivo: g("objetivo_tec", 600) },
    ],
  };
}

/** Lee la hoja Config (clave/valor) y devuelve la configuración del ahorro con defaults.
 *  Si Sheets falla se propaga el error: mostrar los defaults como si fueran tus
 *  objetivos reales sería engañoso. */
export async function getAhorroConfig(): Promise<AhorroConfig> {
  const map: Record<string, number> = {};
  for (const row of await readRows("Config", "A2:B")) {
    const key = String(row[0] ?? "").trim();
    if (!key) continue;
    const val = parseFloat(String(row[1]).replace(",", "."));
    if (isFinite(val)) map[key] = val;
  }
  return buildAhorroConfig(map);
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = await loadBootstrapConfig();
  if (!config.googleSheetId) return { ok: false, error: "Sheet ID no configurado" };
  // Las credenciales pueden venir de la env var (Vercel) o de un archivo local.
  if (!process.env.GOOGLE_SHEETS_CREDS_JSON && !config.googleCredsPath) {
    return { ok: false, error: "Credenciales no configuradas" };
  }

  const ctx = await getSheetsClient();
  if (!ctx) return { ok: false, error: "No se pudo autenticar con Google (revisá las credenciales)" };

  try {
    await ctx.client.spreadsheets.get({ spreadsheetId: ctx.sheetId, fields: "spreadsheetId" });
    return { ok: true };
  } catch (e) {
    console.error("[sheets] testConnection:", e);
    return { ok: false, error: "No se pudo abrir la planilla. Revisá el Sheet ID y que esté compartida con la cuenta de servicio." };
  }
}

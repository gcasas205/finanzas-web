import { google, sheets_v4 } from "googleapis";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type {
  Transaction, Sueldo, AppConfig, DolarOperacion, AhorroConfig, MovAhorro,
  CategoryConfig, ReglaCategoria, Recurrente,
} from "@/types";
import { CATEGORIES } from "@/lib/categories";
import { parseAhorroConfig, ahorroConfigToEntries, parsePresupuestos, presupuestosToEntries } from "@/lib/ahorro-config";
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
    const filas = (await leerPlanilla(ctx)).Config ?? [];
    const map: Record<string, string> = {};
    for (const row of filas) {
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
  invalidarLectura();
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
  await ensureSheetsOnce(ctx);
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
/** Un cliente por instancia: crear GoogleAuth en cada request pedía un token nuevo cada vez. */
let clienteCache: { clave: string; ctx: { client: sheets_v4.Sheets; sheetId: string } } | null = null;

async function getSheetsClient(): Promise<{ client: sheets_v4.Sheets; sheetId: string } | null> {
  const config = await loadBootstrapConfig();
  if (!config.googleSheetId) return null;
  const clave = `${config.googleSheetId}|${process.env.GOOGLE_SHEETS_CREDS_JSON ? "env" : config.googleCredsPath}`;
  if (clienteCache?.clave === clave) return clienteCache.ctx;

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
    // Sin reintentos automáticos ante 429 (cuota por minuto): reintentar al toque
    // gasta más cuota. Sólo se reintentan errores del servidor de Google (5xx).
    const client = google.sheets({
      version: "v4",
      auth,
      retryConfig: { retry: 2, statusCodesToRetry: [[500, 599]] },
    });
    clienteCache = { clave, ctx: { client, sheetId: config.googleSheetId } };
    return clienteCache.ctx;
  } catch (e) {
    console.error("Error inicializando Google Sheets:", e);
    return null;
  }
}

/** Asegura que existen las pestañas necesarias con encabezados */
const TX_HEADERS = [
  "id", "fechaConsumo", "fechaPago", "tipo", "descripcion", "monto",
  "moneda", "categoria", "subcategoria", "fuente", "cuotaTotal",
  "cuotaNumero", "notas", "createdAt", "origen",
  "asigMediano", "asigLargo", "grupoCuotas"
];

const SUELDO_HEADERS = [
  "id", "periodoTrabajado", "periodoPago", "empresa", "cargo",
  "bruto", "neto", "jubilacion", "obraSocial", "ley19032",
  "otrosDescuentos", "fechaPago", "createdAt", "txId"
];

const DOLAR_HEADERS = [
  "id", "fecha", "tipo", "montoUSD", "precioARS", "totalARS", "notas", "createdAt",
  "asigMediano", "asigLargo", "origen"
];

const CONFIG_HEADERS = ["parametro", "valor"];

const MOV_AHORRO_HEADERS = ["id", "fecha", "desde", "hacia", "montoUSD", "notas", "createdAt"];

const CATEGORIAS_HEADERS = ["nombre", "subcategorias", "color"];
const REGLAS_HEADERS = ["palabra", "categoria", "subcategoria"];
const RECURRENTES_HEADERS = [
  "id", "descripcion", "monto", "moneda", "tipo", "categoria", "subcategoria",
  "fuente", "dia", "activo", "ultimoMes", "createdAt",
];

/** Las subcategorías se guardan en una celda separadas por " | ". */
const SEP_SUB = " | ";

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


async function ensureSheets(client: sheets_v4.Sheets, sheetId: string) {
  // Lecturas: 1 para saber qué pestañas hay y 1 para todos los encabezados juntos
  // (antes era 1 por pestaña: con 8 pestañas se iba casi toda la cuota por minuto).
  const meta = await client.spreadsheets.get({ spreadsheetId: sheetId, fields: "sheets.properties.title" });
  const existing = meta.data.sheets?.map(s => s.properties?.title) ?? [];

  // seedRows: filas de datos a sembrar al crear la hoja (además del header)
  const required: Array<{ name: string; headers: string[]; seedRows?: Array<Array<string | number>> }> = [
    { name: "Transacciones", headers: TX_HEADERS },
    { name: "Sueldos", headers: SUELDO_HEADERS },
    { name: "Dolares", headers: DOLAR_HEADERS },
    { name: "Config", headers: CONFIG_HEADERS, seedRows: AHORRO_DEFAULTS.map(([k, v]) => [k, v]) },
    { name: "MovAhorro", headers: MOV_AHORRO_HEADERS },
    { name: "Categorias", headers: CATEGORIAS_HEADERS, seedRows: CATEGORIES.map(categoriaToRow) as Array<Array<string | number>> },
    { name: "Reglas", headers: REGLAS_HEADERS },
    { name: "Recurrentes", headers: RECURRENTES_HEADERS },
  ];

  const presentes = required.filter(({ name }) => existing.includes(name));
  const encabezados = new Map<string, unknown[]>();
  if (presentes.length) {
    const r = await client.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: presentes.map(({ name }) => `${name}!A1:Z1`),
    });
    (r.data.valueRanges ?? []).forEach((vr, i) => encabezados.set(presentes[i].name, vr.values?.[0] ?? []));
  }

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
      const current = encabezados.get(name) ?? [];
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

/** Convierte una fila plana a Transaction (exportada para tests) */
export function rowToTransaction(row: SheetRow): Transaction {
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
    asigMediano: optNum(row[15]),
    asigLargo: optNum(row[16]),
    grupoCuotas: str(row[17]) || undefined,
  };
}

/** Convierte una Transaction a fila plana (exportada para tests) */
export function transactionToRow(t: Transaction): SheetRow {
  return [
    t.id, t.fechaConsumo, t.fechaPago, t.tipo, t.descripcion, t.monto,
    t.moneda, t.categoria, t.subcategoria, t.fuente, t.cuotaTotal,
    t.cuotaNumero, t.notas, t.createdAt, t.origen ?? "",
    t.asigMediano ?? "", t.asigLargo ?? "", t.grupoCuotas ?? ""
  ];
}

/** Convierte una fila plana a Sueldo (exportada para tests) */
export function rowToSueldo(row: SheetRow): Sueldo {
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
    txId: str(row[13]) || undefined,
  };
}

/** Convierte un Sueldo a fila plana (exportada para tests) */
export function sueldoToRow(s: Sueldo): SheetRow {
  return [
    s.id, s.periodoTrabajado, s.periodoPago, s.empresa, s.cargo,
    s.bruto, s.neto, s.jubilacion, s.obraSocial, s.ley19032,
    s.otrosDescuentos, s.fechaPago, s.createdAt, s.txId ?? ""
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
    if (esLimiteDeCuota(e)) {
      throw new SheetsError("Google está limitando las lecturas de tu planilla por un momento. Probá de nuevo en un minuto.");
    }
    throw new SheetsError();
  }
}

function esLimiteDeCuota(e: unknown): boolean {
  const o = (e ?? {}) as { code?: unknown; status?: unknown };
  return o.code === 429 || o.status === 429;
}

/** Las pestañas se verifican una vez por instancia del servidor, no en cada request
 *  (ensureSheets hace 1 + N llamadas a la API y Sheets tiene cuota por minuto). */
const ensuring = new Map<string, Promise<void>>();
function ensureSheetsOnce(ctx: SheetsCtx): Promise<void> {
  let p = ensuring.get(ctx.sheetId);
  if (!p) {
    p = ensureSheets(ctx.client, ctx.sheetId);
    ensuring.set(ctx.sheetId, p);
    p.catch(() => ensuring.delete(ctx.sheetId)); // si falla, el próximo pedido reintenta
  }
  return p;
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
  const resultado = await sheetsCall(`actualizar fila en ${tab}`, async (ctx) => {
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
  invalidarLectura();
  return resultado;
}

/** Actualiza varias filas en una sola escritura. Devuelve los ids que no existían. */
async function updateRowsByIds(tab: string, lastCol: string, rows: Array<{ id: string; row: SheetRow }>): Promise<string[]> {
  if (!rows.length) return [];
  const resultado = await sheetsCall(`actualizar filas en ${tab}`, async (ctx) => {
    const r = await ctx.client.spreadsheets.values.get({ spreadsheetId: ctx.sheetId, range: `${tab}!A2:A` });
    const index = new Map<string, number>();
    (r.data.values ?? []).forEach((v, i) => { if (v[0]) index.set(String(v[0]), i + 2); });
    const faltan: string[] = [];
    const data = rows.flatMap(({ id, row }) => {
      const n = index.get(id);
      if (n === undefined) { faltan.push(id); return []; }
      return [{ range: `${tab}!A${n}:${lastCol}${n}`, values: [row] }];
    });
    if (data.length) {
      await ctx.client.spreadsheets.values.batchUpdate({
        spreadsheetId: ctx.sheetId,
        requestBody: { valueInputOption: "RAW", data },
      });
    }
    return faltan;
  });
  invalidarLectura();
  return resultado;
}

async function deleteRowById(tab: string, id: string): Promise<boolean> {
  const resultado = await sheetsCall(`borrar fila en ${tab}`, async (ctx) => {
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
  invalidarLectura();
  return resultado;
}

/** Borra varias filas en una sola llamada. Devuelve cuántas encontró y borró. */
async function deleteRowsByIds(tab: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const resultado = await sheetsCall(`borrar filas en ${tab}`, async (ctx) => {
    const r = await ctx.client.spreadsheets.values.get({ spreadsheetId: ctx.sheetId, range: `${tab}!A2:A` });
    const buscados = new Set(ids);
    const indices: number[] = [];
    (r.data.values ?? []).forEach((v, i) => { if (buscados.has(String(v[0]))) indices.push(i + 1); }); // 0-based con header
    if (!indices.length) return 0;

    const meta = await ctx.client.spreadsheets.get({ spreadsheetId: ctx.sheetId });
    const innerSheetId = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
    if (innerSheetId == null) throw new SheetsError(`No se encontró la pestaña "${tab}" en la planilla.`);

    // De abajo hacia arriba, para que borrar una fila no corra las siguientes
    const requests = indices.sort((a, b) => b - a).map((i) => ({
      deleteDimension: { range: { sheetId: innerSheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } },
    }));
    await ctx.client.spreadsheets.batchUpdate({ spreadsheetId: ctx.sheetId, requestBody: { requests } });
    return indices.length;
  });
  invalidarLectura();
  return resultado;
}

/** Reemplaza todas las filas de datos de una pestaña (para listas chicas como categorías). */
async function replaceAllRows(tab: string, lastCol: string, rows: SheetRow[]): Promise<void> {
  await sheetsCall(`reescribir ${tab}`, async (ctx) => {
    await ensureSheetsOnce(ctx);
    await ctx.client.spreadsheets.values.clear({ spreadsheetId: ctx.sheetId, range: `${tab}!A2:${lastCol}` });
    if (rows.length) {
      await ctx.client.spreadsheets.values.update({
        spreadsheetId: ctx.sheetId,
        range: `${tab}!A2`,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });
    }
  });
  invalidarLectura();
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
  invalidarLectura();
}

/** Rango de datos de cada pestaña. Se leen TODAS juntas en una sola lectura. */
const RANGOS_DATOS: Record<string, string> = {
  Transacciones: "A2:R",
  Sueldos: "A2:N",
  Dolares: "A2:K",
  Config: "A2:B",
  MovAhorro: "A2:G",
  Categorias: "A2:C",
  Reglas: "A2:C",
  Recurrentes: "A2:L",
};
/** Cuánto vale una lectura compartida: cubre la ráfaga de pedidos al abrir la app. */
const LECTURA_TTL_MS = 30_000;

let lectura: { at: number; datos: Promise<Record<string, SheetRow[]>> } | null = null;

/** Tras cualquier escritura, la próxima lectura vuelve a la planilla. */
function invalidarLectura(): void {
  lectura = null;
}

/**
 * Todas las pestañas en una sola llamada (values.batchGet = 1 lectura de la cuota),
 * compartida entre los pedidos simultáneos y reutilizada unos segundos. Antes cada
 * listado hacía su propia lectura y abrir la app superaba las 60 lecturas/minuto.
 */
function leerPlanilla(ctx: SheetsCtx): Promise<Record<string, SheetRow[]>> {
  if (lectura && Date.now() - lectura.at < LECTURA_TTL_MS) return lectura.datos;
  const tabs = Object.keys(RANGOS_DATOS);
  const datos = (async () => {
    await ensureSheetsOnce(ctx);
    const r = await ctx.client.spreadsheets.values.batchGet({
      spreadsheetId: ctx.sheetId,
      ranges: tabs.map((t) => `${t}!${RANGOS_DATOS[t]}`),
    });
    const out: Record<string, SheetRow[]> = {};
    (r.data.valueRanges ?? []).forEach((vr, i) => {
      out[tabs[i]] = ((vr.values ?? []) as SheetRow[]).filter((row) => row[0]);
    });
    return out;
  })();
  const actual = { at: Date.now(), datos };
  lectura = actual;
  datos.catch(() => { if (lectura === actual) lectura = null; }); // los errores no se cachean
  return datos;
}

async function readRows(tab: string): Promise<SheetRow[]> {
  return sheetsCall(`leer ${tab}`, async (ctx) => (await leerPlanilla(ctx))[tab] ?? []);
}

// ─── API pública ────────────────────────────────────────────────────────────

export async function listTransactions(): Promise<Transaction[]> {
  return (await readRows("Transacciones")).map(rowToTransaction);
}

export async function addTransaction(tx: Transaction): Promise<void> {
  await appendRows("Transacciones", "R", [transactionToRow(tx)]);
}

export async function addTransactionsBulk(txs: Transaction[]): Promise<number> {
  await appendRows("Transacciones", "R", txs.map(transactionToRow));
  return txs.length;
}

/** false si el id no existe. */
export async function updateTransaction(tx: Transaction): Promise<boolean> {
  return updateRowById("Transacciones", "R", tx.id, transactionToRow(tx));
}

/** Actualiza varios movimientos en una sola escritura. Devuelve los ids que no existían. */
export async function updateTransactionsBulk(txs: Transaction[]): Promise<string[]> {
  return updateRowsByIds("Transacciones", "R", txs.map((t) => ({ id: t.id, row: transactionToRow(t) })));
}

/** Borra varios movimientos (ej. las cuotas de un grupo). Devuelve cuántos borró. */
export async function deleteTransactionsBulk(ids: string[]): Promise<number> {
  return deleteRowsByIds("Transacciones", ids);
}

/** false si el id no existe. */
export async function deleteTransaction(id: string): Promise<boolean> {
  return deleteRowById("Transacciones", id);
}

export async function listSueldos(): Promise<Sueldo[]> {
  return (await readRows("Sueldos")).map(rowToSueldo);
}

export async function addSueldo(s: Sueldo): Promise<void> {
  await appendRows("Sueldos", "N", [sueldoToRow(s)]);
}

/** false si el id no existe. */
export async function updateSueldo(s: Sueldo): Promise<boolean> {
  return updateRowById("Sueldos", "N", s.id, sueldoToRow(s));
}

/** false si el id no existe. */
export async function deleteSueldo(id: string): Promise<boolean> {
  return deleteRowById("Sueldos", id);
}

// ─── Operaciones de dólar ────────────────────────────────────────────────────

export async function listDolarOps(): Promise<DolarOperacion[]> {
  return (await readRows("Dolares")).map(rowToDolar);
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

/** Hoja Config como mapa clave → valor (texto). */
async function readConfigRaw(): Promise<Record<string, string>> {
  const raw: Record<string, string> = {};
  for (const row of await readRows("Config")) {
    const key = String(row[0] ?? "").trim();
    if (key) raw[key] = String(row[1] ?? "");
  }
  return raw;
}

/** Escribe claves en Config sin tocar las demás filas. */
async function writeConfigEntries(entries: Array<[string, string]>): Promise<void> {
  if (!entries.length) return;
  await sheetsCall("guardar en Config", async (ctx) => {
    await ensureSheetsOnce(ctx);
    await upsertConfigRows(ctx.client, ctx.sheetId, entries);
  });
}

/** Lee la hoja Config (clave/valor) y devuelve la configuración del ahorro con defaults.
 *  Si Sheets falla se propaga el error: mostrar los defaults como si fueran tus
 *  objetivos reales sería engañoso. */
export async function getAhorroConfig(): Promise<AhorroConfig> {
  return parseAhorroConfig(await readConfigRaw());
}

/** Guarda el plan de ahorro completo (piso, rendimiento y sobres) en Config. */
export async function saveAhorroConfig(cfg: AhorroConfig): Promise<void> {
  await writeConfigEntries(ahorroConfigToEntries(cfg));
}

/** Presupuesto mensual por categoría (en pesos). */
export async function getPresupuestos(): Promise<Record<string, number>> {
  return parsePresupuestos(await readConfigRaw());
}

export async function savePresupuestos(presupuestos: Record<string, number>): Promise<void> {
  const anteriores = await getPresupuestos();
  await writeConfigEntries(presupuestosToEntries(presupuestos, anteriores));
}

// ─── Pases entre destinos del ahorro (hoja "MovAhorro") ─────────────────────

function rowToMovAhorro(row: SheetRow): MovAhorro {
  return {
    id: str(row[0]),
    fecha: str(row[1]),
    desde: str(row[2]),
    hacia: str(row[3]),
    montoUSD: num(row[4]),
    notas: str(row[5]),
    createdAt: str(row[6], new Date().toISOString()),
  };
}

function movAhorroToRow(m: MovAhorro): SheetRow {
  return [m.id, m.fecha, m.desde, m.hacia, m.montoUSD, m.notas, m.createdAt];
}

export async function listMovAhorro(): Promise<MovAhorro[]> {
  return (await readRows("MovAhorro")).map(rowToMovAhorro);
}

export async function addMovAhorro(m: MovAhorro): Promise<void> {
  await appendRows("MovAhorro", "G", [movAhorroToRow(m)]);
}

/** false si el id no existe. */
export async function deleteMovAhorro(id: string): Promise<boolean> {
  return deleteRowById("MovAhorro", id);
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
    await leerPlanilla(ctx); // la misma lectura que usan los listados: no gasta cuota extra
    return { ok: true };
  } catch (e) {
    console.error("[sheets] testConnection:", e);
    if (esLimiteDeCuota(e)) {
      return { ok: false, error: "Google está limitando las lecturas por un momento. Probá de nuevo en un minuto." };
    }
    return { ok: false, error: "No se pudo abrir la planilla. Revisá el Sheet ID y que esté compartida con la cuenta de servicio." };
  }
}

// ─── Categorías, reglas aprendidas y gastos fijos ───────────────────────────

function categoriaToRow(c: CategoryConfig): SheetRow {
  return [c.name, c.subcategories.join(SEP_SUB), c.color];
}

function rowToCategoria(row: SheetRow): CategoryConfig {
  const subs = str(row[1]).split("|").map((x) => x.trim()).filter(Boolean);
  return {
    name: str(row[0]),
    subcategories: subs.length ? subs : ["Sin categoría"],
    color: str(row[2]) || CATEGORIES[CATEGORIES.length - 1].color,
  };
}

/** Categorías de la planilla; si la pestaña está vacía, las de por defecto. */
export async function listCategorias(): Promise<CategoryConfig[]> {
  const cats = (await readRows("Categorias")).map(rowToCategoria);
  return cats.length ? cats : CATEGORIES;
}

export async function saveCategorias(cats: CategoryConfig[]): Promise<void> {
  await replaceAllRows("Categorias", "C", cats.map(categoriaToRow));
}

export async function listReglas(): Promise<ReglaCategoria[]> {
  return (await readRows("Reglas")).map((r) => ({
    palabra: str(r[0]),
    categoria: str(r[1]),
    subcategoria: str(r[2]),
  }));
}

export async function saveReglas(reglas: ReglaCategoria[]): Promise<void> {
  await replaceAllRows("Reglas", "C", reglas.map((r) => [r.palabra, r.categoria, r.subcategoria]));
}

function rowToRecurrente(row: SheetRow): Recurrente {
  return {
    id: str(row[0]),
    descripcion: str(row[1]),
    monto: num(row[2]),
    moneda: str(row[3], "ARS") as Recurrente["moneda"],
    tipo: str(row[4], "egreso") as Recurrente["tipo"],
    categoria: str(row[5], "Otros"),
    subcategoria: str(row[6], "Sin categoría"),
    fuente: str(row[7], "manual") as Recurrente["fuente"],
    dia: Math.min(31, Math.max(1, Math.trunc(num(row[8])) || 1)),
    activo: str(row[9], "1") !== "0",
    ultimoMes: str(row[10]),
    createdAt: str(row[11], new Date().toISOString()),
  };
}

function recurrenteToRow(r: Recurrente): SheetRow {
  return [
    r.id, r.descripcion, r.monto, r.moneda, r.tipo, r.categoria, r.subcategoria,
    r.fuente, r.dia, r.activo ? "1" : "0", r.ultimoMes, r.createdAt,
  ];
}

export async function listRecurrentes(): Promise<Recurrente[]> {
  return (await readRows("Recurrentes")).map(rowToRecurrente);
}

export async function addRecurrente(r: Recurrente): Promise<void> {
  await appendRows("Recurrentes", "L", [recurrenteToRow(r)]);
}

/** Devuelve los ids que no existían. */
export async function updateRecurrentes(rs: Recurrente[]): Promise<string[]> {
  return updateRowsByIds("Recurrentes", "L", rs.map((r) => ({ id: r.id, row: recurrenteToRow(r) })));
}

/** false si el id no existe. */
export async function deleteRecurrente(id: string): Promise<boolean> {
  return deleteRowById("Recurrentes", id);
}

import type { Cotizacion } from "@/types";

/**
 * Cotización del dólar oficial. Fuente principal: la API JSON de dolarapi.com
 * (estable, no depende del HTML de un sitio). Respaldo: scraping de dolarhoy.com.
 *
 * Respaldo — scraper de la cotización del dólar oficial desde dolarhoy.com.
 *
 * Fuente principal: la HOME (https://dolarhoy.com/), que se actualiza a diario.
 * La página dedicada /cotizaciondolaroficial a veces queda congelada en
 * dolarhoy (bug de ellos), por eso NO se usa como fuente principal.
 *
 * En la home, el recuadro del oficial está anclado por
 *   aria-label="Link a Dólar Oficial"
 * y los dos primeros <div class="val"> son compra y venta.
 *
 * Se cachea en memoria del proceso para no pegarle a dolarhoy en cada request.
 */

const HOME_URL = "https://dolarhoy.com/";
const API_URL = "https://dolarapi.com/v1/dolares/oficial";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cache: { data: Cotizacion; at: number } | null = null;

/** Convierte "1.485,00" o "1485" (formato AR) a number */
function parseNumAR(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function parseHome(html: string): { compra: number; venta: number } {
  const i = html.search(/aria-label="Link a D[oó]lar Oficial"/i);
  if (i === -1) throw new Error("No se encontró el recuadro del dólar oficial en la home");
  const block = html.slice(i, i + 900);
  const vals = [...block.matchAll(/<div class="val">\s*\$?\s*([\d.,]+)\s*<\/div>/gi)].map(m => m[1]);
  if (vals.length < 2) throw new Error("No se encontraron los valores de compra/venta");
  const compra = parseNumAR(vals[0]);
  const venta = parseNumAR(vals[1]);
  // Sanidad: valores plausibles y venta >= compra
  if (!compra || !venta || compra < 100 || venta < compra) {
    throw new Error(`Valores inválidos: compra=${compra} venta=${venta}`);
  }
  return { compra, venta };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; finanzas-web/1.0; +https://github.com/gcasas205/finanzas-web)",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`dolarhoy respondió ${res.status}`);
  return res.text();
}

/** Valida la respuesta de dolarapi: { compra, venta, fechaActualizacion }. */
export function parseDolarApi(json: unknown): { compra: number; venta: number; actualizado: string | null } {
  const o = (json ?? {}) as Record<string, unknown>;
  const compra = Number(o.compra);
  const venta = Number(o.venta);
  if (!(compra >= 100) || !(venta >= compra)) {
    throw new Error(`Valores inválidos de dolarapi: compra=${o.compra} venta=${o.venta}`);
  }
  const actualizado = typeof o.fechaActualizacion === "string" ? o.fechaActualizacion : null;
  return { compra, venta, actualizado };
}

async function fetchDolarApi(): Promise<{ compra: number; venta: number; actualizado: string | null }> {
  const res = await fetch(API_URL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`);
  return parseDolarApi(await res.json());
}

/**
 * Devuelve la cotización oficial. Usa caché de 5 minutos.
 * Si el scraping falla y hay caché (aunque vencida), la devuelve.
 */
export async function getCotizacionOficial(force = false): Promise<Cotizacion> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL) {
    return cache.data;
  }

  try {
    const { compra, venta, actualizado } = await fetchDolarApi();
    const data: Cotizacion = { compra, venta, actualizado, fetchedAt: new Date().toISOString(), fuente: "dolarapi" };
    cache = { data, at: now };
    return data;
  } catch (e) {
    console.error("Error obteniendo cotización de dolarapi, pruebo dolarhoy:", e);
  }

  try {
    const html = await fetchHtml(HOME_URL);
    const { compra, venta } = parseHome(html);
    const data: Cotizacion = {
      compra,
      venta,
      actualizado: null, // la home no expone un timestamp por recuadro; usamos fetchedAt
      fetchedAt: new Date().toISOString(),
      fuente: "dolarhoy",
    };
    cache = { data, at: now };
    return data;
  } catch (e) {
    console.error("Error obteniendo cotización de dolarhoy:", e);
    if (cache) return cache.data;
    throw e;
  }
}
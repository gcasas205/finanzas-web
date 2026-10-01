/**
 * Inflación mensual (IPC INDEC) para expresar montos en "pesos de hoy".
 * Fuente: api.argentinadatos.com, que publica la variación % de cada mes.
 */

const API_URL = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion";
const CACHE_TTL = 12 * 60 * 60 * 1000; // el IPC sale una vez por mes

export interface InflacionMes {
  /** "AAAA-MM" */
  mes: string;
  /** Variación mensual en %, ej. 2.7 */
  pct: number;
}

/** Valida y normaliza la respuesta [{ fecha: "AAAA-MM-DD", valor: 2.7 }, ...]. */
export function parseInflacion(json: unknown): InflacionMes[] {
  if (!Array.isArray(json)) throw new Error("Respuesta de inflación inválida");
  const serie = json
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const mes = typeof o.fecha === "string" ? o.fecha.slice(0, 7) : "";
      const pct = Number(o.valor);
      return /^\d{4}-\d{2}$/.test(mes) && Number.isFinite(pct) && pct > -50 && pct < 100 ? { mes, pct } : null;
    })
    .filter((x): x is InflacionMes => x !== null)
    .sort((a, b) => a.mes.localeCompare(b.mes));
  if (!serie.length) throw new Error("La serie de inflación vino vacía");
  return serie;
}

let cache: { data: InflacionMes[]; at: number } | null = null;

/** Serie mensual de inflación, con caché de 12 h. Si falla y hay caché, la devuelve. */
export async function getInflacion(): Promise<InflacionMes[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.data;
  try {
    const res = await fetch(API_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`argentinadatos respondió ${res.status}`);
    const data = parseInflacion(await res.json());
    cache = { data, at: Date.now() };
    return data;
  } catch (e) {
    console.error("Error obteniendo inflación:", e);
    if (cache) return cache.data;
    throw e;
  }
}

/**
 * Factor para llevar un monto de cada mes a pesos del último mes publicado:
 * el producto de (1 + inflación) de todos los meses POSTERIORES. Los meses sin
 * dato todavía (el actual, el anterior si no salió el IPC) quedan con factor 1.
 */
export function factoresPesosDeHoy(serie: InflacionMes[]): (mes: string) => number {
  const factores = new Map<string, number>();
  let acum = 1;
  for (let i = serie.length - 1; i >= 0; i--) {
    factores.set(serie[i].mes, acum);
    acum *= 1 + serie[i].pct / 100;
  }
  const primero = serie[0]?.mes;
  return (mes: string) => {
    const f = factores.get(mes);
    if (f !== undefined) return f;
    // Antes del primer dato: el factor máximo; después del último: 1
    return primero && mes < primero ? acum : 1;
  };
}

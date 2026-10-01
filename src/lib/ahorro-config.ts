import type { AhorroConfig, AhorroSobreConfig } from "@/types";

/**
 * Plan de ahorro guardado en la hoja Config (clave/valor). Formato:
 *   emergencia_objetivo, sp500_retorno_anual (en %)
 *   sobres_lista = "auto,mud,vac,tec"        ← qué sobres hay y en qué orden
 *   mediano_<k>_pct, objetivo_<k>            ← los mismos nombres de siempre
 *   sobre_<k>_nombre, sobre_<k>_fecha (AAAA-MM, opcional)
 * Sin `sobres_lista` (planillas anteriores) se usan los 4 sobres originales.
 */

const SOBRES_ORIGINALES: Array<[string, string, number, number]> = [
  ["auto", "Cambiar el auto", 40, 4000],
  ["mud", "Mudanza", 25, 3000],
  ["vac", "Vacaciones", 20, 1000],
  ["tec", "Tecnología", 15, 600],
];

export const SOBRE_KEY_RE = /^[a-z0-9_]{1,24}$/;

function numero(raw: Record<string, string>, k: string, def: number): number {
  const v = parseFloat(String(raw[k] ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : def;
}

export function parseAhorroConfig(raw: Record<string, string>): AhorroConfig {
  const originales = new Map(SOBRES_ORIGINALES.map(([k, n, p, o]) => [k, { n, p, o }]));
  const lista = raw.sobres_lista !== undefined
    ? raw.sobres_lista.split(",").map((k) => k.trim()).filter((k) => SOBRE_KEY_RE.test(k))
    : SOBRES_ORIGINALES.map(([k]) => k);
  const sobres: AhorroSobreConfig[] = lista.map((key) => {
    const def = originales.get(key);
    const fecha = (raw[`sobre_${key}_fecha`] ?? "").trim();
    return {
      key,
      nombre: (raw[`sobre_${key}_nombre`] ?? "").trim() || def?.n || key,
      pct: numero(raw, `mediano_${key}_pct`, def?.p ?? 0),
      objetivo: numero(raw, `objetivo_${key}`, def?.o ?? 0),
      ...(/^\d{4}-\d{2}$/.test(fecha) ? { fechaObjetivo: fecha } : {}),
    };
  });
  return {
    emergenciaObjetivo: numero(raw, "emergencia_objetivo", 3000),
    // En la hoja se guarda como porcentaje (7); acá lo pasamos a fracción (0.07)
    sp500RetornoAnual: numero(raw, "sp500_retorno_anual", 7) / 100,
    sobres,
  };
}

/** Claves/valores a escribir en Config para guardar el plan. */
export function ahorroConfigToEntries(cfg: AhorroConfig): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    ["emergencia_objetivo", String(cfg.emergenciaObjetivo)],
    ["sp500_retorno_anual", String(Math.round(cfg.sp500RetornoAnual * 10000) / 100)],
    ["sobres_lista", cfg.sobres.map((s) => s.key).join(",")],
  ];
  for (const s of cfg.sobres) {
    entries.push(
      [`sobre_${s.key}_nombre`, s.nombre],
      [`mediano_${s.key}_pct`, String(s.pct)],
      [`objetivo_${s.key}`, String(s.objetivo)],
      [`sobre_${s.key}_fecha`, s.fechaObjetivo ?? ""],
    );
  }
  return entries;
}

/** Presupuestos mensuales por categoría: claves `presupuesto:<Categoría>`. */
export function parsePresupuestos(raw: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("presupuesto:")) continue;
    const n = parseFloat(String(v).replace(",", "."));
    if (Number.isFinite(n) && n > 0) out[k.slice("presupuesto:".length)] = n;
  }
  return out;
}

export function presupuestosToEntries(
  presupuestos: Record<string, number>,
  anteriores: Record<string, number>,
): Array<[string, string]> {
  // Las categorías que se quitaron quedan en 0 (no se borran filas de la hoja)
  const claves = new Set([...Object.keys(anteriores), ...Object.keys(presupuestos)]);
  return Array.from(claves).map((c) => [`presupuesto:${c}`, String(presupuestos[c] ?? 0)]);
}

/** Cuánto hay que juntar por mes para llegar al objetivo en el mes elegido. */
export function aporteMensualNecesario(falta: number, mesObjetivo: string, mesActual: string): { meses: number; porMes: number } {
  const [ya, ma] = mesActual.split("-").map(Number);
  const [yo, mo] = mesObjetivo.split("-").map(Number);
  const meses = Math.max(1, (yo - ya) * 12 + (mo - ma) + 1); // incluye el mes actual
  return { meses, porMes: falta > 0 ? falta / meses : 0 };
}

/** Clave estable para un sobre nuevo, a partir del nombre (ej. "Viaje a Japón" → "viaje_a_japon_k3f9"). */
export function nuevaClaveSobre(nombre: string, existentes: Set<string>): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 18) || "sobre";
  for (;;) {
    const k = `${base}_${Math.random().toString(36).slice(2, 6)}`;
    if (!existentes.has(k)) return k;
  }
}

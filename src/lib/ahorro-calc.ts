import type {
  DolarOperacion,
  Transaction,
  AhorroConfig,
  SobreKey,
  BucketOrigen,
} from "@/types";

/** Nombre legible de cada destino, para los textos de "efecto" */
export const ORIGEN_LABEL: Record<BucketOrigen, string> = {
  regla: "Automático (regla)",
  emergencia: "Piso emergencia",
  auto: "Cambiar el auto",
  mud: "Mudanza",
  vac: "Vacaciones",
  tec: "Tecnología",
  largo: "Largo plazo",
};

export const SOBRE_KEYS: SobreKey[] = ["auto", "mud", "vac", "tec"];

export interface SobreResultado {
  key: SobreKey;
  nombre: string;
  pct: number;
  objetivo: number;
  balance: number;
  /** 0..1 */
  progreso: number;
  completo: boolean;
}

export interface AhorroResultado {
  emergencia: {
    objetivo: number;
    balance: number;
    progreso: number; // 0..1
    completo: boolean;
    falta: number;
  };
  mediano: {
    balance: number;
    sobres: SobreResultado[];
    /** excedente que no entró en ningún sobre porque estaban todos completos */
    libre: number;
  };
  largo: {
    balance: number;
    aporteMensualProm: number;
    /** Meses desde el primer aporte a largo plazo hasta el último movimiento */
    mesesConAporte: number;
    proyeccion15: number;
    proyeccion20: number;
  };
  /** Compras + ingresos USD − ventas − gastos USD */
  tenenciaNeta: number;
  /** emergencia + mediano + largo (debería igualar tenenciaNeta) */
  asignado: number;
  /** tenenciaNeta − asignado (idealmente 0) */
  descuadre: number;
  /** Qué entró y salió de cada bucket, del más nuevo al más viejo */
  historial: MovimientoAhorro[];
}

/** Bucket del ahorro: el piso, un sobre del mediano plazo o el largo plazo. */
export type BucketKey = "emergencia" | "largo" | SobreKey;

export interface MovimientoAhorro {
  fecha: string;
  /** Ej. "Compra de USD", "Gasto: Notebook" */
  concepto: string;
  /** Cambio en USD de cada bucket afectado (positivo entra, negativo sale) */
  cambios: Partial<Record<BucketKey, number>>;
}

type Evento = {
  fecha: string;
  concepto: string;
  flow: "in" | "out";
  usd: number;
  mediano?: number; // intención de reparto (solo entradas)
  largo?: number;
  origen?: BucketOrigen; // solo salidas
};

type Estado = {
  emerg: number;
  sub: Record<SobreKey, number>;
  largo: number;
};

/**
 * Reparte `amount` USD entre los sobres según sus % configurados, respetando el
 * objetivo de cada uno. Si un sobre se llena, su parte se redistribuye entre los
 * que todavía tienen lugar. Lo que no entra en ninguno se devuelve como "libre".
 */
function repartirEnSobres(
  amount: number,
  cfg: AhorroConfig,
  bal: Record<SobreKey, number>,
): number {
  let pool = amount;
  let guard = 0;
  while (pool > 0.005 && guard++ < 40) {
    const activos = cfg.sobres.filter(
      (s) => s.pct > 0 && bal[s.key] < s.objetivo - 0.005,
    );
    if (!activos.length) return pool; // todos completos → excedente libre
    const totalPct = activos.reduce((a, s) => a + s.pct, 0);
    let usado = 0;
    for (const s of activos) {
      const share = pool * (s.pct / totalPct);
      const cupo = s.objetivo - bal[s.key];
      const add = Math.min(share, cupo);
      bal[s.key] += add;
      usado += add;
    }
    pool -= usado;
    if (usado < 0.005) return pool;
  }
  return Math.max(0, pool);
}

/**
 * Descuenta `usd` de la tenencia. Si `origen` es un bucket puntual, sale de ahí
 * (hasta donde alcance) y el resto sigue la regla. La regla automática descuenta
 * en cascada: mediano proporcional → largo → piso (último recurso).
 */
function retirar(usd: number, origen: BucketOrigen, st: Estado): void {
  let left = usd;

  if (origen && origen !== "regla") {
    if ((SOBRE_KEYS as string[]).includes(origen)) {
      const k = origen as SobreKey;
      const t = Math.min(left, st.sub[k]);
      st.sub[k] -= t;
      left -= t;
    } else if (origen === "largo") {
      const t = Math.min(left, st.largo);
      st.largo -= t;
      left -= t;
    } else if (origen === "emergencia") {
      const t = Math.min(left, st.emerg);
      st.emerg -= t;
      left -= t;
    }
  }

  if (left > 0.005) {
    // Regla: primero el pozo de mediano, proporcional entre sus sobres
    const medTotal = SOBRE_KEYS.reduce((a, k) => a + st.sub[k], 0);
    if (medTotal > 0) {
      const take = Math.min(left, medTotal);
      for (const k of SOBRE_KEYS) st.sub[k] -= take * (st.sub[k] / medTotal);
      left -= take;
    }
    if (left > 0.005 && st.largo > 0) {
      const t = Math.min(left, st.largo);
      st.largo -= t;
      left -= t;
    }
    if (left > 0.005 && st.emerg > 0) {
      const t = Math.min(left, st.emerg);
      st.emerg -= t;
      left -= t;
    }
  }
}

/**
 * Calcula el estado del ahorro procesando TODAS las operaciones que afectan la
 * tenencia de dólares en orden cronológico:
 *   - compra (Dólares) e ingreso USD (Movimientos)  → entran: piso primero; del resto, los montos
 *     asignados a mediano y largo son exactos y lo no asignado va a mediano.
 *   - venta (Dólares) y gasto USD (Movimientos)      → salen: por origen elegido o por la regla automática.
 * Si el piso se lleva parte y lo asignado ya no entra en el resto, se achica en proporción.
 */
export function computeAhorro(
  dolarOps: DolarOperacion[],
  transactions: Transaction[],
  cfg: AhorroConfig,
): AhorroResultado {
  const eventos: Evento[] = [];

  for (const op of dolarOps) {
    if (op.tipo === "compra") {
      eventos.push({
        fecha: op.fecha,
        concepto: "Compra de USD",
        flow: "in",
        usd: op.montoUSD,
        mediano: op.asigMediano ?? 0,
        largo: op.asigLargo ?? 0,
      });
    } else {
      eventos.push({
        fecha: op.fecha,
        concepto: "Venta de USD",
        flow: "out",
        usd: op.montoUSD,
        origen: op.origen ?? "regla",
      });
    }
  }

  for (const t of transactions) {
    if (t.moneda !== "USD") continue;
    const fecha = t.fechaPago || t.fechaConsumo;
    if (t.tipo === "ingreso") {
      eventos.push({
        fecha,
        concepto: `Ingreso: ${t.descripcion}`,
        flow: "in",
        usd: t.monto,
        mediano: t.asigMediano ?? 0,
        largo: t.asigLargo ?? 0,
      });
    } else {
      eventos.push({
        fecha,
        concepto: `Gasto: ${t.descripcion}`,
        flow: "out",
        usd: t.monto,
        origen: t.origen ?? "regla",
      });
    }
  }

  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const st: Estado = { emerg: 0, sub: { auto: 0, mud: 0, vac: 0, tec: 0 }, largo: 0 };
  let libre = 0;
  let entradas = 0;
  let salidas = 0;
  let largoIn = 0;
  let primerMesLargo: string | null = null;
  const historial: MovimientoAhorro[] = [];
  const foto = (): Record<BucketKey, number> => ({ emergencia: st.emerg, largo: st.largo, ...st.sub });

  for (const ev of eventos) {
    const antes = foto();
    if (ev.flow === "in") {
      entradas += ev.usd;
      const gap = Math.max(0, cfg.emergenciaObjetivo - st.emerg);
      const toEmerg = Math.min(gap, ev.usd);
      st.emerg += toEmerg;
      const rem = ev.usd - toEmerg;
      if (rem > 0) {
        const mi = ev.mediano ?? 0;
        const li = ev.largo ?? 0;
        const total = mi + li;
        // Montos exactos; si no entran en el resto (el piso se llevó parte), se achican en proporción.
        const toLargo = total > rem ? li * (rem / total) : li;
        const toMed = rem - toLargo; // lo asignado a mediano + lo no asignado
        st.largo += toLargo;
        if (toLargo > 0) {
          largoIn += toLargo;
          primerMesLargo ??= ev.fecha.slice(0, 7);
        }
        libre += repartirEnSobres(toMed, cfg, st.sub);
      }
    } else {
      salidas += ev.usd;
      retirar(ev.usd, ev.origen ?? "regla", st);
    }

    const despues = foto();
    const cambios: Partial<Record<BucketKey, number>> = {};
    for (const k of Object.keys(despues) as BucketKey[]) {
      const d = despues[k] - antes[k];
      if (Math.abs(d) >= 0.005) cambios[k] = d;
    }
    if (Object.keys(cambios).length) historial.push({ fecha: ev.fecha, concepto: ev.concepto, cambios });
  }

  // Aporte mensual a largo plazo: promedio sobre TODOS los meses desde el primer
  // aporte hasta el último movimiento (un aporte aislado no infla la proyección).
  const ultimoMes = eventos.length ? eventos[eventos.length - 1].fecha.slice(0, 7) : null;
  const mesesLargo = primerMesLargo && ultimoMes ? mesesEntre(primerMesLargo, ultimoMes) + 1 : 0;

  const medianoBalance = SOBRE_KEYS.reduce((a, k) => a + st.sub[k], 0);
  const sobres: SobreResultado[] = cfg.sobres.map((s) => {
    const balance = st.sub[s.key] ?? 0;
    const progreso = s.objetivo > 0 ? balance / s.objetivo : 0;
    return {
      key: s.key,
      nombre: s.nombre,
      pct: s.pct,
      objetivo: s.objetivo,
      balance,
      progreso,
      completo: progreso >= 0.999,
    };
  });

  const ret = cfg.sp500RetornoAnual; // fracción anual, ej 0.07
  const rm = ret / 12;
  const aporteProm = mesesLargo > 0 ? largoIn / mesesLargo : 0;
  const fv = (n: number) =>
    st.largo * Math.pow(1 + rm, n) +
    (rm > 0 ? aporteProm * ((Math.pow(1 + rm, n) - 1) / rm) : aporteProm * n);

  const tenenciaNeta = entradas - salidas;
  const asignado = st.emerg + medianoBalance + st.largo;

  return {
    emergencia: {
      objetivo: cfg.emergenciaObjetivo,
      balance: st.emerg,
      progreso: cfg.emergenciaObjetivo > 0 ? st.emerg / cfg.emergenciaObjetivo : 0,
      completo: st.emerg >= cfg.emergenciaObjetivo - 0.5,
      falta: Math.max(0, cfg.emergenciaObjetivo - st.emerg),
    },
    mediano: { balance: medianoBalance, sobres, libre },
    largo: {
      balance: st.largo,
      aporteMensualProm: aporteProm,
      mesesConAporte: mesesLargo,
      proyeccion15: fv(180),
      proyeccion20: fv(240),
    },
    tenenciaNeta,
    asignado,
    descuadre: tenenciaNeta - asignado,
    historial: historial.reverse(),
  };
}

/** Meses entre dos "AAAA-MM" (b − a). */
function mesesEntre(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

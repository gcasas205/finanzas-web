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
}

type Evento = {
  fecha: string;
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
 *   - compra (Dólares) e ingreso USD (Movimientos)  → entran: piso primero, resto según intención mediano:largo.
 *   - venta (Dólares) y gasto USD (Movimientos)      → salen: por origen elegido o por la regla automática.
 * Un ingreso USD sin reparto explícito manda el excedente (tras el piso) a mediano.
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
        flow: "in",
        usd: op.montoUSD,
        mediano: op.asigMediano ?? 0,
        largo: op.asigLargo ?? 0,
      });
    } else {
      eventos.push({
        fecha: op.fecha,
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
        flow: "in",
        usd: t.monto,
        mediano: t.asigMediano ?? 0,
        largo: t.asigLargo ?? 0,
      });
    } else {
      eventos.push({
        fecha,
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
  const mesesLargo = new Set<string>();

  for (const ev of eventos) {
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
        let toMed: number, toLargo: number;
        if (total > 0) {
          toMed = rem * (mi / total);
          toLargo = rem * (li / total);
        } else {
          toMed = rem; // sin intención → todo a mediano
          toLargo = 0;
        }
        st.largo += toLargo;
        if (toLargo > 0) {
          largoIn += toLargo;
          mesesLargo.add(ev.fecha.slice(0, 7));
        }
        libre += repartirEnSobres(toMed, cfg, st.sub);
      }
    } else {
      salidas += ev.usd;
      retirar(ev.usd, ev.origen ?? "regla", st);
    }
  }

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
  const aporteProm = mesesLargo.size > 0 ? largoIn / mesesLargo.size : 0;
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
      mesesConAporte: mesesLargo.size,
      proyeccion15: fv(180),
      proyeccion20: fv(240),
    },
    tenenciaNeta,
    asignado,
    descuadre: tenenciaNeta - asignado,
  };
}

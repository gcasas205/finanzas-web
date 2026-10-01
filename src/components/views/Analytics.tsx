"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import LogoLoader from "@/components/LogoLoader";
import { ErrorState, StaleDataBanner } from "@/components/ui/States";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie,
} from "recharts";
import { Zap } from "lucide-react";
import type { Transaction, AppConfig, Sueldo } from "@/types";
import { formatPesos, formatPesosCompact, formatMes, formatFecha, fechaToMes, uniqueMonths } from "@/lib/utils";
import { request, errorMessage, sueldosApi } from "@/lib/api";
import { factoresPesosDeHoy, type InflacionMes } from "@/lib/inflacion";
import { detectarSuscripciones, detectarHormiga, type GastoRecurrente } from "@/lib/habitos";
import { Segmented } from "@/components/ui/Segmented";
import { getCategoryColor, CATEGORIES } from "@/lib/categories";
import { useTransactions } from "@/components/DataProvider";
import { impactoPesosDolar } from "@/lib/dolar-calc";
import { PALETTE } from "@/lib/palette";
import { EmptyState } from "@/components/ui/States";
import type { ChartTooltipProps } from "@/components/ui/chart";

interface Props { config: AppConfig; }

export default function Analytics({ config }: Props) {
  const { transactions, dolarOps, isLoading: loading, error, refresh } = useTransactions();
  const [tab, setTab] = useState<"tendencias" | "categorias" | "comparativa" | "habitos" | "sueldo" | "mercadopago">("tendencias");
  const sueldos = useSWR(tab === "sueldo" ? "/api/sueldos" : null, () => sueldosApi.list(), { revalidateOnFocus: false });
  // Nominal o ajustado por inflación ("pesos de hoy")
  const [escala, setEscala] = useState<"nominal" | "real">("nominal");
  const inflacion = useSWR<{ serie: InflacionMes[] }>(
    escala === "real" ? "/api/inflacion" : null,
    (url: string) => request<{ serie: InflacionMes[] }>(url),
    { revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000 },
  );
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const months = useMemo(() => {
    const m = uniqueMonths(transactions);
    if (!m.includes(selectedMonth)) m.unshift(selectedMonth);
    return m.slice(0, 24);
  }, [transactions, selectedMonth]);

  // Todos los gráficos de esta vista son en pesos: se excluyen los movimientos en USD
  const txsARS = useMemo(() => transactions.filter(t => t.moneda !== "USD"), [transactions]);

  // En "pesos de hoy" cada monto se lleva al último mes con IPC publicado
  const serie = inflacion.data?.serie;
  const real = escala === "real" && Boolean(serie);
  const txsAnalisis = useMemo(() => {
    if (escala !== "real" || !serie) return txsARS;
    const factor = factoresPesosDeHoy(serie);
    return txsARS.map(t => ({ ...t, monto: t.monto * factor(fechaToMes(t.fechaPago)) }));
  }, [txsARS, escala, serie]);
  const ultimoIpc = serie?.[serie.length - 1]?.mes;

  const acumulado = useMemo(() =>
    txsARS.reduce((s, t) => s + (t.tipo === "ingreso" ? t.monto : -t.monto), 0),
    [txsARS]
  );

  // Capital que realmente sigue en pesos: el acumulado ARS menos lo que se
  // convirtió a dólares (las compras restan, las ventas suman). Es la única
  // base válida para proyectar el rendimiento en Mercado Pago.
  const capitalPesos = useMemo(
    () => acumulado + impactoPesosDolar(dolarOps),
    [acumulado, dolarOps]
  );

  const evolution = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number }>();
    for (const t of txsAnalisis) {
      const mes = fechaToMes(t.fechaPago);
      const cur = map.get(mes) ?? { ingresos: 0, egresos: 0 };
      if (t.tipo === "ingreso") cur.ingresos += t.monto; else cur.egresos += t.monto;
      map.set(mes, cur);
    }
    let acum = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, v]) => {
        const ahorro = v.ingresos - v.egresos;
        acum += ahorro;
        return { mes, label: formatMes(mes, true), ...v, ahorro, acumulado: acum };
      });
  }, [txsAnalisis]);

  const TABS = [
    { id: "tendencias", label: "Tendencias" },
    { id: "categorias", label: "Categorías" },
    { id: "comparativa", label: "Comparativa" },
    { id: "habitos", label: "Hábitos" },
    { id: "sueldo", label: "Sueldo" },
    { id: "mercadopago", label: "Mercado Pago" },
  ] as const;

  if (loading) return <LogoLoader className="min-h-[60vh]" />;
  if (error && transactions.length === 0 && dolarOps.length === 0) {
    return <ErrorState message={error} onRetry={refresh} className="min-h-[60vh]" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
      {error && <StaleDataBanner message={error} onRetry={refresh} />}
      <header className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Análisis</div>
          <h1 className="display text-3xl sm:text-5xl text-paper">
            Mirá los <em className="italic">patrones</em>
          </h1>
          <p className="text-xs text-ink-300 mt-2">
            {real
              ? `Valores en pesos de ${formatMes(ultimoIpc ?? "")} (ajustados por inflación, IPC INDEC)`
              : "Valores en pesos nominales"} · tus dólares se analizan en la pestaña Dólares
          </p>
          {escala === "real" && inflacion.isLoading && (
            <p className="text-xs text-ink-300 mt-1" role="status">Trayendo la inflación…</p>
          )}
          {escala === "real" && inflacion.error && (
            <p className="text-xs text-terra-light mt-1" role="alert">
              {errorMessage(inflacion.error, "No pudimos traer la inflación")}. Mostramos valores nominales.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
        {tab !== "mercadopago" && (
          <Segmented
            label="Escala de los montos"
            size="sm"
            className="w-auto"
            value={escala}
            onChange={setEscala}
            options={[
              { value: "nominal", label: "Nominal" },
              { value: "real", label: "Pesos de hoy" },
            ]}
          />
        )}

        {/* Month selector - visible for tabs that use it */}
        {(tab === "categorias" || tab === "comparativa" || tab === "habitos") && (
          <div className="flex items-center gap-3">
            <label htmlFor="analytics-mes" className="eyebrow">Mes</label>
            <select
              id="analytics-mes"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="select-native min-h-11 bg-ink-800 border border-control text-paper pl-4 pr-9 py-2 text-sm focus:border-amber cursor-pointer hover:border-ink-300 transition-colors"
            >
              {months.map(m => (
                <option key={m} value={m}>{formatMes(m)}</option>
              ))}
            </select>
          </div>
        )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-0 mb-10 hairline-b overflow-x-auto" role="tablist" aria-label="Secciones de análisis">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 whitespace-nowrap px-6 py-3 text-sm transition-colors ${
              tab === t.id ? "text-paper" : "text-ink-300 hover:text-paper"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <motion.div
                layoutId="analytics-tab"
                className="absolute bottom-0 left-0 right-0 h-px bg-amber"
              />
            )}
          </button>
        ))}
      </div>

      {tab === "tendencias" && <TendenciasTab evolution={evolution} />}
      {tab === "categorias" && <CategoriasTab key={selectedMonth} transactions={txsAnalisis} selectedMonth={selectedMonth} />}
      {tab === "comparativa" && <ComparativaTab transactions={txsAnalisis} selectedMonth={selectedMonth} />}
      {tab === "habitos" && <HabitosTab transactions={txsAnalisis} selectedMonth={selectedMonth} />}
      {tab === "sueldo" && (
        sueldos.error ? <Empty message={errorMessage(sueldos.error, "No pudimos traer tus sueldos")} />
          : !sueldos.data ? <LogoLoader className="min-h-[30vh]" />
          : <SueldoTab sueldos={sueldos.data.sueldos} factor={real && serie ? factoresPesosDeHoy(serie) : null} />
      )}
      {tab === "mercadopago" && <MercadoPagoTab acumulado={capitalPesos} tna={config.mpTna} />}
    </div>
  );
}

// ── Tendencias ───────────────────────────────────────────────────────────────

interface EvolucionMes {
  mes: string;
  label: string;
  ingresos: number;
  egresos: number;
  ahorro: number;
  acumulado: number;
}

function TendenciasTab({ evolution }: { evolution: EvolucionMes[] }) {
  if (!evolution.length) return <Empty />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 [&>*]:min-w-0">
      <div className="surface p-4 sm:p-8">
        <div className="eyebrow mb-1">Flujo mensual</div>
        <h3 className="display text-2xl text-paper mb-6">Ingresos vs Gastos</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={evolution}>
            <CartesianGrid stroke={PALETTE.grilla} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} />
            <YAxis stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: PALETTE.cursor }} />
            <Bar dataKey="ingresos" fill={PALETTE.positivo} radius={[2,2,0,0]} name="Ingresos" />
            <Bar dataKey="egresos" fill={PALETTE.negativo} radius={[2,2,0,0]} name="Gastos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="surface p-4 sm:p-8">
        <div className="eyebrow mb-1">Acumulado</div>
        <h3 className="display text-2xl text-paper mb-6">Ahorro acumulado</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={evolution}>
            <CartesianGrid stroke={PALETTE.grilla} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} />
            <YAxis stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <Tooltip content={<ChartTooltip />} cursor={false} />
            <defs>
              <linearGradient id="ahorroGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PALETTE.serie} stopOpacity={0.3} />
                <stop offset="100%" stopColor={PALETTE.serie} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="acumulado" stroke={PALETTE.serie} fill="url(#ahorroGrad)"
              strokeWidth={2} name="Acumulado" dot={{ fill: PALETTE.serie, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="surface p-4 sm:p-8 col-span-1 lg:col-span-2">
        <div className="eyebrow mb-1">Tendencia</div>
        <h3 className="display text-2xl text-paper mb-6">Ahorro mensual</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={evolution}>
            <CartesianGrid stroke={PALETTE.grilla} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} />
            <YAxis stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: PALETTE.cursor }} />
            <Bar dataKey="ahorro" name="Ahorro" radius={[2,2,0,0]}>
              {evolution.map((e, i) => (
                <Cell key={i} fill={e.ahorro >= 0 ? PALETTE.positivo : PALETTE.negativo} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Categorías ───────────────────────────────────────────────────────────────

function CategoriasTab({ transactions, selectedMonth }: { transactions: Transaction[]; selectedMonth: string }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const monthTxs = transactions.filter(t => t.tipo === "egreso" && fechaToMes(t.fechaPago) === selectedMonth);
  const catMap = new Map<string, number>();
  for (const t of monthTxs) catMap.set(t.categoria, (catMap.get(t.categoria) ?? 0) + t.monto);
  const total = Array.from(catMap.values()).reduce((a, b) => a + b, 0);
  const cats = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value, pct: total > 0 ? value / total * 100 : 0, color: getCategoryColor(name) }))
    .sort((a, b) => b.value - a.value);

  if (!cats.length) return <Empty />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 [&>*]:min-w-0">
      <div className="col-span-1 lg:col-span-7 surface p-4 sm:p-8">
        <div className="eyebrow mb-1">{formatMes(selectedMonth)}</div>
        <h3 className="display text-2xl text-paper mb-6">Gastos por categoría</h3>
        <ResponsiveContainer width="100%" height={cats.length * 52 + 20}>
          <BarChart data={cats} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <YAxis type="category" dataKey="name" stroke={PALETTE.eje} fontSize={13}
              tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: PALETTE.cursor }} />
            <Bar dataKey="value" name="Gasto" radius={[0,3,3,0]} barSize={24}>
              {cats.map((c, i) => <Cell key={i} fill={c.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="col-span-1 lg:col-span-5 surface p-4 sm:p-8">
        <div className="eyebrow mb-1">Distribución</div>
        <h3 className="display text-2xl text-paper mb-6">Porcentaje</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={cats.slice(0, 8)} dataKey="value" innerRadius={55} outerRadius={90}
              paddingAngle={1} stroke="none">
              {cats.slice(0, 8).map((c, i) => <Cell key={i} fill={c.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-6 space-y-3">
          {cats.map(c => (
            <button
              key={c.name}
              type="button"
              onClick={() => setAbierta(abierta === c.name ? null : c.name)}
              aria-expanded={abierta === c.name}
              aria-controls="detalle-categoria"
              className={`w-full flex items-center gap-3 text-xs text-left min-h-11 px-2 -mx-2 transition-colors ${abierta === c.name ? "bg-ink-700/50" : "hover:bg-ink-700/30"}`}
            >
              <div className="w-2 h-8 shrink-0" style={{ background: c.color }} />
              <div className="flex-1">
                <div className="text-paper">{c.name}</div>
                <div className="text-ink-300 tabular">{formatPesos(c.value)}</div>
              </div>
              <div className="text-ink-200 tabular">{c.pct.toFixed(1)}%</div>
            </button>
          ))}
          <p className="text-xs text-ink-400">Tocá una categoría para ver sus movimientos.</p>
        </div>
      </div>

      {abierta && (
        <div id="detalle-categoria" className="col-span-1 lg:col-span-12 surface p-4 sm:p-8">
          <div className="eyebrow mb-1">{formatMes(selectedMonth)}</div>
          <h3 className="display text-2xl text-paper mb-4">{abierta}</h3>
          <div className="divide-y divide-ink-600/60">
            {monthTxs
              .filter(t => t.categoria === abierta)
              .sort((a, b) => b.monto - a.monto)
              .map(t => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-paper truncate">{t.descripcion}</div>
                    <div className="text-xs text-ink-300 tabular font-mono">
                      {formatFecha(t.fechaPago)} · {t.subcategoria}
                      {t.cuotaTotal > 1 ? ` · cuota ${t.cuotaNumero}/${t.cuotaTotal}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-mono tabular text-terra-light whitespace-nowrap">
                    <span aria-hidden="true">−</span>{formatPesos(t.monto)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mercado Pago ─────────────────────────────────────────────────────────────

function MercadoPagoTab({ acumulado, tna }: { acumulado: number; tna: number }) {
  const tnaD = tna / 100;
  const projections = Array.from({ length: 13 }, (_, m) => {
    const capital = acumulado * Math.pow(1 + tnaD / 12, m);
    return {
      mes: `M${m}`,
      capital,
      ganancia: capital - acumulado,
    };
  });

  const g1 = acumulado * tnaD / 12;
  const g3 = acumulado * (Math.pow(1 + tnaD / 12, 3) - 1);
  const g6 = acumulado * (Math.pow(1 + tnaD / 12, 6) - 1);
  const g12 = acumulado * (Math.pow(1 + tnaD / 12, 12) - 1);

  return (
    <div>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8 [&>*]:min-w-0">
        {[
          { label: "Capital en pesos", value: acumulado },
          { label: "Ganancia 1 mes", value: g1, color: PALETTE.positivo },
          { label: "Ganancia 6 meses", value: g6 },
          { label: "Ganancia 12 meses", value: g12 },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.26 }}
            className="surface p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: kpi.color ?? PALETTE.eje }} />
            <div className="eyebrow mb-2" style={kpi.color ? { color: kpi.color } : undefined}>{kpi.label}</div>
            <div className="display text-3xl text-paper tabular">
              {acumulado > 0 ? formatPesos(kpi.value) : "$0"}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="surface p-4 sm:p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">Interés compuesto</div>
            <h3 className="display text-2xl text-paper">Proyección a 12 meses</h3>
            <p className="text-xs text-ink-300 mt-1">TNA {tna}% · Capital en pesos: {formatPesos(acumulado)}</p>
            <p className="text-xs text-ink-300 mt-1">No incluye lo que tenés en dólares, solo el ahorro que sigue en pesos.</p>
          </div>
          <Zap className="w-5 h-5 text-ink-300" strokeWidth={1.5} aria-hidden="true" />
        </div>

        {acumulado > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={projections}>
              <CartesianGrid stroke={PALETTE.grilla} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="mes" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} />
              <YAxis stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
                tickFormatter={v => formatPesosCompact(v)} />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <defs>
                <linearGradient id="mpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.serie} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PALETTE.serie} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="capital" stroke={PALETTE.serie} fill="url(#mpGrad)"
                strokeWidth={2.5} name="Capital + interés" dot={{ fill: PALETTE.serie, r: 3 }} />
              <Line type="monotone" dataKey="ganancia" stroke={PALETTE.positivo} strokeWidth={1.5}
                strokeDasharray="4 4" name="Ganancia" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Empty message="Necesitás un acumulado positivo para proyectar" />
        )}
      </div>
    </div>
  );
}

// ── Comparativa ──────────────────────────────────────────────────────────────

/** "AAAA-MM" desplazado n meses (negativo = hacia atrás). */
function mesMas(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type BaseComparacion = "anterior" | "anio" | "promedio3";

function ComparativaTab({ transactions, selectedMonth }: { transactions: Transaction[]; selectedMonth: string }) {
  const [base, setBase] = useState<BaseComparacion>("anterior");
  const baseMeses = base === "anterior" ? [mesMas(selectedMonth, -1)]
    : base === "anio" ? [mesMas(selectedMonth, -12)]
    : [mesMas(selectedMonth, -1), mesMas(selectedMonth, -2), mesMas(selectedMonth, -3)];
  const baseLabel = base === "anterior" ? formatMes(baseMeses[0], true)
    : base === "anio" ? formatMes(baseMeses[0], true)
    : "Prom. 3 meses";

  const getMap = (month: string) => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.tipo !== "egreso" || fechaToMes(t.fechaPago) !== month) continue;
      map.set(t.categoria, (map.get(t.categoria) ?? 0) + t.monto);
    }
    return map;
  };

  const currMap = getMap(selectedMonth);
  // La base es el promedio de sus meses (un solo mes salvo "promedio 3 meses")
  const prevMap = new Map<string, number>();
  for (const m of baseMeses) {
    for (const [cat, v] of getMap(m)) prevMap.set(cat, (prevMap.get(cat) ?? 0) + v / baseMeses.length);
  }
  const allCats = new Set([...currMap.keys(), ...prevMap.keys()]);
  const data = Array.from(allCats)
    .map(cat => {
      const prev = prevMap.get(cat) ?? 0;
      const curr = currMap.get(cat) ?? 0;
      const variation = prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
      return { name: cat, prev, curr, variation, color: getCategoryColor(cat) };
    })
    .sort((a, b) => b.curr - a.curr);

  const selector = (
    <Segmented
      label="Comparar contra"
      size="sm"
      className="w-auto mb-6"
      value={base}
      onChange={setBase}
      options={[
        { value: "anterior", label: "Mes anterior" },
        { value: "anio", label: "Hace un año" },
        { value: "promedio3", label: "Prom. 3 meses" },
      ]}
    />
  );

  if (!data.length) return <>{selector}<Empty message="Se necesitan al menos 2 meses de datos" /></>;

  return (
    <>
    {selector}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 [&>*]:min-w-0">
      <div className="surface p-4 sm:p-8">
        <div className="eyebrow mb-1">{baseLabel} vs {formatMes(selectedMonth, true)}</div>
        <h3 className="display text-2xl text-paper mb-6">Comparativa mensual</h3>
        <ResponsiveContainer width="100%" height={data.length * 52 + 20}>
          <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <YAxis type="category" dataKey="name" stroke={PALETTE.eje} fontSize={13}
              tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: PALETTE.cursor }} />
            <Bar dataKey="prev" fill={PALETTE.serieSecundaria} name={baseLabel} radius={[0,2,2,0]} barSize={14} />
            <Bar dataKey="curr" name={formatMes(selectedMonth, true)} radius={[0,2,2,0]} barSize={14}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="surface p-4 sm:p-8">
        <div className="eyebrow mb-1">Variación</div>
        <h3 className="display text-2xl text-paper mb-6">Cambio porcentual</h3>
        <div className="space-y-4">
          {data.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <div className="flex-1 text-sm text-paper">{d.name}</div>
              <div className="surface px-3 py-1 text-xs tabular font-mono min-w-[100px] text-right"
                style={{ borderColor: d.variation <= 0 ? PALETTE.positivo : PALETTE.negativo }}>
                <span style={{ color: d.variation <= 0 ? PALETTE.positivo : PALETTE.negativoTexto }}>
                  {d.variation > 0 ? "+" : ""}{d.variation.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-ink-300 tabular w-24 text-right">
                {formatPesosCompact(d.curr)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}

// ── Hábitos ──────────────────────────────────────────────────────────────────

function HabitosTab({ transactions, selectedMonth }: { transactions: Transaction[]; selectedMonth: string }) {
  const suscripciones = useMemo(() => detectarSuscripciones(transactions, selectedMonth), [transactions, selectedMonth]);
  const hormiga = useMemo(() => detectarHormiga(transactions, selectedMonth), [transactions, selectedMonth]);
  const totalSus = suscripciones.reduce((s, g) => s + g.porAnio, 0);
  const totalHor = hormiga.reduce((s, g) => s + g.porAnio, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 [&>*]:min-w-0">
      <ListaHabitos
        eyebrow="Últimos 6 meses"
        titulo="Suscripciones"
        explicacion="El mismo comercio, una vez por mes, en al menos 3 de los últimos 6 meses."
        total={totalSus}
        items={suscripciones}
        vacio="No encontramos cargos que se repitan todos los meses."
      />
      <ListaHabitos
        eyebrow="Últimos 3 meses"
        titulo="Gastos hormiga"
        explicacion="Consumos chicos y frecuentes: 6 o más en 3 meses, entre los más baratos del período."
        total={totalHor}
        items={hormiga}
        vacio="No hay gastos chicos que se repitan seguido."
      />
    </div>
  );
}

function ListaHabitos({ eyebrow, titulo, explicacion, total, items, vacio }: {
  eyebrow: string; titulo: string; explicacion: string; total: number; items: GastoRecurrente[]; vacio: string;
}) {
  return (
    <div className="surface p-4 sm:p-8">
      <div className="eyebrow mb-1">{eyebrow}</div>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h3 className="display text-2xl text-paper">{titulo}</h3>
        {items.length > 0 && (
          <div className="text-right">
            <div className="display text-xl text-terra-light tabular">{formatPesosCompact(total)}</div>
            <div className="text-xs text-ink-300">por año</div>
          </div>
        )}
      </div>
      <p className="text-xs text-ink-300 mb-4 leading-relaxed">{explicacion}</p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-300 italic py-6">{vacio}</p>
      ) : (
        <div className="divide-y divide-ink-600/60">
          {items.map(g => (
            <div key={g.nombre} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-paper truncate">{g.nombre}</div>
                <div className="text-xs text-ink-300">
                  {g.categoria} · {g.veces} {g.veces === 1 ? "vez" : "veces"} · ~{formatPesosCompact(g.promedio)} c/u
                </div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="text-sm font-mono tabular text-paper">{formatPesosCompact(g.porMes)}/mes</div>
                <div className="text-xs text-ink-300 tabular">{formatPesosCompact(g.porAnio)}/año</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sueldo ───────────────────────────────────────────────────────────────────

function SueldoTab({ sueldos, factor }: { sueldos: Sueldo[]; factor: ((mes: string) => number) | null }) {
  // Un punto por mes de cobro (si hay dos recibos el mismo mes, se suman)
  const datos = useMemo(() => {
    const map = new Map<string, { bruto: number; neto: number; descuentos: number }>();
    for (const s of sueldos) {
      const mes = s.periodoPago || fechaToMes(s.fechaPago);
      if (!mes) continue;
      const f = factor ? factor(mes) : 1;
      const cur = map.get(mes) ?? { bruto: 0, neto: 0, descuentos: 0 };
      cur.bruto += s.bruto * f;
      cur.neto += s.neto * f;
      cur.descuentos += (s.jubilacion + s.obraSocial + s.ley19032 + s.otrosDescuentos) * f;
      map.set(mes, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, label: formatMes(mes, true), ...v }));
  }, [sueldos, factor]);

  if (!datos.length) {
    return <Empty message="Todavía no hay sueldos. Importá un recibo o cargá un ingreso en Ingresos → Sueldo." />;
  }
  const ultimo = datos[datos.length - 1];
  const haceUnAnio = datos.find(d => d.mes === mesMas(ultimo.mes, -12));
  const variacion = haceUnAnio && haceUnAnio.neto > 0 ? (ultimo.neto / haceUnAnio.neto - 1) * 100 : null;
  const hayBruto = datos.some(d => d.bruto > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 [&>*]:min-w-0">
      <div className="lg:col-span-4 surface p-4 sm:p-8">
        <div className="eyebrow mb-1">{formatMes(ultimo.mes)}</div>
        <h3 className="display text-2xl text-paper mb-4">Último neto</h3>
        <div className="display text-4xl text-moss-light tabular">{formatPesos(ultimo.neto)}</div>
        {ultimo.bruto > 0 && (
          <div className="text-xs text-ink-300 mt-2 tabular">
            Bruto {formatPesos(ultimo.bruto)} · descuentos {formatPesos(ultimo.descuentos)}
          </div>
        )}
        {variacion !== null && (
          <div className={`mt-6 text-sm tabular ${variacion >= 0 ? "text-moss-light" : "text-terra-light"}`}>
            {variacion >= 0 ? "+" : ""}{variacion.toFixed(1)}% <span className="text-ink-300">vs. hace un año{factor ? " (real)" : ""}</span>
          </div>
        )}
        {!factor && (
          <p className="text-xs text-ink-400 mt-4 leading-relaxed">
            Elegí &quot;Pesos de hoy&quot; para ver si tu sueldo le ganó a la inflación.
          </p>
        )}
      </div>
      <div className="lg:col-span-8 surface p-4 sm:p-8">
        <div className="eyebrow mb-1">Evolución</div>
        <h3 className="display text-2xl text-paper mb-6">Neto{hayBruto ? " y bruto" : ""} por mes de cobro</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={datos.slice(-24)}>
            <CartesianGrid stroke={PALETTE.grilla} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} />
            <YAxis stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} tickFormatter={v => formatPesosCompact(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="neto" name="Neto" stroke={PALETTE.positivo} strokeWidth={2} dot={{ r: 3, fill: PALETTE.positivo }} />
            {hayBruto && (
              <Line type="monotone" dataKey="bruto" name="Bruto" stroke={PALETTE.serieSecundaria} strokeWidth={2} dot={{ r: 3, fill: PALETTE.serieSecundaria }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800/95 backdrop-blur-md border border-ink-500 rounded-sm shadow-2xl px-4 py-3">
      {label && <div className="text-xs uppercase tracking-widest text-ink-300 mb-2 font-mono">{label}</div>}
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-6 text-xs py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
            <span className="text-ink-200">{e.name || e.payload?.name}</span>
          </div>
          <span className="text-paper tabular font-mono">{formatPesos(Number(e.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ message = "Sin datos suficientes todavía" }: { message?: string }) {
  return (
    <div className="surface">
      <EmptyState message={message} className="py-16" action={{ label: "Cargar un movimiento", href: "/transactions?nuevo=1" }} />
    </div>
  );
}
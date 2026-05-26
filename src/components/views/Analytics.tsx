"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie,
} from "recharts";
import { Zap } from "lucide-react";
import type { Transaction, AppConfig } from "@/types";
import { formatPesos, formatPesosCompact, formatMes, fechaToMes, uniqueMonths } from "@/lib/utils";
import { getCategoryColor, CATEGORIES } from "@/lib/categories";

interface Props { config: AppConfig; }

export default function Analytics({ config }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tendencias" | "categorias" | "mercadopago" | "comparativa">("tendencias");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetch("/api/transactions").then(r => r.json()).then(d => {
      setTransactions(d.transactions || []);
      setLoading(false);
    });
  }, []);

  const months = useMemo(() => {
    const m = uniqueMonths(transactions);
    if (!m.includes(selectedMonth)) m.unshift(selectedMonth);
    return m.slice(0, 24);
  }, [transactions, selectedMonth]);

  const acumulado = useMemo(() =>
    transactions.reduce((s, t) => s + (t.tipo === "ingreso" ? t.monto : -t.monto), 0),
    [transactions]
  );

  const evolution = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number }>();
    for (const t of transactions) {
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
  }, [transactions]);

  const TABS = [
    { id: "tendencias", label: "Tendencias" },
    { id: "categorias", label: "Categorías" },
    { id: "mercadopago", label: "Mercado Pago" },
    { id: "comparativa", label: "Comparativa" },
  ] as const;

  if (loading) return <div className="p-10 text-ink-300 italic">Cargando datos...</div>;

  return (
    <div className="p-10 max-w-[1400px]">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <div className="eyebrow mb-2">Análisis</div>
          <h1 className="display text-5xl text-paper">
            Mirá los <em className="italic text-amber">patrones</em>
          </h1>
        </div>

        {/* Month selector - visible for tabs that use it */}
        {(tab === "categorias" || tab === "comparativa") && (
          <div className="flex items-center gap-3">
            <label className="eyebrow">Mes</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-ink-800 border border-ink-500 text-paper px-4 py-2 text-sm focus:border-amber outline-none cursor-pointer hover:border-ink-400 transition-colors"
            >
              {months.map(m => (
                <option key={m} value={m}>{formatMes(m)}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-0 mb-10 hairline-b">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-6 py-3 text-sm transition-colors ${
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
      {tab === "categorias" && <CategoriasTab transactions={transactions} selectedMonth={selectedMonth} />}
      {tab === "mercadopago" && <MercadoPagoTab acumulado={acumulado} tna={config.mpTna} />}
      {tab === "comparativa" && <ComparativaTab transactions={transactions} selectedMonth={selectedMonth} />}
    </div>
  );
}

// ── Tendencias ───────────────────────────────────────────────────────────────

function TendenciasTab({ evolution }: { evolution: any[] }) {
  if (!evolution.length) return <Empty />;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="surface p-8">
        <div className="eyebrow mb-1">Flujo mensual</div>
        <h3 className="display text-2xl text-paper mb-6">Ingresos vs Gastos</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={evolution}>
            <CartesianGrid stroke="#252420" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244,241,234,0.03)" }} />
            <Bar dataKey="ingresos" fill="#6A8970" radius={[2,2,0,0]} name="Ingresos" />
            <Bar dataKey="egresos" fill="#A04A2F" radius={[2,2,0,0]} name="Gastos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="surface p-8">
        <div className="eyebrow mb-1">Acumulado</div>
        <h3 className="display text-2xl text-paper mb-6">Ahorro acumulado</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={evolution}>
            <CartesianGrid stroke="#252420" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <Tooltip content={<ChartTooltip />} cursor={false} />
            <defs>
              <linearGradient id="ahorroGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A24B" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#C9A24B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="acumulado" stroke="#C9A24B" fill="url(#ahorroGrad)"
              strokeWidth={2} name="Acumulado" dot={{ fill: "#C9A24B", r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="surface p-8 col-span-2">
        <div className="eyebrow mb-1">Tendencia</div>
        <h3 className="display text-2xl text-paper mb-6">Ahorro mensual</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={evolution}>
            <CartesianGrid stroke="#252420" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244,241,234,0.03)" }} />
            <Bar dataKey="ahorro" name="Ahorro" radius={[2,2,0,0]}>
              {evolution.map((e, i) => (
                <Cell key={i} fill={e.ahorro >= 0 ? "#6A8970" : "#A04A2F"} />
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
  const monthTxs = transactions.filter(t => t.tipo === "egreso" && fechaToMes(t.fechaPago) === selectedMonth);
  const catMap = new Map<string, number>();
  for (const t of monthTxs) catMap.set(t.categoria, (catMap.get(t.categoria) ?? 0) + t.monto);
  const total = Array.from(catMap.values()).reduce((a, b) => a + b, 0);
  const cats = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value, pct: total > 0 ? value / total * 100 : 0, color: getCategoryColor(name) }))
    .sort((a, b) => b.value - a.value);

  if (!cats.length) return <Empty />;

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7 surface p-8">
        <div className="eyebrow mb-1">{formatMes(selectedMonth)}</div>
        <h3 className="display text-2xl text-paper mb-6">Gastos por categoría</h3>
        <ResponsiveContainer width="100%" height={cats.length * 52 + 20}>
          <BarChart data={cats} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <YAxis type="category" dataKey="name" stroke="#8A8576" fontSize={11}
              tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244,241,234,0.03)" }} />
            <Bar dataKey="value" name="Gasto" radius={[0,3,3,0]} barSize={24}>
              {cats.map((c, i) => <Cell key={i} fill={c.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="col-span-5 surface p-8">
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
          {cats.slice(0, 8).map(c => (
            <div key={c.name} className="flex items-center gap-3 text-xs">
              <div className="w-2 h-8 shrink-0" style={{ background: c.color }} />
              <div className="flex-1">
                <div className="text-paper">{c.name}</div>
                <div className="text-ink-300 tabular">{formatPesos(c.value)}</div>
              </div>
              <div className="text-ink-200 tabular">{c.pct.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
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
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: "Capital actual", value: acumulado, color: "#8A8576" },
          { label: "Ganancia 1 mes", value: g1, color: "#6A8970" },
          { label: "Ganancia 6 meses", value: g6, color: "#C9A24B" },
          { label: "Ganancia 12 meses", value: g12, color: "#E8C982" },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="surface p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: kpi.color }} />
            <div className="eyebrow mb-2" style={{ color: kpi.color }}>{kpi.label}</div>
            <div className="display text-3xl text-paper tabular">
              {acumulado > 0 ? formatPesos(kpi.value) : "$0"}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="surface p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">Interés compuesto</div>
            <h3 className="display text-2xl text-paper">Proyección a 12 meses</h3>
            <p className="text-xs text-ink-300 mt-1">TNA {tna}% · Capital: {formatPesos(acumulado)}</p>
          </div>
          <Zap className="w-5 h-5 text-amber" strokeWidth={1.5} />
        </div>

        {acumulado > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={projections}>
              <CartesianGrid stroke="#252420" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="mes" stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={v => formatPesosCompact(v)} />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <defs>
                <linearGradient id="mpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8C982" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E8C982" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="capital" stroke="#E8C982" fill="url(#mpGrad)"
                strokeWidth={2.5} name="Capital + interés" dot={{ fill: "#E8C982", r: 3 }} />
              <Line type="monotone" dataKey="ganancia" stroke="#6A8970" strokeWidth={1.5}
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

function ComparativaTab({ transactions, selectedMonth }: { transactions: Transaction[]; selectedMonth: string }) {
  const [yyyy, mm] = selectedMonth.split("-").map(Number);
  let pm = mm - 1, py = yyyy;
  if (pm < 1) { pm = 12; py--; }
  const prevMonth = `${py}-${String(pm).padStart(2, "0")}`;

  const getMap = (month: string) => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.tipo !== "egreso" || fechaToMes(t.fechaPago) !== month) continue;
      map.set(t.categoria, (map.get(t.categoria) ?? 0) + t.monto);
    }
    return map;
  };

  const currMap = getMap(selectedMonth);
  const prevMap = getMap(prevMonth);
  const allCats = new Set([...currMap.keys(), ...prevMap.keys()]);
  const data = Array.from(allCats)
    .map(cat => {
      const prev = prevMap.get(cat) ?? 0;
      const curr = currMap.get(cat) ?? 0;
      const variation = prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
      return { name: cat, prev, curr, variation, color: getCategoryColor(cat) };
    })
    .sort((a, b) => b.curr - a.curr);

  if (!data.length) return <Empty message="Se necesitan al menos 2 meses de datos" />;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="surface p-8">
        <div className="eyebrow mb-1">{formatMes(prevMonth, true)} vs {formatMes(selectedMonth, true)}</div>
        <h3 className="display text-2xl text-paper mb-6">Comparativa mensual</h3>
        <ResponsiveContainer width="100%" height={data.length * 52 + 20}>
          <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={v => formatPesosCompact(v)} />
            <YAxis type="category" dataKey="name" stroke="#8A8576" fontSize={11}
              tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244,241,234,0.03)" }} />
            <Bar dataKey="prev" fill="#5A574E" name={formatMes(prevMonth, true)} radius={[0,2,2,0]} barSize={14} />
            <Bar dataKey="curr" name={formatMes(selectedMonth, true)} radius={[0,2,2,0]} barSize={14}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="surface p-8">
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
                style={{ borderColor: d.variation <= 0 ? "#6A8970" : "#A04A2F" }}>
                <span style={{ color: d.variation <= 0 ? "#6A8970" : "#D4886E" }}>
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
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800/95 backdrop-blur-md border border-ink-500 rounded-sm shadow-2xl px-4 py-3">
      {label && <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2 font-mono">{label}</div>}
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6 text-xs py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
            <span className="text-ink-200">{e.name || e.payload?.name}</span>
          </div>
          <span className="text-paper tabular font-mono">{formatPesos(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ message = "Sin datos suficientes todavía" }: { message?: string }) {
  return <div className="surface p-16 text-center text-ink-300 italic text-sm">{message}</div>;
}

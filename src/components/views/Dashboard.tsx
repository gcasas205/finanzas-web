"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, Zap,
  Calendar, Info, DollarSign,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import type { Transaction, AppConfig } from "@/types";
import {
  formatPesos, formatPesosCompact, formatMes, formatFecha, fechaToMes, uniqueMonths,
} from "@/lib/utils";
import { getCategoryColor } from "@/lib/categories";
import { useTransactions } from "@/components/DataProvider";
import { resumenDolar, impactoPesosDolar } from "@/lib/dolar-calc";
import { UsdAmount } from "@/components/UsdAmount";

interface Props { config: AppConfig; }

export default function Dashboard({ config }: Props) {
  const { transactions, dolarOps, cotizacion, isLoading: loading } = useTransactions();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ── Cálculos ──────────────────────────────────────────────────
  const months = useMemo(() => {
    const m = uniqueMonths(transactions);
    if (!m.includes(selectedMonth)) m.unshift(selectedMonth);
    return m.slice(0, 12);
  }, [transactions, selectedMonth]);

  const monthTransactions = useMemo(
    () => transactions.filter(t => fechaToMes(t.fechaPago) === selectedMonth),
    [transactions, selectedMonth]
  );

  // Los KPIs mensuales y la torta son en pesos: se excluyen los movimientos en USD
  const monthTransactionsARS = useMemo(
    () => monthTransactions.filter(t => t.moneda !== "USD"),
    [monthTransactions]
  );

  const ingresos = monthTransactionsARS.filter(t => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0);
  const egresos = monthTransactionsARS.filter(t => t.tipo === "egreso").reduce((s, t) => s + t.monto, 0);
  const ahorro = ingresos - egresos;
  const tasaAhorro = ingresos > 0 ? (ahorro / ingresos) * 100 : 0;

  // Acumulado en pesos: neto de transacciones ARS + impacto de operaciones de dólar
  // (comprar USD resta pesos, vender USD suma pesos).
  const acumuladoARS = useMemo(() => {
    const pesos = transactions
      .filter(t => t.moneda !== "USD")
      .reduce((s, t) => s + (t.tipo === "ingreso" ? t.monto : -t.monto), 0);
    return pesos + impactoPesosDolar(dolarOps);
  }, [transactions, dolarOps]);

  // Posición en dólares (incluye gastos/ingresos en USD que tocan la tenencia)
  const usdTxs = useMemo(() => transactions.filter(t => t.moneda === "USD"), [transactions]);
  const dolar = useMemo(() => resumenDolar(dolarOps, usdTxs), [dolarOps, usdTxs]);
  const precioValuacion = cotizacion && !cotizacion.fallback && cotizacion.compra > 0
    ? cotizacion.compra
    : dolar.precioPromedioCompra;
  const tenenciaUSDenARS = dolar.tenenciaUSD * precioValuacion;
  const resultadoTC = tenenciaUSDenARS - dolar.tenenciaUSD * dolar.precioPromedioCompra;

  // Patrimonio total = pesos + tenencia en dólares valuada a hoy
  const patrimonioTotal = acumuladoARS + tenenciaUSDenARS;

  const mpGanancia30d = acumuladoARS > 0 ? acumuladoARS * (config.mpTna / 100 / 12) : 0;

  // Evolución últimos 6 meses (en pesos, basado en fechaPago)
  const evolution = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number }>();
    for (const t of transactions) {
      if (t.moneda === "USD") continue;
      const mes = fechaToMes(t.fechaPago);
      const cur = map.get(mes) ?? { ingresos: 0, egresos: 0 };
      if (t.tipo === "ingreso") cur.ingresos += t.monto;
      else cur.egresos += t.monto;
      map.set(mes, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, vals]) => ({
        mes,
        mesLabel: formatMes(mes, true),
        ingresos: vals.ingresos,
        egresos: vals.egresos,
        ahorro: vals.ingresos - vals.egresos,
      }));
  }, [transactions]);

  // Categorías mes seleccionado (solo pesos)
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTransactionsARS) {
      if (t.tipo !== "egreso") continue;
      map.set(t.categoria, (map.get(t.categoria) ?? 0) + t.monto);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([cat, val]) => ({
        name: cat,
        value: val,
        pct: total > 0 ? (val / total) * 100 : 0,
        color: getCategoryColor(cat),
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthTransactionsARS]);

  // Próximos pagos (de tarjeta, en los próximos 30 días desde hoy)
  const upcomingPayments = useMemo(() => {
    const today = new Date();
    const in30 = new Date();
    in30.setDate(today.getDate() + 45);
    return transactions
      .filter(t => {
        if (t.tipo !== "egreso") return false;
        const fp = new Date(t.fechaPago);
        return fp >= today && fp <= in30;
      })
      .sort((a, b) => a.fechaPago.localeCompare(b.fechaPago))
      .slice(0, 6);
  }, [transactions]);

  if (loading) return <SkeletonView />;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
      {/* Header */}
      <header className="mb-6 lg:mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">{formatMes(selectedMonth)}</div>
          <h1 className="display text-4xl sm:text-5xl lg:text-6xl text-paper leading-none">
            Tu <em className="italic text-amber">balance</em>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <label className="eyebrow">Mes</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-ink-800 border border-ink-500 text-paper px-3 py-2 text-sm focus:border-amber outline-none cursor-pointer"
          >
            {months.map(m => (
              <option key={m} value={m}>{formatMes(m)}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Note about credit card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="surface px-5 py-3 mb-8 flex items-start gap-3"
      >
        <Info className="w-4 h-4 text-amber mt-0.5 shrink-0" strokeWidth={1.5} />
        <p className="text-xs text-ink-200 leading-relaxed">
          <span className="text-paper">Cómo se cuentan los meses:</span> los gastos
          de tarjeta se asignan al mes en que se <em className="text-amber italic">pagan</em> realmente
          (según día de vencimiento {config.cardDueDay}). El sueldo se cuenta al mes
          siguiente del trabajado. Cambiá los ciclos en Ajustes.
        </p>
      </motion.div>

      {/* KPI Grid - Editorial style */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 mb-8 lg:mb-12">
        {/* Headline: patrimonio total (ARS + USD) */}
        <KPICard
          variant="hero"
          eyebrow="Patrimonio total"
          value={patrimonioTotal}
          accent="amber"
          subtitle={`Pesos ${formatPesosCompact(acumuladoARS)} · USD ${formatPesosCompact(tenenciaUSDenARS)}`}
          icon={Wallet}
          delay={0}
          className="col-span-2 sm:col-span-6"
        />
        <KPICard
          eyebrow="Ahorro del mes"
          value={ahorro}
          accent={ahorro >= 0 ? "moss" : "terra"}
          subtitle={`${tasaAhorro.toFixed(1)}% tasa · ${formatPesosCompact(ingresos)} in / ${formatPesosCompact(egresos)} out`}
          icon={ahorro >= 0 ? TrendingUp : TrendingDown}
          delay={0.1}
          className="col-span-1 sm:col-span-3"
        />
        <KPICard
          eyebrow="Saldo en pesos"
          value={acumuladoARS}
          accent="ink"
          subtitle="Acumulado histórico"
          delay={0.15}
          className="col-span-1 sm:col-span-3"
        />

        {/* Posición en dólares: una sola tarjeta con 3 métricas */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="surface p-4 sm:p-7 relative overflow-hidden col-span-2 sm:col-span-8"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-moss" />
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow text-[10px] text-moss-light">Posición en dólares</div>
            <DollarSign className="w-4 h-4 text-ink-300 hidden sm:block" strokeWidth={1.5} />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-ink-400 mb-1">Tenencia</div>
              <div className="display text-lg sm:text-3xl text-paper tabular leading-none"><UsdAmount value={dolar.tenenciaUSD} /></div>
              <div className="text-[10px] text-ink-300 mt-1 truncate">
                {dolar.precioPromedioCompra > 0 ? `PPC ${formatPesosCompact(dolar.precioPromedioCompra)}` : "Sin compras"}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-ink-400 mb-1">Valor hoy</div>
              <div className="display text-lg sm:text-3xl text-paper tabular leading-none">{formatPesosCompact(tenenciaUSDenARS)}</div>
              <div className="text-[10px] text-ink-300 mt-1 truncate">
                {precioValuacion > 0 ? `@ ${formatPesosCompact(precioValuacion)}` : "Sin cotización"}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-ink-400 mb-1">Result. T.C.</div>
              <div className={`display text-lg sm:text-3xl tabular leading-none ${resultadoTC >= 0 ? "text-moss-light" : "text-terra-light"}`}>
                {resultadoTC >= 0 ? "+" : ""}{formatPesosCompact(resultadoTC)}
              </div>
              <div className="text-[10px] text-ink-300 mt-1">latente</div>
            </div>
          </div>
        </motion.div>

        <KPICard
          eyebrow={`Mercado Pago · TNA ${config.mpTna}%`}
          value={mpGanancia30d}
          accent="amber"
          subtitle="Proyección 30 días"
          icon={Zap}
          delay={0.25}
          className="col-span-2 sm:col-span-4"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 mb-8 lg:mb-12">
        {/* Bar chart - evolution */}
        <div className="col-span-2 sm:col-span-8 surface p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="eyebrow mb-1">Evolución</div>
              <h2 className="display text-2xl text-paper">Últimos 6 meses</h2>
            </div>
            <div className="flex gap-4 text-[11px]">
              <LegendDot color="#6A8970" label="Ingresos" />
              <LegendDot color="#A04A2F" label="Gastos" />
              <LegendDot color="#C9A24B" label="Ahorro" />
            </div>
          </div>

          {evolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={evolution} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#252420" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="mesLabel" stroke="#8A8576" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8A8576" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => formatPesosCompact(v)} />
                <Tooltip
                  content={<EditorialTooltip />}
                  cursor={{ fill: "rgba(244,241,234,0.03)" }}
                />
                <Bar dataKey="ingresos" fill="#6A8970" radius={[2, 2, 0, 0]} />
                <Bar dataKey="egresos"  fill="#A04A2F" radius={[2, 2, 0, 0]} />
                <Bar dataKey="ahorro"   fill="#C9A24B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin datos de evolución todavía" />
          )}
        </div>

        {/* Categories pie */}
        <div className="col-span-2 sm:col-span-4 surface p-8">
          <div className="eyebrow mb-1">Distribución</div>
          <h2 className="display text-2xl text-paper mb-6">Por categoría</h2>

          {categories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categories.slice(0, 7)}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={1}
                    stroke="none"
                  >
                    {categories.slice(0, 7).map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<EditorialTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-6 space-y-2.5">
                {categories.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex items-center gap-3 text-xs">
                    <div
                      className="w-2 h-8 shrink-0"
                      style={{ background: c.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-paper truncate">{c.name}</div>
                      <div className="text-ink-300 tabular">{formatPesos(c.value)}</div>
                    </div>
                    <div className="text-ink-200 tabular text-[11px]">
                      {c.pct.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Sin gastos categorizados" />
          )}
        </div>
      </div>

      {/* Upcoming payments */}
      <div className="surface p-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">Próximos vencimientos</div>
            <h2 className="display text-2xl text-paper">Lo que viene</h2>
          </div>
          <Calendar className="w-5 h-5 text-ink-300" strokeWidth={1.5} />
        </div>

        {upcomingPayments.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-12 gap-y-4">
            {upcomingPayments.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between py-3 hairline-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-paper truncate">{tx.descripcion}</div>
                  <div className="text-[11px] text-ink-300 mt-0.5 flex items-center gap-2">
                    <span>{formatFecha(tx.fechaPago)}</span>
                    {tx.cuotaTotal > 1 && (
                      <span className="text-amber">· {tx.cuotaNumero}/{tx.cuotaTotal}</span>
                    )}
                  </div>
                </div>
                <div className="text-sm font-mono tabular text-terra-light ml-4">
                  -{formatPesos(tx.monto)}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState message="No hay pagos próximos en los siguientes 45 días" />
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

interface KPICardProps {
  variant?: "hero" | "default";
  eyebrow: string;
  value: number;
  /** Si se pasa, se muestra en lugar de formatPesos(value) — para montos en USD u otros */
  valueText?: string;
  accent: "moss" | "terra" | "amber" | "ink";
  subtitle: string;
  icon?: any;
  delay?: number;
  className?: string;
}

function KPICard({ variant = "default", eyebrow, value, valueText, accent, subtitle, icon: Icon, delay = 0, className = "" }: KPICardProps) {
  const accentColors = {
    moss: "#6A8970",
    terra: "#D4886E",
    amber: "#C9A24B",
    ink: "#8A8576",
  };
  const color = accentColors[accent];
  const isHero = variant === "hero";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`surface p-4 sm:p-7 relative overflow-hidden ${className}`}
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />

      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className="eyebrow text-[8px] sm:text-[10px]" style={{ color }}>{eyebrow}</div>
        {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-ink-300 hidden sm:block" strokeWidth={1.5} />}
      </div>

      <div className={`display tabular leading-none ${isHero ? "text-3xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl lg:text-4xl"} text-paper mb-1 sm:mb-2`}>
        {valueText ?? formatPesos(value)}
      </div>

      <div className="text-[9px] sm:text-[11px] text-ink-300 tracking-wide truncate">
        {subtitle}
      </div>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-200">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-mono uppercase tracking-wider">{label}</span>
    </div>
  );
}

function EditorialTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800/95 backdrop-blur-md border border-ink-500 rounded-sm shadow-2xl px-4 py-3 min-w-[160px]">
      {label && (
        <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2 font-mono">
          {label}
        </div>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-ink-200 capitalize">{entry.name || entry.payload?.name}</span>
          </div>
          <span className="text-paper tabular font-mono">
            {formatPesos(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-ink-300">
      <span className="italic">{message}</span>
    </div>
  );
}

function SkeletonView() {
  return (
    <div className="p-10">
      <div className="h-16 w-64 bg-ink-700/40 mb-12 animate-pulse" />
      <div className="grid grid-cols-12 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${i === 0 ? "col-span-6" : "col-span-3"} h-40 bg-ink-700/30 animate-pulse`} />
        ))}
      </div>
    </div>
  );
}
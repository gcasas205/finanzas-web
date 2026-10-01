"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, Zap,
  Calendar, Info, DollarSign,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import type { Transaction, AppConfig } from "@/types";
import {
  formatPesos, formatPesosCompact, formatMes, formatFecha, fechaToMes, uniqueMonths, hoyLocal, sumarDias,
} from "@/lib/utils";
import { UsdAmount } from "@/components/UsdAmount";
import { proximoResumen } from "@/lib/tarjeta";
import useSWR from "swr";
import Link from "next/link";
import { presupuestosApi } from "@/lib/api";
import { CreditCard } from "lucide-react";
import { useTransactions, useCategorias } from "@/components/DataProvider";
import { resumenDolar, impactoPesosDolar } from "@/lib/dolar-calc";
import LogoLoader from "@/components/LogoLoader";
import { ErrorState, StaleDataBanner } from "@/components/ui/States";
import AnimatedNumber, { AnimatedUsdAmount } from "@/components/AnimatedNumber";
import { PALETTE } from "@/lib/palette";
import { EmptyState } from "@/components/ui/States";
import type { ChartTooltipProps } from "@/components/ui/chart";

interface Props { config: AppConfig; }

export default function Dashboard({ config }: Props) {
  const { transactions, dolarOps, cotizacion, isLoading: loading, error, refresh } = useTransactions();
  const { colorDe } = useCategorias();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ── Cálculos ──────────────────────────────────────────────────
  // Meses con datos (incluye futuros: tarjeta y cuotas por pagar), el elegido y el próximo
  const months = useMemo(() => {
    const hoy = hoyLocal();
    const proximo = sumarDias(`${hoy.slice(0, 7)}-01`, 32).slice(0, 7);
    const set = new Set([...uniqueMonths(transactions), selectedMonth, proximo]);
    const actual = hoy.slice(0, 7);
    const todos = Array.from(set).sort().reverse();
    // Todos los futuros + los 12 más recientes hasta hoy
    return [...todos.filter(m => m > actual), ...todos.filter(m => m <= actual).slice(0, 12)];
  }, [transactions, selectedMonth]);

  const resumenTarjeta = useMemo(() => proximoResumen(transactions, hoyLocal()), [transactions]);
  const presupuestos = useSWR("/api/presupuestos", () => presupuestosApi.list(), { revalidateOnFocus: false }).data?.presupuestos;

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
        color: colorDe(cat),
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthTransactionsARS, colorDe]);

  // Próximos pagos: egresos con fecha de pago entre hoy y los próximos 45 días.
  // Se comparan textos AAAA-MM-DD en hora local (new Date("AAAA-MM-DD") es UTC y corre el día).
  const upcomingPayments = useMemo(() => {
    const hoy = hoyLocal();
    const hasta = sumarDias(hoy, 45);
    return transactions
      .filter(t => t.tipo === "egreso" && t.fechaPago >= hoy && t.fechaPago <= hasta)
      .sort((a, b) => a.fechaPago.localeCompare(b.fechaPago))
      .slice(0, 6);
  }, [transactions]);

  if (loading) return <LogoLoader className="min-h-[70vh]" />;
  if (error && transactions.length === 0 && dolarOps.length === 0) {
    return <ErrorState message={error} onRetry={refresh} className="min-h-[70vh]" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
      {error && <StaleDataBanner message={error} onRetry={refresh} />}
      {/* Header */}
      <header className="mb-6 lg:mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">{formatMes(selectedMonth)}</div>
          <h1 className="display text-4xl sm:text-5xl lg:text-6xl text-paper leading-none">
            Tu <em className="italic">balance</em>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="dashboard-mes" className="eyebrow">Mes</label>
          <select
            id="dashboard-mes"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="select-native min-h-11 bg-ink-800 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
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
        <Info className="w-4 h-4 text-ink-300 mt-0.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-xs text-ink-200 leading-relaxed">
          <span className="text-paper">Cómo se cuentan los meses:</span> los gastos
          de tarjeta se asignan al mes en que se <em className="text-paper italic">pagan</em> realmente
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
          accent="ink"
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
          transition={{ duration: 0.26, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="surface p-4 sm:p-7 relative overflow-hidden col-span-2 sm:col-span-8"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-moss" />
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow text-moss-light">Posición en dólares</div>
            <DollarSign className="w-4 h-4 text-ink-300 hidden sm:block" strokeWidth={1.5} />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div>
              <div className="text-xs text-ink-300 mb-1">Tenencia</div>
              <div className="display text-lg sm:text-3xl text-paper tabular leading-none">
                <AnimatedUsdAmount value={dolar.tenenciaUSD} />
              </div>
              <div className="text-xs text-ink-300 mt-1 truncate">
                {dolar.precioPromedioCompra > 0 ? `PPC ${formatPesosCompact(dolar.precioPromedioCompra)}` : "Sin compras"}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-300 mb-1">Valor hoy</div>
              <div className="display text-lg sm:text-3xl text-paper tabular leading-none">
                <AnimatedNumber value={tenenciaUSDenARS} format={formatPesosCompact} />
              </div>
              <div className="text-xs text-ink-300 mt-1 truncate">
                {precioValuacion > 0 ? `@ ${formatPesosCompact(precioValuacion)}` : "Sin cotización"}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-300 mb-1">Result. T.C.</div>
              <div className={`display text-lg sm:text-3xl tabular leading-none ${resultadoTC >= 0 ? "text-moss-light" : "text-terra-light"}`}>
                {resultadoTC >= 0 ? "+" : ""}<AnimatedNumber value={resultadoTC} format={formatPesosCompact} />
              </div>
              <div className="text-xs text-ink-300 mt-1">latente</div>
            </div>
          </div>
        </motion.div>

        <KPICard
          eyebrow={`Mercado Pago · TNA ${config.mpTna}%`}
          value={mpGanancia30d}
          accent="ink"
          subtitle="Proyección 30 días"
          icon={Zap}
          delay={0.25}
          className="col-span-2 sm:col-span-4"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 mb-8 lg:mb-12">
        {/* Bar chart - evolution */}
        <div className="col-span-2 sm:col-span-8 surface p-4 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <div className="eyebrow mb-1">Evolución</div>
              <h2 className="display text-2xl text-paper">Últimos 6 meses</h2>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <LegendDot color={PALETTE.positivo} label="Ingresos" />
              <LegendDot color={PALETTE.negativo} label="Gastos" />
              <LegendDot color={PALETTE.serie} label="Ahorro" />
            </div>
          </div>

          {evolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={evolution} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={PALETTE.grilla} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="mesLabel" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} />
                <YAxis stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
                  tickFormatter={(v) => formatPesosCompact(v)} />
                <Tooltip
                  content={<EditorialTooltip />}
                  cursor={{ fill: PALETTE.cursor }}
                />
                <Bar dataKey="ingresos" name="Ingresos" fill={PALETTE.positivo} radius={[2, 2, 0, 0]} />
                <Bar dataKey="egresos" name="Gastos" fill={PALETTE.negativo} radius={[2, 2, 0, 0]} />
                <Bar dataKey="ahorro" name="Ahorro" fill={PALETTE.serie} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin datos de evolución todavía" action={{ label: "Cargar un movimiento", href: "/transactions?nuevo=1" }} />
          )}
        </div>

        {/* Categories pie */}
        <div className="col-span-2 sm:col-span-4 surface p-4 sm:p-8">
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
                    <div className="text-ink-200 tabular text-xs">
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

      {/* Presupuesto del mes */}
      {presupuestos && Object.keys(presupuestos).length > 0 && (
        <PresupuestoCard presupuestos={presupuestos} gastos={categories} mes={selectedMonth} />
      )}

      {/* Upcoming payments */}
      <div className="surface p-4 sm:p-8">
        {resumenTarjeta && (
          <div className="mb-6 pb-6 hairline-b flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-ink-300 mt-1 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <div className="eyebrow mb-1">Próximo resumen de tarjeta</div>
                <div className="text-sm text-ink-200">
                  Vence el <span className="text-paper">{formatFecha(resumenTarjeta.vence)}</span> ·{" "}
                  {resumenTarjeta.items} movimiento{resumenTarjeta.items === 1 ? "" : "s"}
                  {resumenTarjeta.cuotas > 0 && ` (${resumenTarjeta.cuotas} en cuotas)`}
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="display text-3xl tabular text-terra-light">
                <span aria-hidden="true">−</span>{formatPesos(resumenTarjeta.pesos)}
              </div>
              {Math.abs(resumenTarjeta.dolares) >= 0.005 && (
                <div className="text-sm font-mono tabular text-terra-light">
                  <span aria-hidden="true">−</span><UsdAmount value={resumenTarjeta.dolares} />
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">Próximos vencimientos</div>
            <h2 className="display text-2xl text-paper">Lo que viene</h2>
          </div>
          <Calendar className="w-5 h-5 text-ink-300" strokeWidth={1.5} />
        </div>

        {upcomingPayments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-1">
            {upcomingPayments.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.22), duration: 0.18 }}
                className="flex items-center justify-between py-3 hairline-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-paper truncate">{tx.descripcion}</div>
                  <div className="text-xs text-ink-300 mt-0.5 flex items-center gap-2">
                    <span>{formatFecha(tx.fechaPago)}</span>
                    {tx.cuotaTotal > 1 && (
                      <span>· cuota {tx.cuotaNumero}/{tx.cuotaTotal}</span>
                    )}
                  </div>
                </div>
                <div className="text-sm font-mono tabular text-terra-light ml-4 whitespace-nowrap">
                  <span aria-hidden="true">−</span>
                  {tx.moneda === "USD" ? <UsdAmount value={tx.monto} /> : formatPesos(tx.monto)}
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
  accent: "moss" | "terra" | "ink";
  subtitle: string;
  icon?: LucideIcon;
  delay?: number;
  className?: string;
}

function KPICard({ variant = "default", eyebrow, value, valueText, accent, subtitle, icon: Icon, delay = 0, className = "" }: KPICardProps) {
  const accentColors = {
    moss: PALETTE.positivo,
    terra: PALETTE.negativoTexto,
    ink: PALETTE.eje,
  };
  const color = accentColors[accent];
  const isHero = variant === "hero";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`surface p-4 sm:p-7 relative overflow-hidden ${className}`}
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />

      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className="eyebrow text-xs" style={{ color }}>{eyebrow}</div>
        {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-ink-300 hidden sm:block" strokeWidth={1.5} />}
      </div>

      <div className={`display tabular leading-none ${isHero ? "text-3xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl lg:text-4xl"} text-paper mb-1 sm:mb-2`}>
        {valueText ?? <AnimatedNumber value={value} format={formatPesos} />}
      </div>

      <div className="text-xs text-ink-300 tracking-wide truncate">
        {subtitle}
      </div>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-200">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-mono">{label}</span>
    </div>
  );
}

function EditorialTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800/95 backdrop-blur-md border border-ink-500 rounded-sm shadow-2xl px-4 py-3 min-w-[160px]">
      {label && (
        <div className="text-xs uppercase tracking-widest text-ink-300 mb-2 font-mono">
          {label}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-ink-200 capitalize">{entry.name || entry.payload?.name}</span>
          </div>
          <span className="text-paper tabular font-mono">
            {formatPesos(Number(entry.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Avance del gasto del mes contra el presupuesto de cada categoría. */
function PresupuestoCard({ presupuestos, gastos, mes }: {
  presupuestos: Record<string, number>;
  gastos: Array<{ name: string; value: number; color: string }>;
  mes: string;
}) {
  const filas = Object.entries(presupuestos)
    .map(([cat, tope]) => {
      const gastado = gastos.find((g) => g.name === cat)?.value ?? 0;
      return { cat, tope, gastado, pct: tope > 0 ? gastado / tope : 0 };
    })
    .sort((a, b) => b.pct - a.pct);
  const totalTope = filas.reduce((a, f) => a + f.tope, 0);
  const totalGastado = filas.reduce((a, f) => a + f.gastado, 0);

  return (
    <div className="surface p-4 sm:p-8 mb-8 lg:mb-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
        <div>
          <div className="eyebrow mb-1">Presupuesto · {formatMes(mes)}</div>
          <h2 className="display text-2xl text-paper">Cómo venís</h2>
        </div>
        <div className="text-xs text-ink-300 tabular">
          {formatPesos(totalGastado)} de {formatPesos(totalTope)} ·{" "}
          <Link href="/settings#presupuesto" className="underline underline-offset-2 hover:text-paper">editar</Link>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
        {filas.map((f) => {
          const pasado = f.gastado > f.tope;
          return (
            <div key={f.cat}>
              <div className="flex items-baseline justify-between gap-3 text-xs mb-1.5">
                <span className="text-paper">{f.cat}</span>
                <span className={`tabular ${pasado ? "text-terra-light" : "text-ink-200"}`}>
                  {formatPesosCompact(f.gastado)} / {formatPesosCompact(f.tope)}
                  {pasado && <> · <span>te pasaste {formatPesosCompact(f.gastado - f.tope)}</span></>}
                </span>
              </div>
              <div
                className="relative h-2 w-full overflow-hidden rounded-sm border border-ink-600"
                style={{ background: PALETTE.pista }}
                role="meter"
                aria-label={`${f.cat}: ${Math.round(f.pct * 100)}% del presupuesto`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(f.pct * 100))}
              >
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-500"
                  style={{ width: `${Math.min(1, f.pct) * 100}%`, background: pasado ? PALETTE.negativo : f.pct >= 0.85 ? PALETTE.serie : PALETTE.positivo }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

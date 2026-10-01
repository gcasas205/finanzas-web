"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus, Edit2, Trash2, X, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, ArrowDownRight, ArrowUpRight, ShoppingCart, Banknote, type LucideIcon,
} from "lucide-react";
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { toast } from "sonner";
import type { DolarOperacion, Cotizacion, Transaction, BucketOrigen } from "@/types";
import { formatPesos, formatPesosCompact, formatFecha, formatMes, fechaToMes, uniqueMonths, hoyLocal } from "@/lib/utils";
import { resumenDolar } from "@/lib/dolar-calc";
import { origenesDisponibles } from "@/lib/ahorro-calc";

import { useDolar, useTransactions } from "@/components/DataProvider";
import { UsdAmount } from "@/components/UsdAmount";
import LogoLoader from "@/components/LogoLoader";
import { ErrorState, StaleDataBanner } from "@/components/ui/States";
import AnimatedNumber, { AnimatedUsdAmount } from "@/components/AnimatedNumber";
import { dolarApi, ApiError, errorMessage, type DolarOpPayload } from "@/lib/api";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Field, focusFirstInvalid } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/States";
import { PALETTE } from "@/lib/palette";
import type { ChartTooltipProps } from "@/components/ui/chart";

const ALL = "__all__";

export default function Dolares() {
  const { dolarOps, cotizacion, isLoading, error, refresh, refreshCotizacion } = useDolar();
  const { transactions } = useTransactions();
  const [editing, setEditing] = useState<DolarOperacion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshingCot, setRefreshingCot] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(ALL);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const usdTxs = useMemo(() => transactions.filter(t => t.moneda === "USD"), [transactions]);

  // Resumen global (tenencia, PPC, resultado) — siempre sobre todo el histórico
  const resumen = useMemo(() => resumenDolar(dolarOps, usdTxs), [dolarOps, usdTxs]);

  const precioValuacion = cotizacion && !cotizacion.fallback && cotizacion.compra > 0
    ? cotizacion.compra
    : resumen.precioPromedioCompra;
  const valorActualARS = resumen.tenenciaUSD * precioValuacion;
  const costoTenenciaARS = resumen.tenenciaUSD * resumen.precioPromedioCompra;
  const resultadoARS = valorActualARS - costoTenenciaARS;
  const resultadoPct = costoTenenciaARS > 0 ? (resultadoARS / costoTenenciaARS) * 100 : 0;

  // Meses disponibles (de operaciones + movimientos USD)
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const op of dolarOps) set.add(fechaToMes(op.fecha));
    for (const t of usdTxs) set.add(fechaToMes(t.fechaPago || t.fechaConsumo));
    return Array.from(set).filter(Boolean).sort().reverse();
  }, [dolarOps, usdTxs]);

  // Desglose del período seleccionado
  const desglose = useMemo(() => {
    const inMonth = (fecha: string) => selectedMonth === ALL || fechaToMes(fecha) === selectedMonth;
    let compraUSD = 0, compraARS = 0, ventaUSD = 0, ventaARS = 0, gastoUSD = 0, ingresoUSD = 0;
    for (const op of dolarOps) {
      if (!inMonth(op.fecha)) continue;
      if (op.tipo === "compra") { compraUSD += op.montoUSD; compraARS += op.totalARS; }
      else { ventaUSD += op.montoUSD; ventaARS += op.totalARS; }
    }
    for (const t of usdTxs) {
      if (!inMonth(t.fechaPago || t.fechaConsumo)) continue;
      if (t.tipo === "egreso") gastoUSD += t.monto; else ingresoUSD += t.monto;
    }
    return { compraUSD, compraARS, ventaUSD, ventaARS, gastoUSD, ingresoUSD };
  }, [dolarOps, usdTxs, selectedMonth]);

  // Evolución mensual: compras / ventas y tenencia acumulada
  const evolucion = useMemo(() => {
    const map = new Map<string, { compra: number; venta: number; gasto: number; ingreso: number }>();
    for (const op of dolarOps) {
      const m = fechaToMes(op.fecha);
      const cur = map.get(m) ?? { compra: 0, venta: 0, gasto: 0, ingreso: 0 };
      if (op.tipo === "compra") cur.compra += op.montoUSD; else cur.venta += op.montoUSD;
      map.set(m, cur);
    }
    for (const t of usdTxs) {
      const m = fechaToMes(t.fechaPago || t.fechaConsumo);
      const cur = map.get(m) ?? { compra: 0, venta: 0, gasto: 0, ingreso: 0 };
      if (t.tipo === "egreso") cur.gasto += t.monto; else cur.ingreso += t.monto;
      map.set(m, cur);
    }
    let tenencia = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, v]) => {
        tenencia += v.compra + v.ingreso - v.venta - v.gasto;
        return {
          mes, label: formatMes(mes, true),
          compra: v.compra, venta: -(v.venta + v.gasto), // gastos y ventas restan tenencia
          tenencia: Math.max(tenencia, 0),
        };
      });
  }, [dolarOps, usdTxs]);

  // Operaciones + movimientos USD unificados para la tabla, filtrados por mes
  const filas = useMemo(() => {
    const inMonth = (fecha: string) => selectedMonth === ALL || fechaToMes(fecha) === selectedMonth;
    const ops = dolarOps
      .filter(op => inMonth(op.fecha))
      .map(op => ({
        kind: "op" as const, id: op.id, fecha: op.fecha, tipo: op.tipo,
        usd: op.montoUSD, precio: op.precioARS, totalARS: op.totalARS, notas: op.notas, raw: op,
      }));
    const movs = usdTxs
      .filter(t => inMonth(t.fechaPago || t.fechaConsumo))
      .map(t => ({
        kind: "tx" as const, id: t.id,
        fecha: t.fechaPago || t.fechaConsumo,
        tipo: t.tipo === "egreso" ? "gasto" as const : "ingresoUSD" as const,
        usd: t.monto, precio: 0, totalARS: 0, notas: t.descripcion, raw: t,
      }));
    return [...ops, ...movs].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [dolarOps, usdTxs, selectedMonth]);

  const handleRefreshCot = async () => {
    setRefreshingCot(true);
    refreshCotizacion(true);
    setTimeout(() => setRefreshingCot(false), 1200);
  };

  const handleDelete = async (op: DolarOperacion) => {
    const ok = await confirm({
      title: "Eliminar operación",
      description: (
        <>
          Vas a eliminar la {op.tipo} de <strong className="text-paper"><UsdAmount value={op.montoUSD} /></strong> del{" "}
          {formatFecha(op.fecha)}. No se puede deshacer.
        </>
      ),
    });
    if (!ok) return;
    try {
      await dolarApi.remove(op.id);
      toast.success("Operación eliminada");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo eliminar la operación"), { duration: 7000 });
    }
  };

  const vacio = selectedMonth === ALL ? (
    <EmptyState
      message="Todavía no registraste operaciones ni gastos en dólares"
      action={{ label: "Registrar una compra", onClick: () => { setEditing(null); setShowForm(true); } }}
    />
  ) : (
    <EmptyState
      message="Sin movimientos en dólares para este mes"
      action={{ label: "Ver todo el histórico", onClick: () => setSelectedMonth(ALL) }}
    />
  );

  if (isLoading) return <LogoLoader className="min-h-[70vh]" />;
  if (error && dolarOps.length === 0 && transactions.length === 0) {
    return <ErrorState message={error} onRetry={refresh} className="min-h-[70vh]" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
      {error && <StaleDataBanner message={error} onRetry={refresh} />}
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Ahorro en moneda dura</div>
          <h1 className="display text-3xl sm:text-5xl text-paper">
            Tus <em className="italic">dólares</em>
          </h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Filtrar por mes"
            className="select-native min-h-11 flex-1 sm:flex-none bg-ink-800 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
          >
            <option value={ALL}>Todo el histórico</option>
            {months.map(m => <option key={m} value={m}>{formatMes(m)}</option>)}
          </select>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="shrink-0">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nueva
          </Button>
        </div>
      </header>

      {/* Cotización oficial */}
      <CotizacionBanner cot={cotizacion} onRefresh={handleRefreshCot} refreshing={refreshingCot} />

      {/* KPIs globales de la posición */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 mb-6">
        <KPICard
          variant="hero"
          eyebrow="Tenencia en dólares"
          value={<AnimatedUsdAmount value={resumen.tenenciaUSD} />}
          subtitle={`Precio prom. compra ${formatPesos(resumen.precioPromedioCompra)}`}
          accent="ink"
          icon={DollarSign}
          className="col-span-2 sm:col-span-6"
        />
        <KPICard
          eyebrow="Valor hoy (en pesos)"
          value={<AnimatedNumber value={valorActualARS} format={formatPesos} />}
          subtitle={precioValuacion > 0 ? `@ ${formatPesos(precioValuacion)}/USD` : "Sin cotización"}
          accent="ink"
          className="col-span-1 sm:col-span-3"
        />
        <KPICard
          eyebrow="Resultado por T.C."
          value={<AnimatedNumber value={resultadoARS} format={formatPesos} />}
          subtitle={`latente ${resultadoARS >= 0 ? "+" : ""}${resultadoPct.toFixed(1)}% · realizado ${resumen.resultadoRealizadoARS >= 0 ? "+" : "−"}${formatPesosCompact(Math.abs(resumen.resultadoRealizadoARS))}`}
          accent={resultadoARS >= 0 ? "moss" : "terra"}
          icon={resultadoARS >= 0 ? TrendingUp : TrendingDown}
          className="col-span-1 sm:col-span-3"
        />
      </div>

      {/* Desglose del período */}
      <div className="mb-8">
        <div className="eyebrow mb-3">
          Desglose · {selectedMonth === ALL ? "todo el histórico" : formatMes(selectedMonth)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <DesgloseCard
            icon={ShoppingCart} accent={PALETTE.positivo} label="Comprado"
            usd={desglose.compraUSD} ars={desglose.compraARS} arsLabel="pagados"
          />
          <DesgloseCard
            icon={Banknote} accent={PALETTE.negativoTexto} label="Vendido"
            usd={desglose.ventaUSD} ars={desglose.ventaARS} arsLabel="recibidos"
          />
          <DesgloseCard
            icon={ArrowUpRight} accent={PALETTE.negativo} label="Gastos en USD"
            usd={desglose.gastoUSD} arsLabel="desde tenencia"
          />
          <DesgloseCard
            icon={ArrowDownRight} accent={PALETTE.positivo} label="Ingresos en USD"
            usd={desglose.ingresoUSD} arsLabel="a tenencia"
          />
        </div>
      </div>

      {/* Gráfico de evolución */}
      {evolucion.length > 0 && (
        <div className="surface p-6 sm:p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="eyebrow mb-1">Evolución</div>
              <h2 className="display text-2xl text-paper">Tenencia y flujo mensual</h2>
            </div>
            <div className="flex gap-4 text-xs">
              <LegendDot color={PALETTE.positivo} label="Compras" />
              <LegendDot color={PALETTE.negativo} label="Salidas" />
              <LegendDot color={PALETTE.serie} label="Tenencia" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={evolucion}>
              <CartesianGrid stroke={PALETTE.grilla} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false} />
              <YAxis stroke={PALETTE.eje} fontSize={13} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${Math.abs(v)}`} />
              <Tooltip content={<UsdTooltip />} cursor={{ fill: PALETTE.cursor }} />
              <Bar dataKey="compra" name="Compras" fill={PALETTE.positivo} radius={[2, 2, 0, 0]} stackId="flujo" />
              <Bar dataKey="venta" name="Salidas" fill={PALETTE.negativo} radius={[0, 0, 2, 2]} stackId="flujo" />
              <Line type="monotone" dataKey="tenencia" name="Tenencia" stroke={PALETTE.serie}
                strokeWidth={2} dot={{ fill: PALETTE.serie, r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla de operaciones + movimientos USD */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full">
            <caption className="sr-only">Operaciones y movimientos en dólares</caption>
            <thead>
              <tr className="hairline-b">
                <th className="eyebrow text-left px-6 py-4">Fecha</th>
                <th className="eyebrow text-left px-2 py-4">Concepto</th>
                <th className="eyebrow text-right px-2 py-4">USD</th>
                <th className="eyebrow text-right px-2 py-4">Precio</th>
                <th className="eyebrow text-right px-2 py-4">Total ARS</th>
                <th className="eyebrow text-left px-2 py-4">Detalle</th>
                <th className="eyebrow text-right px-6 py-4 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={7}>
                  {vacio}
                </td></tr>
              ) : filas.map((f) => (
                <tr key={f.id} className="hairline-b last:border-0 hover:bg-ink-700/20 transition-colors group">
                  <td className="px-6 py-4 text-sm text-paper tabular font-mono">
                    {formatFecha(f.fecha)}
                    <div className="text-xs text-ink-400">{formatMes(fechaToMes(f.fecha), true)}</div>
                  </td>
                  <td className="px-2 py-4"><ConceptoBadge tipo={f.tipo} /></td>
                  <td className="px-2 py-4 text-right tabular font-mono text-sm text-paper">
                    <UsdAmount value={f.usd} />
                  </td>
                  <td className="px-2 py-4 text-right tabular font-mono text-xs text-ink-200">
                    {f.precio > 0 ? formatPesos(f.precio) : "—"}
                  </td>
                  <td className="px-2 py-4 text-right tabular font-mono text-sm">
                    {f.kind === "op" ? (
                      <span className={`whitespace-nowrap ${f.tipo === "compra" ? "text-terra-light" : "text-moss-light"}`}>
                        <span aria-hidden="true">{f.tipo === "compra" ? "−" : "+"}</span>
                        <span className="sr-only">{f.tipo === "compra" ? "pagaste " : "recibiste "}</span>
                        {formatPesos(f.totalARS)}
                      </span>
                    ) : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-2 py-4 text-xs text-ink-300 max-w-[160px] truncate">{f.notas || "—"}</td>
                  <td className="px-6 py-4 text-right">
                    {f.kind === "op" ? (
                      <div className="inline-flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(f.raw as DolarOperacion); setShowForm(true); }}
                          className="p-3.5 sm:p-1.5 text-ink-300 hover:text-paper transition-colors"
                          aria-label="Editar operación">
                          <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(f.raw as DolarOperacion)}
                          className="p-3.5 sm:p-1.5 text-ink-300 hover:text-terra-light transition-colors"
                          aria-label="Eliminar operación">
                          <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-300 italic">en Movimientos</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Celular: la tabla pasa a lista */}
          <div className="md:hidden flex flex-col divide-y divide-ink-600/60">
            {filas.length === 0 ? vacio : filas.map((f) => (
              <div key={f.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <ConceptoBadge tipo={f.tipo} />
                    <div className="text-xs text-ink-300 tabular font-mono mt-1.5">{formatFecha(f.fecha)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-paper tabular font-mono"><UsdAmount value={f.usd} /></div>
                    {f.kind === "op" && (
                      <div className={`text-xs tabular font-mono mt-0.5 ${f.tipo === "compra" ? "text-terra-light" : "text-moss-light"}`}>
                        <span aria-hidden="true">{f.tipo === "compra" ? "−" : "+"}</span>
                        <span className="sr-only">{f.tipo === "compra" ? "pagaste " : "recibiste "}</span>
                        {formatPesos(f.totalARS)} <span className="text-ink-300">@ {formatPesos(f.precio)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-ink-300 truncate">{f.notas || "—"}</div>
                  {f.kind === "op" ? (
                    <div className="flex gap-1 -mr-3.5 shrink-0">
                      <button onClick={() => { setEditing(f.raw as DolarOperacion); setShowForm(true); }}
                        className="p-3.5 text-ink-300 hover:text-paper" aria-label="Editar operación">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(f.raw as DolarOperacion)}
                        className="p-3.5 text-ink-300 hover:text-terra-light" aria-label="Eliminar operación">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-300 italic shrink-0">en Movimientos</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-400 leading-relaxed max-w-2xl">
        Las compras y ventas se cargan acá. Los gastos e ingresos en dólares se cargan en la pestaña
        Movimientos (eligiendo USD) y aparecen listados acá porque afectan tu tenencia.
      </p>

      <DolarForm
        open={showForm}
        editing={editing}
        cotizacion={cotizacion}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); refresh(); }}
      />
      {confirmDialog}
    </div>
  );
}

// ── Concepto badge ────────────────────────────────────────────────────────────

function ConceptoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    // Compra/ingreso suman dólares (verde); venta/gasto los restan (rojo).
    compra:      { label: "↓ Compra",  cls: "border-moss/40 text-moss-light bg-moss/5" },
    venta:       { label: "↑ Venta",   cls: "border-terra/40 text-terra-light bg-terra/5" },
    gasto:       { label: "⤴ Gasto USD", cls: "border-terra/40 text-terra-light bg-terra/5" },
    ingresoUSD:  { label: "⤵ Ingreso USD", cls: "border-moss/40 text-moss-light bg-moss/5" },
  };
  const b = map[tipo] ?? { label: tipo, cls: "border-control text-ink-300" };
  return <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 border ${b.cls}`}>{b.label}</span>;
}

// ── Desglose card ─────────────────────────────────────────────────────────────

function DesgloseCard({ icon: Icon, accent, label, usd, ars, arsLabel }: {
  icon: LucideIcon; accent: string; label: string; usd: number; ars?: number; arsLabel: string;
}) {
  return (
    <div className="surface p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: accent }} />
      <div className="flex items-center justify-between mb-2">
        <div className="eyebrow" style={{ color: accent === PALETTE.negativo ? PALETTE.negativoTexto : accent }}>{label}</div>
        <Icon className="w-4 h-4 text-ink-300" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="display text-xl sm:text-2xl text-paper tabular leading-none"><AnimatedUsdAmount value={usd} /></div>
      <div className="text-xs text-ink-300 mt-1 tabular">
        {ars !== undefined ? `${formatPesosCompact(ars)} ${arsLabel}` : arsLabel}
      </div>
    </div>
  );
}

// ── Banner de cotización ──────────────────────────────────────────────────────

function CotizacionBanner({ cot, onRefresh, refreshing }: {
  cot: Cotizacion | null; onRefresh: () => void; refreshing: boolean;
}) {
  const noData = !cot || cot.fallback || (cot.compra === 0 && cot.venta === 0);
  return (
    <div className="surface p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
      <div className="flex items-center gap-3">
        <div className="eyebrow">Dólar oficial · {cot?.fuente === "dolarhoy" ? "dolarhoy" : "dolarapi"}</div>
        <button type="button" onClick={onRefresh} disabled={refreshing}
          className="p-2.5 -m-2.5 text-ink-300 hover:text-paper transition-colors disabled:opacity-50"
          aria-label="Actualizar cotización">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {noData ? (
        <div className="text-sm text-ink-300 italic">
          No se pudo leer la cotización. Podés cargar el precio a mano en cada operación.
        </div>
      ) : (
        <div className="flex items-center gap-8 flex-1">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-400 mb-0.5">Compra</div>
            <div className="display text-2xl text-moss-light tabular"><AnimatedNumber value={cot!.compra} format={formatPesos} /></div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-400 mb-0.5">Venta</div>
            <div className="display text-2xl text-terra-light tabular"><AnimatedNumber value={cot!.venta} format={formatPesos} /></div>
          </div>
          {cot!.actualizado && (
            <div className="ml-auto text-xs text-ink-400 hidden sm:block">
              Actualizado {formatActualizado(cot!.actualizado)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPICard({ variant = "default", eyebrow, value, accent, subtitle, icon: Icon, className = "" }: {
  variant?: "hero" | "default";
  eyebrow: string; value: React.ReactNode; accent: "moss" | "terra" | "ink";
  subtitle: string; icon?: LucideIcon; className?: string;
}) {
  const accentColors = { moss: PALETTE.positivo, terra: PALETTE.negativoTexto, ink: PALETTE.eje };
  const color = accentColors[accent];
  const isHero = variant === "hero";
  return (
    <div className={`surface p-4 sm:p-7 relative overflow-hidden ${className}`}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />
      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className="eyebrow text-xs" style={{ color }}>{eyebrow}</div>
        {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-ink-300 hidden sm:block" strokeWidth={1.5} />}
      </div>
      <div className={`display tabular leading-none ${isHero ? "text-3xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl lg:text-4xl"} text-paper mb-1 sm:mb-2`}>
        {value}
      </div>
      <div className="text-xs text-ink-300 tracking-wide truncate">{subtitle}</div>
    </div>
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

function UsdTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800/95 backdrop-blur-md border border-ink-500 rounded-sm shadow-2xl px-4 py-3 min-w-[160px]">
      {label && <div className="text-xs uppercase tracking-widest text-ink-300 mb-2 font-mono">{label}</div>}
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
            <span className="text-ink-200">{e.name}</span>
          </div>
          <span className="text-paper tabular font-mono"><UsdAmount value={Math.abs(Number(e.value ?? 0))} /></span>
        </div>
      ))}
    </div>
  );
}

// ── Formulario (compra / venta) ───────────────────────────────────────────────

type Errors = Partial<Record<string, string>>;

function DolarForm({ open, editing, cotizacion, onClose, onSaved }: {
  open: boolean;
  editing: DolarOperacion | null;
  cotizacion: Cotizacion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={editing ? "Editar" : "Nueva"}
      title={editing ? "Modificar operación" : "Comprar / vender USD"}
    >
      <DolarFormBody key={editing?.id ?? "nueva"} editing={editing} cotizacion={cotizacion} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

function DolarFormBody({ editing, cotizacion, onClose, onSaved }: {
  editing: DolarOperacion | null;
  cotizacion: Cotizacion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { ahorroConfig } = useTransactions();
  const today = hoyLocal();
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState<"compra" | "venta">(editing?.tipo || "compra");
  const [fecha, setFecha] = useState(editing?.fecha || today);
  const [montoUSD, setMontoUSD] = useState(editing?.montoUSD?.toString() || "");
  const [precioARS, setPrecioARS] = useState(editing?.precioARS?.toString() || "");
  const [precioAuto, setPrecioAuto] = useState(!editing);
  const [notas, setNotas] = useState(editing?.notas || "");
  const [asigMediano, setAsigMediano] = useState(editing?.asigMediano != null ? String(editing.asigMediano) : "");
  const [asigLargo, setAsigLargo] = useState(editing?.asigLargo != null ? String(editing.asigLargo) : "");
  const [origen, setOrigen] = useState<BucketOrigen>(editing?.origen ?? "regla");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const clear = (field: string) => setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const cotDisponible = cotizacion && !cotizacion.fallback &&
    (cotizacion.compra > 0 || cotizacion.venta > 0);

  useEffect(() => {
    if (precioAuto && cotDisponible) {
      const sugerido = tipo === "compra" ? cotizacion!.venta : cotizacion!.compra;
      setPrecioARS(sugerido ? String(sugerido) : "");
    }
  }, [tipo, precioAuto, cotDisponible, cotizacion]);

  const usd = parseFloat(montoUSD) || 0;
  const precio = parseFloat(precioARS) || 0;
  const totalARS = usd * precio;
  const asignado = (parseFloat(asigMediano) || 0) + (parseFloat(asigLargo) || 0);
  const sinAsignar = Math.round((usd - asignado) * 100) / 100;

  const validate = (): Errors => {
    const e: Errors = {};
    if (!montoUSD) e.montoUSD = "Poné el monto en USD";
    else if (!(usd > 0)) e.montoUSD = "El monto tiene que ser mayor a 0";
    if (!precioARS) e.precioARS = "Poné el precio del dólar";
    else if (!(precio > 0)) e.precioARS = "El precio tiene que ser mayor a 0";
    if (!fecha) e.fecha = "Indicá la fecha de la operación";
    else if (fecha > today) e.fecha = "La fecha no puede ser futura";
    if (tipo === "compra" && usd > 0 && sinAsignar < -0.005) {
      e.asigMediano = `Asignaste US$ ${Math.abs(sinAsignar).toLocaleString("es-AR")} de más respecto del monto comprado`;
    }
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const found = validate();
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    const payload: DolarOpPayload = {
      ...(editing ? { id: editing.id, createdAt: editing.createdAt } : {}),
      fecha, tipo, montoUSD: usd, precioARS: precio, notas,
      ...(tipo === "compra"
        ? { asigMediano: parseFloat(asigMediano) || 0, asigLargo: parseFloat(asigLargo) || 0 }
        : { origen }),
    };
    try {
      if (editing) await dolarApi.update({ ...payload, id: editing.id });
      else await dolarApi.create(payload);
      toast.success(editing ? "Operación actualizada" : tipo === "compra" ? "Compra registrada" : "Venta registrada");
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.field) {
        setErrors({ [e.field]: e.message });
        focusFirstInvalid(formRef.current);
      } else {
        toast.error(errorMessage(e, "No se pudo guardar la operación"), { duration: 7000 });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <div className="space-y-5">
        <Segmented
          label="Tipo de operación"
          value={tipo}
          onChange={(t) => { setTipo(t); setPrecioAuto(true); }}
          options={[
            { value: "compra", label: "↓ Compro USD", tone: "positivo" },
            { value: "venta", label: "↑ Vendo USD", tone: "negativo" },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monto (USD)" required error={errors.montoUSD}>
            {(c) => (
              <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={montoUSD}
                onChange={(e) => { setMontoUSD(e.target.value); clear("montoUSD"); clear("asigMediano"); }}
                placeholder="0,00" className="form-input tabular font-mono" data-autofocus />
            )}
          </Field>
          <Field
            label="Precio (ARS/USD)"
            required
            error={errors.precioARS}
            extra={cotDisponible ? (
              <label className="-my-3 flex cursor-pointer items-center gap-2 whitespace-nowrap py-3 text-xs text-ink-200">
                <input type="checkbox" checked={precioAuto}
                  onChange={(e) => setPrecioAuto(e.target.checked)} className="h-4 w-4 accent-amber" />
                Del día
              </label>
            ) : undefined}
          >
            {(c) => (
              <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={precioARS}
                onChange={(e) => { setPrecioARS(e.target.value); setPrecioAuto(false); clear("precioARS"); }}
                placeholder="0,00" className="form-input tabular font-mono" />
            )}
          </Field>
        </div>

        <Field
          label="Fecha de la operación"
          required
          error={errors.fecha}
          hint="Podés cargar operaciones de meses anteriores con el precio de ese momento."
        >
          {(c) => (
            <input {...c} type="date" value={fecha} max={today}
              onChange={(e) => { setFecha(e.target.value); clear("fecha"); }} className="form-input tabular" />
          )}
        </Field>

        <div className="surface p-4 flex items-center justify-between">
          <span className="eyebrow">{tipo === "compra" ? "Pagás en pesos" : "Recibís en pesos"}</span>
          <span className={`display text-2xl tabular ${tipo === "compra" ? "text-terra-light" : "text-moss-light"}`}>
            {tipo === "compra" ? "−" : "+"}{formatPesos(totalARS)}
          </span>
        </div>

        {/* Ahorro: reparto (compra) u origen del retiro (venta) */}
        {tipo === "compra" ? (
          <fieldset className="surface p-4 space-y-3">
            <legend className="eyebrow px-1">Destino del ahorro</legend>
            <p className="text-xs text-ink-300 leading-relaxed">
              El piso de emergencia se completa primero de forma automática. Repartí el resto de esta compra
              entre mediano y largo plazo.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="→ Mediano (USD)" error={errors.asigMediano}>
                {(c) => (
                  <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={asigMediano}
                    onChange={(e) => { setAsigMediano(e.target.value); clear("asigMediano"); }}
                    placeholder="0,00" className="form-input tabular font-mono" />
                )}
              </Field>
              <Field label="→ Largo · S&P (USD)" error={errors.asigLargo}>
                {(c) => (
                  <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={asigLargo}
                    onChange={(e) => { setAsigLargo(e.target.value); clear("asigLargo"); clear("asigMediano"); }}
                    placeholder="0,00" className="form-input tabular font-mono" />
                )}
              </Field>
            </div>
            {usd > 0 && sinAsignar > 0.005 && (
              <p className="text-xs text-ink-300">
                Sin asignar: US$ {sinAsignar.toLocaleString("es-AR")}, va a mediano.
              </p>
            )}
          </fieldset>
        ) : (
          <Field
            label="Origen del retiro"
            hint={<>&quot;Automático&quot; descuenta por la regla (mediano → largo → piso). O elegí un sobre puntual.</>}
          >
            {(c) => (
              <select {...c} value={origen} onChange={(e) => setOrigen(e.target.value as BucketOrigen)} className="form-input">
                {origenesDisponibles(ahorroConfig).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </Field>
        )}

        <Field label="Notas (opcional)" error={errors.notas}>
          {(c) => (
            <input {...c} type="text" value={notas} maxLength={500}
              onChange={(e) => { setNotas(e.target.value); clear("notas"); }}
              placeholder="Ej: compra mensual en el banco" className="form-input" />
          )}
        </Field>
      </div>

      <DialogActions>
        <Button variant="fantasma" onClick={onClose}>Cancelar</Button>
        <Button type="submit" isLoading={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogActions>
    </form>
  );
}

/** "2026-10-01T14:30:00Z" → "1/10/26, 11:30" (si no es una fecha, se muestra tal cual). */
function formatActualizado(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

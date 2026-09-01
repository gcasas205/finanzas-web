"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit2, Trash2, X, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, ArrowDownRight, ArrowUpRight, ShoppingCart, Banknote,
} from "lucide-react";
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { toast } from "sonner";
import type { DolarOperacion, Cotizacion, Transaction } from "@/types";
import { formatPesos, formatPesosCompact, formatUSD, formatFecha, formatMes, fechaToMes, uniqueMonths } from "@/lib/utils";
import { resumenDolar } from "@/lib/dolar-calc";
import { useDolar, useTransactions } from "@/components/DataProvider";

const ALL = "__all__";

export default function Dolares() {
  const { dolarOps, cotizacion, isLoading, refresh, refreshCotizacion } = useDolar();
  const { transactions } = useTransactions();
  const [editing, setEditing] = useState<DolarOperacion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshingCot, setRefreshingCot] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(ALL);

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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta operación?")) return;
    const r = await fetch("/api/dolar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const d = await r.json();
    if (d.ok) { toast.success("Eliminada"); refresh(); }
    else toast.error("Error al eliminar");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Ahorro en moneda dura</div>
          <h1 className="display text-3xl sm:text-5xl text-paper">
            Tus <em className="italic text-amber">dólares</em>
          </h1>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-ink-800 border border-ink-500 text-paper px-3 py-2 text-sm focus:border-amber outline-none cursor-pointer"
          >
            <option value={ALL}>Todo el histórico</option>
            {months.map(m => <option key={m} value={m}>{formatMes(m)}</option>)}
          </select>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-amber text-ink-900 px-5 py-2.5 text-sm font-medium hover:bg-amber-light transition-all"
          >
            <Plus className="w-4 h-4" />
            Nueva
          </button>
        </div>
      </header>

      {/* Cotización oficial */}
      <CotizacionBanner cot={cotizacion} onRefresh={handleRefreshCot} refreshing={refreshingCot} />

      {/* KPIs globales de la posición */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 mb-6">
        <KPICard
          variant="hero"
          eyebrow="Tenencia en dólares"
          value={formatUSD(resumen.tenenciaUSD)}
          subtitle={`Precio prom. compra ${formatPesos(resumen.precioPromedioCompra)}`}
          accent="amber"
          icon={DollarSign}
          className="col-span-2 sm:col-span-6"
        />
        <KPICard
          eyebrow="Valor hoy (en pesos)"
          value={formatPesos(valorActualARS)}
          subtitle={precioValuacion > 0 ? `@ ${formatPesos(precioValuacion)}/USD` : "Sin cotización"}
          accent="ink"
          className="col-span-1 sm:col-span-3"
        />
        <KPICard
          eyebrow="Resultado por T.C."
          value={formatPesos(resultadoARS)}
          subtitle={`${resultadoARS >= 0 ? "+" : ""}${resultadoPct.toFixed(1)}% vs. costo`}
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
            icon={ShoppingCart} accent="#6A8970" label="Comprado"
            usd={desglose.compraUSD} ars={desglose.compraARS} arsLabel="pagados"
          />
          <DesgloseCard
            icon={Banknote} accent="#D4886E" label="Vendido"
            usd={desglose.ventaUSD} ars={desglose.ventaARS} arsLabel="recibidos"
          />
          <DesgloseCard
            icon={ArrowUpRight} accent="#A04A2F" label="Gastos en USD"
            usd={desglose.gastoUSD} arsLabel="desde tenencia"
          />
          <DesgloseCard
            icon={ArrowDownRight} accent="#C9A24B" label="Ingresos en USD"
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
            <div className="flex gap-4 text-[11px]">
              <LegendDot color="#6A8970" label="Compras" />
              <LegendDot color="#A04A2F" label="Salidas" />
              <LegendDot color="#C9A24B" label="Tenencia" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={evolucion}>
              <CartesianGrid stroke="#252420" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#8A8576" fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${Math.abs(v)}`} />
              <Tooltip content={<UsdTooltip />} cursor={{ fill: "rgba(244,241,234,0.03)" }} />
              <Bar dataKey="compra" name="Compras" fill="#6A8970" radius={[2, 2, 0, 0]} stackId="flujo" />
              <Bar dataKey="venta" name="Salidas" fill="#A04A2F" radius={[0, 0, 2, 2]} stackId="flujo" />
              <Line type="monotone" dataKey="tenencia" name="Tenencia" stroke="#C9A24B"
                strokeWidth={2} dot={{ fill: "#C9A24B", r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla de operaciones + movimientos USD */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
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
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-ink-300 italic">Cargando...</td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-ink-300 italic">
                  {selectedMonth === ALL
                    ? "Todavía no registraste operaciones ni gastos en dólares"
                    : "Sin movimientos en dólares para este mes"}
                </td></tr>
              ) : filas.map((f) => (
                <tr key={f.id} className="hairline-b last:border-0 hover:bg-ink-700/20 transition-colors group">
                  <td className="px-6 py-4 text-sm text-paper tabular font-mono">
                    {formatFecha(f.fecha)}
                    <div className="text-[10px] text-ink-400">{formatMes(fechaToMes(f.fecha), true)}</div>
                  </td>
                  <td className="px-2 py-4"><ConceptoBadge tipo={f.tipo} /></td>
                  <td className="px-2 py-4 text-right tabular font-mono text-sm text-paper">
                    {formatUSD(f.usd)}
                  </td>
                  <td className="px-2 py-4 text-right tabular font-mono text-xs text-ink-200">
                    {f.precio > 0 ? formatPesos(f.precio) : "—"}
                  </td>
                  <td className="px-2 py-4 text-right tabular font-mono text-sm">
                    {f.kind === "op" ? (
                      <span className={f.tipo === "compra" ? "text-terra-light" : "text-moss-light"}>
                        {f.tipo === "compra" ? "-" : "+"}{formatPesos(f.totalARS)}
                      </span>
                    ) : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-2 py-4 text-xs text-ink-300 max-w-[160px] truncate">{f.notas || "—"}</td>
                  <td className="px-6 py-4 text-right">
                    {f.kind === "op" ? (
                      <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(f.raw as DolarOperacion); setShowForm(true); }}
                          className="p-1.5 text-ink-300 hover:text-paper transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(f.id)}
                          className="p-1.5 text-ink-300 hover:text-terra-light transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-ink-500 italic">en Movimientos</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink-400 leading-relaxed max-w-2xl">
        Las compras y ventas se cargan acá. Los gastos e ingresos en dólares se cargan en la pestaña
        Movimientos (eligiendo USD) y aparecen listados acá porque afectan tu tenencia.
      </p>

      <AnimatePresence>
        {showForm && (
          <DolarForm
            editing={editing}
            cotizacion={cotizacion}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Concepto badge ────────────────────────────────────────────────────────────

function ConceptoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    compra:      { label: "↓ Compra",  cls: "border-moss/40 text-moss-light bg-moss/5" },
    venta:       { label: "↑ Venta",   cls: "border-terra/40 text-terra-light bg-terra/5" },
    gasto:       { label: "⤴ Gasto USD", cls: "border-terra/40 text-terra-light bg-terra/5" },
    ingresoUSD:  { label: "⤵ Ingreso USD", cls: "border-moss/40 text-moss-light bg-moss/5" },
  };
  const b = map[tipo] ?? { label: tipo, cls: "border-ink-500 text-ink-300" };
  return <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 border ${b.cls}`}>{b.label}</span>;
}

// ── Desglose card ─────────────────────────────────────────────────────────────

function DesgloseCard({ icon: Icon, accent, label, usd, ars, arsLabel }: {
  icon: any; accent: string; label: string; usd: number; ars?: number; arsLabel: string;
}) {
  return (
    <div className="surface p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: accent }} />
      <div className="flex items-center justify-between mb-2">
        <div className="eyebrow text-[9px] sm:text-[10px]" style={{ color: accent }}>{label}</div>
        <Icon className="w-3.5 h-3.5 text-ink-300" strokeWidth={1.5} />
      </div>
      <div className="display text-xl sm:text-2xl text-paper tabular leading-none">{formatUSD(usd)}</div>
      <div className="text-[10px] text-ink-300 mt-1 tabular">
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
        <div className="eyebrow text-amber">Dólar oficial · dolarhoy</div>
        <button onClick={onRefresh} disabled={refreshing}
          className="text-ink-300 hover:text-amber transition-colors disabled:opacity-50"
          title="Actualizar cotización">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      {noData ? (
        <div className="text-sm text-ink-300 italic">
          No se pudo leer la cotización. Podés cargar el precio a mano en cada operación.
        </div>
      ) : (
        <div className="flex items-center gap-8 flex-1">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">Compra</div>
            <div className="display text-2xl text-moss-light tabular">{formatPesos(cot!.compra)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">Venta</div>
            <div className="display text-2xl text-terra-light tabular">{formatPesos(cot!.venta)}</div>
          </div>
          {cot!.actualizado && (
            <div className="ml-auto text-[10px] text-ink-400 hidden sm:block">
              Actualizado {cot!.actualizado}
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
  eyebrow: string; value: string; accent: "moss" | "terra" | "amber" | "ink";
  subtitle: string; icon?: any; className?: string;
}) {
  const accentColors = { moss: "#6A8970", terra: "#D4886E", amber: "#C9A24B", ink: "#8A8576" };
  const color = accentColors[accent];
  const isHero = variant === "hero";
  return (
    <div className={`surface p-4 sm:p-7 relative overflow-hidden ${className}`}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />
      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className="eyebrow text-[8px] sm:text-[10px]" style={{ color }}>{eyebrow}</div>
        {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-ink-300 hidden sm:block" strokeWidth={1.5} />}
      </div>
      <div className={`display tabular leading-none ${isHero ? "text-3xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl lg:text-4xl"} text-paper mb-1 sm:mb-2`}>
        {value}
      </div>
      <div className="text-[9px] sm:text-[11px] text-ink-300 tracking-wide truncate">{subtitle}</div>
    </div>
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

function UsdTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800/95 backdrop-blur-md border border-ink-500 rounded-sm shadow-2xl px-4 py-3 min-w-[160px]">
      {label && <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-2 font-mono">{label}</div>}
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
            <span className="text-ink-200">{e.name}</span>
          </div>
          <span className="text-paper tabular font-mono">{formatUSD(Math.abs(e.value))}</span>
        </div>
      ))}
    </div>
  );
}

// ── Formulario (compra / venta) ───────────────────────────────────────────────

function DolarForm({ editing, cotizacion, onClose, onSaved }: {
  editing: DolarOperacion | null;
  cotizacion: Cotizacion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<"compra" | "venta">(editing?.tipo || "compra");
  const [fecha, setFecha] = useState(editing?.fecha || today);
  const [montoUSD, setMontoUSD] = useState(editing?.montoUSD?.toString() || "");
  const [precioARS, setPrecioARS] = useState(editing?.precioARS?.toString() || "");
  const [precioAuto, setPrecioAuto] = useState(!editing);
  const [notas, setNotas] = useState(editing?.notas || "");
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async () => {
    if (!montoUSD || !precioARS || !fecha) {
      toast.error("Completá fecha, monto en USD y precio");
      return;
    }
    setSaving(true);
    const payload = {
      ...(editing ? { id: editing.id, createdAt: editing.createdAt } : {}),
      fecha, tipo, montoUSD: usd, precioARS: precio, notas,
    };
    const method = editing ? "PUT" : "POST";
    const r = await fetch("/api/dolar", {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.ok || d.operacion) { toast.success(editing ? "Actualizada" : "Registrada"); onSaved(); }
    else toast.error(d.error || "Error al guardar");
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-ink-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.25 }}
        className="surface-elevated w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">{editing ? "Editar" : "Nueva"}</div>
            <h2 className="display text-3xl text-paper">
              {editing ? "Modificar operación" : "Comprar / Vender USD"}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-paper p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {(["compra", "venta"] as const).map(t => (
              <button key={t} onClick={() => { setTipo(t); setPrecioAuto(true); }}
                className={`py-3 border text-sm transition-all ${
                  tipo === t
                    ? t === "compra" ? "border-moss bg-moss/10 text-moss-light" : "border-terra bg-terra/10 text-terra-light"
                    : "border-ink-500 text-ink-300 hover:border-ink-400"
                }`}>
                {t === "compra" ? "↓ Compro USD" : "↑ Vendo USD"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Monto (USD)">
              <input type="number" step="0.01" value={montoUSD}
                onChange={(e) => setMontoUSD(e.target.value)}
                placeholder="0.00" className="form-input tabular font-mono" autoFocus />
            </Field>
            <Field label={
              <span className="flex items-center gap-2">
                Precio (ARS/USD)
                {cotDisponible && (
                  <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                    <input type="checkbox" checked={precioAuto}
                      onChange={(e) => setPrecioAuto(e.target.checked)} className="accent-amber" />
                    <span>Auto</span>
                  </label>
                )}
              </span>
            }>
              <input type="number" step="0.01" value={precioARS}
                onChange={(e) => { setPrecioARS(e.target.value); setPrecioAuto(false); }}
                placeholder="0.00" className="form-input tabular font-mono" />
            </Field>
          </div>

          <Field label="Fecha de la operación">
            <input type="date" value={fecha} max={today}
              onChange={(e) => setFecha(e.target.value)} className="form-input tabular" />
            <p className="text-[10px] text-ink-400 mt-1">
              Podés cargar operaciones de meses anteriores con el precio de ese momento.
            </p>
          </Field>

          <div className="surface p-4 flex items-center justify-between">
            <span className="eyebrow">Total en pesos</span>
            <span className={`display text-2xl tabular ${tipo === "compra" ? "text-terra-light" : "text-moss-light"}`}>
              {tipo === "compra" ? "-" : "+"}{formatPesos(totalARS)}
            </span>
          </div>

          <Field label="Notas (opcional)">
            <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: compra mensual en el banco" className="form-input" />
          </Field>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 hairline-t">
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-ink-300 hover:text-paper transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2.5 bg-amber text-ink-900 text-sm font-medium hover:bg-amber-light disabled:opacity-50 transition-all">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </motion.div>

      <style jsx global>{`
        .form-input {
          width: 100%;
          background: rgba(13, 18, 13, 0.6);
          border: 1px solid #3A3833;
          color: #F4F1EA;
          padding: 10px 14px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus { border-color: #C9A24B; }
      `}</style>
    </motion.div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow block mb-2">{label}</label>
      {children}
    </div>
  );
}

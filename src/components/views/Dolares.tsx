"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit2, Trash2, X, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";
import type { DolarOperacion, Cotizacion } from "@/types";
import { formatPesos, formatUSD, formatFecha, formatMes, fechaToMes } from "@/lib/utils";
import { resumenDolar } from "@/lib/dolar-calc";
import { useDolar } from "@/components/DataProvider";

export default function Dolares() {
  const { dolarOps, cotizacion, isLoading, refresh, refreshCotizacion } = useDolar();
  const [editing, setEditing] = useState<DolarOperacion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshingCot, setRefreshingCot] = useState(false);

  const resumen = useMemo(() => resumenDolar(dolarOps), [dolarOps]);

  // Valor actual de la tenencia: se valúa al precio de COMPRA del banco
  // (lo que te pagarían hoy si vendieras). Fallback al promedio si no hay cotización.
  const precioValuacion = cotizacion && !cotizacion.fallback && cotizacion.compra > 0
    ? cotizacion.compra
    : resumen.precioPromedioCompra;

  const valorActualARS = resumen.tenenciaUSD * precioValuacion;
  const costoTenenciaARS = resumen.tenenciaUSD * resumen.precioPromedioCompra;
  const resultadoARS = valorActualARS - costoTenenciaARS;
  const resultadoPct = costoTenenciaARS > 0 ? (resultadoARS / costoTenenciaARS) * 100 : 0;

  const opsOrdenadas = useMemo(
    () => [...dolarOps].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [dolarOps],
  );

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
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-amber text-ink-900 px-5 py-2.5 text-sm font-medium hover:bg-amber-light transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva operación
        </button>
      </header>

      {/* Cotización oficial */}
      <CotizacionBanner
        cot={cotizacion}
        onRefresh={handleRefreshCot}
        refreshing={refreshingCot}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 mb-8 lg:mb-12">
        <KPICard
          variant="hero"
          eyebrow="Tenencia en dólares"
          value={formatUSD(resumen.tenenciaUSD)}
          subtitle={`Precio prom. compra ${formatPesos(resumen.precioPromedioCompra)}`}
          accent="amber"
          icon={DollarSign}
          className="col-span-2 sm:col-span-6"
          delay={0}
        />
        <KPICard
          eyebrow="Valor hoy (en pesos)"
          value={formatPesos(valorActualARS)}
          subtitle={precioValuacion > 0 ? `@ ${formatPesos(precioValuacion)}/USD` : "Sin cotización"}
          accent="ink"
          className="col-span-1 sm:col-span-3"
          delay={0.1}
        />
        <KPICard
          eyebrow="Resultado por T.C."
          value={formatPesos(resultadoARS)}
          subtitle={`${resultadoARS >= 0 ? "+" : ""}${resultadoPct.toFixed(1)}% vs. costo`}
          accent={resultadoARS >= 0 ? "moss" : "terra"}
          icon={resultadoARS >= 0 ? TrendingUp : TrendingDown}
          className="col-span-1 sm:col-span-3"
          delay={0.15}
        />
      </div>

      {/* Resumen compra/venta histórico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-8">
        <div className="surface p-5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-moss/10 flex items-center justify-center shrink-0">
            <ArrowDownRight className="w-4 h-4 text-moss-light" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="eyebrow text-moss-light mb-0.5">Comprado histórico</div>
            <div className="text-paper tabular">{formatUSD(resumen.totalCompradoUSD)}</div>
          </div>
          <div className="text-right text-xs text-ink-300 tabular">{formatPesos(resumen.totalCompradoARS)}</div>
        </div>
        <div className="surface p-5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-terra/10 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-4 h-4 text-terra-light" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="eyebrow text-terra-light mb-0.5">Vendido histórico</div>
            <div className="text-paper tabular">{formatUSD(resumen.totalVendidoUSD)}</div>
          </div>
          <div className="text-right text-xs text-ink-300 tabular">{formatPesos(resumen.totalVendidoARS)}</div>
        </div>
      </div>

      {/* Tabla de operaciones */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="hairline-b">
                <th className="eyebrow text-left px-6 py-4">Fecha</th>
                <th className="eyebrow text-left px-2 py-4">Tipo</th>
                <th className="eyebrow text-right px-2 py-4">USD</th>
                <th className="eyebrow text-right px-2 py-4">Precio</th>
                <th className="eyebrow text-right px-2 py-4">Total ARS</th>
                <th className="eyebrow text-left px-2 py-4">Notas</th>
                <th className="eyebrow text-right px-6 py-4 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-ink-300 italic">Cargando...</td></tr>
              ) : opsOrdenadas.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-ink-300 italic">
                  Todavía no registraste compras ni ventas de dólares
                </td></tr>
              ) : opsOrdenadas.map((op) => (
                <tr key={op.id} className="hairline-b last:border-0 hover:bg-ink-700/20 transition-colors group">
                  <td className="px-6 py-4 text-sm text-paper tabular font-mono">
                    {formatFecha(op.fecha)}
                    <div className="text-[10px] text-ink-400">{formatMes(fechaToMes(op.fecha), true)}</div>
                  </td>
                  <td className="px-2 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 border ${
                      op.tipo === "compra"
                        ? "border-moss/40 text-moss-light bg-moss/5"
                        : "border-terra/40 text-terra-light bg-terra/5"
                    }`}>
                      {op.tipo === "compra" ? "↓ Compra" : "↑ Venta"}
                    </span>
                  </td>
                  <td className="px-2 py-4 text-right tabular font-mono text-sm text-paper">
                    {formatUSD(op.montoUSD)}
                  </td>
                  <td className="px-2 py-4 text-right tabular font-mono text-xs text-ink-200">
                    {formatPesos(op.precioARS)}
                  </td>
                  <td className="px-2 py-4 text-right tabular font-mono text-sm">
                    <span className={op.tipo === "compra" ? "text-terra-light" : "text-moss-light"}>
                      {op.tipo === "compra" ? "-" : "+"}{formatPesos(op.totalARS)}
                    </span>
                  </td>
                  <td className="px-2 py-4 text-xs text-ink-300 max-w-[160px] truncate">{op.notas || "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(op); setShowForm(true); }}
                        className="p-1.5 text-ink-300 hover:text-paper transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(op.id)}
                        className="p-1.5 text-ink-300 hover:text-terra-light transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink-400 leading-relaxed max-w-2xl">
        Cada compra descuenta su equivalente en pesos de tu acumulado y cada venta lo suma,
        así que no hace falta cargar también un movimiento manual en pesos por la operación.
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

// ── Banner de cotización ──────────────────────────────────────────────────────

function CotizacionBanner({ cot, onRefresh, refreshing }: {
  cot: Cotizacion | null; onRefresh: () => void; refreshing: boolean;
}) {
  const noData = !cot || cot.fallback || (cot.compra === 0 && cot.venta === 0);

  return (
    <div className="surface p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
      <div className="flex items-center gap-3">
        <div className="eyebrow text-amber">Dólar oficial · dolarhoy</div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-ink-300 hover:text-amber transition-colors disabled:opacity-50"
          title="Actualizar cotización"
        >
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

// ── KPI card (misma estética que Dashboard) ───────────────────────────────────

function KPICard({ variant = "default", eyebrow, value, accent, subtitle, icon: Icon, delay = 0, className = "" }: {
  variant?: "hero" | "default";
  eyebrow: string; value: string; accent: "moss" | "terra" | "amber" | "ink";
  subtitle: string; icon?: any; delay?: number; className?: string;
}) {
  const accentColors = { moss: "#6A8970", terra: "#D4886E", amber: "#C9A24B", ink: "#8A8576" };
  const color = accentColors[accent];
  const isHero = variant === "hero";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`surface p-4 sm:p-7 relative overflow-hidden ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />
      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className="eyebrow text-[8px] sm:text-[10px]" style={{ color }}>{eyebrow}</div>
        {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-ink-300 hidden sm:block" strokeWidth={1.5} />}
      </div>
      <div className={`display tabular leading-none ${isHero ? "text-3xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl lg:text-4xl"} text-paper mb-1 sm:mb-2`}>
        {value}
      </div>
      <div className="text-[9px] sm:text-[11px] text-ink-300 tracking-wide truncate">{subtitle}</div>
    </motion.div>
  );
}

// ── Formulario ────────────────────────────────────────────────────────────────

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

  // Autocompleta el precio con la cotización del día según el tipo:
  // al comprar pagás el precio de VENTA del banco; al vender cobrás el de COMPRA.
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
      fecha, tipo,
      montoUSD: usd,
      precioARS: precio,
      notas,
    };
    const method = editing ? "PUT" : "POST";
    const r = await fetch("/api/dolar", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.ok || d.operacion) {
      toast.success(editing ? "Actualizada" : "Registrada");
      onSaved();
    } else {
      toast.error(d.error || "Error al guardar");
    }
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
          <button onClick={onClose} className="text-ink-300 hover:text-paper p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            {(["compra", "venta"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTipo(t); setPrecioAuto(true); }}
                className={`py-3 border text-sm transition-all ${
                  tipo === t
                    ? t === "compra" ? "border-moss bg-moss/10 text-moss-light" : "border-terra bg-terra/10 text-terra-light"
                    : "border-ink-500 text-ink-300 hover:border-ink-400"
                }`}
              >
                {t === "compra" ? "↓ Compro USD" : "↑ Vendo USD"}
              </button>
            ))}
          </div>

          {/* Monto USD + Precio */}
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
                      onChange={(e) => setPrecioAuto(e.target.checked)}
                      className="accent-amber" />
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

          {/* Fecha */}
          <Field label="Fecha de la operación">
            <input type="date" value={fecha} max={today}
              onChange={(e) => setFecha(e.target.value)}
              className="form-input tabular" />
            <p className="text-[10px] text-ink-400 mt-1">
              Podés cargar operaciones de meses anteriores con el precio de ese momento.
            </p>
          </Field>

          {/* Total calculado */}
          <div className="surface p-4 flex items-center justify-between">
            <span className="eyebrow">Total en pesos</span>
            <span className={`display text-2xl tabular ${tipo === "compra" ? "text-terra-light" : "text-moss-light"}`}>
              {tipo === "compra" ? "-" : "+"}{formatPesos(totalARS)}
            </span>
          </div>

          {/* Notas */}
          <Field label="Notas (opcional)">
            <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: compra mensual en el banco" className="form-input" />
          </Field>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 hairline-t">
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm text-ink-300 hover:text-paper transition-colors">
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

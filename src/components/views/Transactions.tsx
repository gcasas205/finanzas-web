"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Edit2, Trash2, X, Filter } from "lucide-react";
import { toast } from "sonner";
import type { Transaction, AppConfig, BucketOrigen } from "@/types";
import { formatPesos, formatFecha, fechaToMes, formatMes, uniqueMonths, calcularFechaPagoTarjeta, hoyLocal } from "@/lib/utils";
import { ORIGEN_LABEL } from "@/lib/ahorro-calc";
import { CATEGORIES, autoCategorizar, getCategoryColor } from "@/lib/categories";
import { useTransactions } from "@/components/DataProvider";
import { UsdAmount } from "@/components/UsdAmount";

interface Props { config: AppConfig; }

export default function Transactions({ config }: Props) {
  const { transactions, isLoading: loading, refresh } = useTransactions();
  const [filterMonth, setFilterMonth] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [visibleCount, setVisibleCount] = useState(50);
  const months = useMemo(() => uniqueMonths(transactions), [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterMonth && fechaToMes(t.fechaPago) !== filterMonth) return false;
      if (filterType !== "todos" && t.tipo !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.descripcion.toLowerCase().includes(s) &&
            !t.categoria.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => b.fechaPago.localeCompare(a.fechaPago));
  }, [transactions, filterMonth, filterType, search]);

  const visibleRows = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const totals = useMemo(() => {
    const ars = filtered.filter(t => t.moneda !== "USD");
    const usd = filtered.filter(t => t.moneda === "USD");
    const i = ars.filter(t => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0);
    const e = ars.filter(t => t.tipo === "egreso").reduce((s, t) => s + t.monto, 0);
    const usdIng = usd.filter(t => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0);
    const usdEgr = usd.filter(t => t.tipo === "egreso").reduce((s, t) => s + t.monto, 0);
    return {
      ingresos: i, egresos: e, balance: i - e,
      usdIngresos: usdIng, usdEgresos: usdEgr, usdBalance: usdIng - usdEgr,
      hayUSD: usd.length > 0,
    };
  }, [filtered]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    const r = await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const d = await r.json();
    if (d.ok) {
      toast.success("Eliminada");
      refresh();
    } else {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <div className="eyebrow mb-2">Movimientos</div>
          <h1 className="display text-3xl sm:text-5xl text-paper">
            Cada <em className="italic text-amber">peso</em>
          </h1>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-amber text-ink-900 px-5 py-2.5 text-sm font-medium hover:bg-amber-light transition-all"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </header>

      {/* Filters */}
      <div className="surface p-3 sm:p-5 mb-4 sm:mb-6 flex flex-wrap gap-3 sm:gap-4 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descripción o categoría..."
            aria-label="Buscar por descripción o categoría"
            className="flex-1 bg-transparent text-sm text-paper placeholder:text-ink-400"
          />
        </div>

        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          aria-label="Filtrar por mes"
          className="select-native bg-ink-900/60 border border-ink-500 text-paper pl-3 pr-9 py-2 text-xs focus:border-amber cursor-pointer"
        >
          <option value="">Todos los meses</option>
          {months.map(m => <option key={m} value={m}>{formatMes(m)}</option>)}
        </select>

        <div className="flex border border-ink-500" role="group" aria-label="Filtrar por tipo">
          {(["todos", "ingreso", "egreso"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              aria-pressed={filterType === t}
              className={`px-3 py-2 text-[11px] uppercase tracking-wider transition-colors ${
                filterType === t ? "bg-amber text-ink-900" : "text-ink-200 hover:bg-ink-700/40"
              }`}
            >
              {t === "todos" ? "Todos" : t === "ingreso" ? "Ingresos" : "Gastos"}
            </button>
          ))}
        </div>

        {(search || filterMonth || filterType !== "todos") && (
          <button
            onClick={() => { setSearch(""); setFilterMonth(""); setFilterType("todos"); }}
            className="text-ink-300 hover:text-paper text-xs flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <div className="surface p-4">
          <div className="eyebrow text-moss-light mb-1">Ingresos</div>
          <div className="display text-2xl text-paper tabular">{formatPesos(totals.ingresos)}</div>
        </div>
        <div className="surface p-4">
          <div className="eyebrow text-terra-light mb-1">Gastos</div>
          <div className="display text-2xl text-paper tabular">{formatPesos(totals.egresos)}</div>
        </div>
        <div className="surface p-4">
          <div className="eyebrow text-amber mb-1">Balance</div>
          <div className={`display text-2xl tabular ${totals.balance >= 0 ? "text-moss-light" : "text-terra-light"}`}>
            {formatPesos(totals.balance)}
          </div>
          {totals.hayUSD && (
            <div className={`text-sm tabular font-mono mt-1 ${totals.usdBalance >= 0 ? "text-moss-light" : "text-terra-light"}`}>
              <UsdAmount value={totals.usdBalance} /> <span className="text-ink-400 text-[10px]">en dólares</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
        {/* Desktop Table */}
        <table className="hidden md:table w-full">
          <thead>
            <tr className="hairline-b">
              <th className="eyebrow text-left px-6 py-4">Pago</th>
              <th className="eyebrow text-left px-2 py-4">Consumo</th>
              <th className="eyebrow text-left px-2 py-4">Descripción</th>
              <th className="eyebrow text-left px-2 py-4">Categoría</th>
              <th className="eyebrow text-right px-2 py-4">Monto</th>
              <th className="eyebrow text-center px-2 py-4">Cuota</th>
              <th className="eyebrow text-right px-6 py-4 w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-ink-300 italic" role="status" aria-live="polite">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-ink-300 italic">Sin movimientos para los filtros seleccionados</td></tr>
            ) : visibleRows.map((tx) => (
              <tr
                key={tx.id}
                className="hairline-b last:border-0 hover:bg-ink-700/20 transition-colors group"
              >
                <td className="px-6 py-4 text-sm text-paper tabular font-mono">{formatFecha(tx.fechaPago)}</td>
                <td className="px-2 py-4 text-xs text-ink-300 tabular font-mono">
                  {tx.fechaConsumo !== tx.fechaPago ? formatFecha(tx.fechaConsumo) : "—"}
                </td>
                <td className="px-2 py-4">
                  <div className="text-sm text-paper">{tx.descripcion}</div>
                  {tx.notas && <div className="text-[10px] text-ink-400 mt-0.5">{tx.notas}</div>}
                </td>
                <td className="px-2 py-4">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: getCategoryColor(tx.categoria) }} />
                    <span className="text-xs text-ink-200">{tx.categoria}</span>
                  </div>
                </td>
                <td className="px-2 py-4 text-right">
                  <span className={`tabular font-mono text-sm ${tx.tipo === "ingreso" ? "text-moss-light" : "text-terra-light"}`}>
                    {tx.tipo === "ingreso" ? "+" : "-"}{tx.moneda === "USD" ? <UsdAmount value={tx.monto} /> : formatPesos(tx.monto)}
                  </span>
                  {tx.moneda === "USD" && (
                    <span className="ml-1.5 text-[9px] uppercase tracking-wider text-amber border border-amber/40 px-1 py-0.5">USD</span>
                  )}
                </td>
                <td className="px-2 py-4 text-center text-xs text-ink-300 tabular">
                  {tx.cuotaTotal > 1 ? `${tx.cuotaNumero}/${tx.cuotaTotal}` : "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(tx); setShowForm(true); }}
                      className="p-1.5 text-ink-300 hover:text-paper transition-colors"
                      aria-label={`Editar ${tx.descripcion}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1.5 text-ink-300 hover:text-terra-light transition-colors"
                      aria-label={`Eliminar ${tx.descripcion}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col divide-y divide-ink-600/60">
          {loading ? (
            <div className="text-center py-12 text-ink-300 italic" role="status" aria-live="polite">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-ink-300 italic">Sin movimientos</div>
          ) : visibleRows.map((tx) => (
            <div key={tx.id} className="p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-paper font-medium mb-1">{tx.descripcion}</div>
                  <div className="text-[10px] text-ink-400 tabular font-mono">Pago: {formatFecha(tx.fechaPago)}</div>
                </div>
                <div className="text-right">
                  <div className={`font-mono tabular text-sm ${tx.tipo === "ingreso" ? "text-moss-light" : "text-terra-light"}`}>
                    {tx.tipo === "ingreso" ? "+" : "-"}{tx.moneda === "USD" ? <UsdAmount value={tx.monto} /> : formatPesos(tx.monto)}
                    {tx.moneda === "USD" && <span className="ml-1 text-[9px] uppercase text-amber border border-amber/40 px-1 py-0.5">USD</span>}
                  </div>
                  {tx.cuotaTotal > 1 && (
                    <div className="text-[9px] text-ink-400 mt-1 uppercase tracking-wider">
                      Cuota {tx.cuotaNumero}/{tx.cuotaTotal}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: getCategoryColor(tx.categoria) }} />
                  <span className="text-[10px] uppercase tracking-wider text-ink-300">{tx.categoria}</span>
                </div>
                <div className="flex gap-2 -mr-3.5">
                  <button
                    onClick={() => { setEditing(tx); setShowForm(true); }}
                    className="text-ink-400 hover:text-paper p-3.5"
                    aria-label={`Editar ${tx.descripcion}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="text-ink-400 hover:text-terra-light p-3.5"
                    aria-label={`Eliminar ${tx.descripcion}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Pagination / Show more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="text-xs text-amber border border-amber/30 px-6 py-2 hover:bg-amber/5 transition-all"
          >
            Mostrar más ({filtered.length - visibleCount} restantes)
          </button>
        </div>
      )}
      <div className="mt-3 text-center text-[10px] text-ink-400">
        Mostrando {Math.min(visibleCount, filtered.length)} de {filtered.length} movimientos
      </div>
      <AnimatePresence>
        {showForm && (
          <TransactionForm
            editing={editing}
            config={config}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Form modal ───────────────────────────────────────────────────────────────

interface FormProps {
  editing: Transaction | null;
  config: AppConfig;
  onClose: () => void;
  onSaved: () => void;
}

function TransactionForm({ editing, config, onClose, onSaved }: FormProps) {
  const today = hoyLocal();

  const [tipo, setTipo] = useState<"ingreso" | "egreso">(editing?.tipo || "egreso");
  const [fechaConsumo, setFechaConsumo] = useState(editing?.fechaConsumo || today);
  const [fechaPago, setFechaPago] = useState(editing?.fechaPago || today);
  const [fechaPagoAuto, setFechaPagoAuto] = useState(!editing);
  const [descripcion, setDescripcion] = useState(editing?.descripcion || "");
  const [monto, setMonto] = useState(editing?.monto?.toString() || "");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(editing?.moneda || "ARS");
  const [categoria, setCategoria] = useState(editing?.categoria || "Otros");
  const [subcategoria, setSubcategoria] = useState(editing?.subcategoria || "Sin categoría");
  const [fuente, setFuente] = useState<"manual" | "tarjeta" | "recibo">(editing?.fuente || "manual");
  const [cuotaTotal, setCuotaTotal] = useState(editing?.cuotaTotal?.toString() || "1");
  const [cuotaNumero, setCuotaNumero] = useState(editing?.cuotaNumero?.toString() || "1");
  const [notas, setNotas] = useState(editing?.notas || "");
  const [origen, setOrigen] = useState<BucketOrigen>(editing?.origen ?? "regla");
  const [saving, setSaving] = useState(false);

  const ORIGENES: BucketOrigen[] = ["regla", "emergencia", "auto", "mud", "vac", "tec", "largo"];
  const subcategories = CATEGORIES.find(c => c.name === categoria)?.subcategories || ["Sin categoría"];

  // Cerrar con Escape: el modal solo se cerraba clickeando afuera o en Cancelar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-categorize on description change (only for new)
  useEffect(() => {
    if (!editing && descripcion.length > 3) {
      const auto = autoCategorizar(descripcion);
      setCategoria(auto.categoria);
      setSubcategoria(auto.subcategoria);
    }
  }, [descripcion, editing]);

  // Auto-calculate fechaPago when tarjeta + fechaConsumo
  useEffect(() => {
    if (fechaPagoAuto && fuente === "tarjeta" && tipo === "egreso") {
      setFechaPago(calcularFechaPagoTarjeta(fechaConsumo, config.cardCutoffDay, config.cardDueDay));
    } else if (fechaPagoAuto) {
      setFechaPago(fechaConsumo);
    }
  }, [fechaConsumo, fuente, tipo, fechaPagoAuto, config.cardCutoffDay, config.cardDueDay]);

  const handleSubmit = async () => {
    if (!descripcion || !monto) {
      toast.error("Completá descripción y monto");
      return;
    }
    setSaving(true);

    const payload = {
      ...(editing ? { id: editing.id, createdAt: editing.createdAt } : {}),
      tipo,
      fechaConsumo,
      fechaPago,
      descripcion,
      monto: parseFloat(monto),
      moneda,
      categoria,
      subcategoria,
      fuente,
      cuotaTotal: parseInt(cuotaTotal),
      cuotaNumero: parseInt(cuotaNumero),
      notas,
      origen,
    };

    const method = editing ? "PUT" : "POST";
    const r = await fetch("/api/transactions", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();

    if (d.ok || d.transaction) {
      toast.success(editing ? "Actualizada" : "Creada");
      onSaved();
    } else {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-ink-900/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
        className="surface-elevated w-full sm:max-w-2xl p-5 sm:p-8 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Editar movimiento" : "Nuevo movimiento"}
      >
        <div className="flex items-start justify-between mb-5 sm:mb-6">
          <div>
            <div className="eyebrow mb-1">{editing ? "Editar" : "Nueva"}</div>
            <h2 className="display text-2xl sm:text-3xl text-paper">
              {editing ? "Modificar movimiento" : "Nuevo movimiento"}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-paper p-3 -mr-3 -mt-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            {(["egreso", "ingreso"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`py-3 border text-sm transition-all ${
                  tipo === t
                    ? t === "ingreso" ? "border-moss bg-moss/10 text-moss-light" : "border-terra bg-terra/10 text-terra-light"
                    : "border-ink-500 text-ink-300 hover:border-ink-400"
                }`}
              >
                {t === "ingreso" ? "↑ Ingreso" : "↓ Gasto"}
              </button>
            ))}
          </div>

          {/* Descripcion */}
          <Field label="Descripción">
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Supermercado Coto"
              className="form-input"
              autoFocus
            />
          </Field>

          {/* Monto + Moneda (full width en mobile) */}
          <Field label={`Monto (${moneda})`}>
            <div className="flex">
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="form-input flex-1 tabular font-mono rounded-none text-lg sm:text-base"
              />
              <div className="flex border border-l-0 border-ink-500 shrink-0">
                {(["ARS", "USD"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoneda(m)}
                    aria-pressed={moneda === m}
                    className={`px-4 sm:px-3 py-3 text-xs font-mono transition-colors ${
                      moneda === m ? "bg-amber text-ink-900" : "text-ink-300 hover:bg-ink-700/40"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {/* Fuente (full width en mobile) */}
          <Field label="Fuente">
            <select value={fuente} onChange={(e) => setFuente(e.target.value as any)} className="form-input">
              <option value="manual">Manual / Efectivo</option>
              <option value="tarjeta">Tarjeta de crédito</option>
              <option value="recibo">Recibo de sueldo</option>
            </select>
          </Field>

          {moneda === "USD" && (
            <p className="text-[11px] text-ink-400 -mt-2 leading-relaxed">
              {tipo === "egreso"
                ? "Gasto en dólares: se descuenta de tu tenencia de USD y no afecta tu saldo en pesos."
                : "Ingreso en dólares: suma a tu tenencia de USD y no afecta tu saldo en pesos."}
            </p>
          )}

          {moneda === "USD" && tipo === "egreso" && (
            <Field label="Origen del gasto (ahorro)">
              <select value={origen} onChange={(e) => setOrigen(e.target.value as BucketOrigen)}
                className="form-input">
                {ORIGENES.map(o => <option key={o} value={o}>{ORIGEN_LABEL[o]}</option>)}
              </select>
              <p className="text-[10px] text-ink-400 mt-1">
                De qué bucket sale este gasto. &quot;Automático&quot; usa la regla (mediano → largo → piso);
                o elegí un sobre puntual (ej. usar solo los de Tecnología).
              </p>
            </Field>
          )}

          {/* Fechas — stacked en mobile, side by side en desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha de consumo">
              <input
                type="date"
                value={fechaConsumo}
                onChange={(e) => setFechaConsumo(e.target.value)}
                className="form-input tabular"
              />
            </Field>
            <Field label={
              <span className="flex items-center gap-2">
                Fecha de pago real
                <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fechaPagoAuto}
                    onChange={(e) => setFechaPagoAuto(e.target.checked)}
                    className="accent-amber"
                  />
                  <span>Auto</span>
                </label>
              </span>
            }>
              <input
                type="date"
                value={fechaPago}
                onChange={(e) => { setFechaPago(e.target.value); setFechaPagoAuto(false); }}
                disabled={fechaPagoAuto}
                className="form-input tabular disabled:opacity-60"
              />
            </Field>
          </div>

          {/* Categoría — stacked en mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Categoría">
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="form-input">
                {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategoría">
              <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className="form-input">
                {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Cuotas */}
          {fuente === "tarjeta" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cuotas totales">
                <input type="number" min={1} value={cuotaTotal}
                  onChange={(e) => setCuotaTotal(e.target.value)}
                  className="form-input tabular font-mono" />
              </Field>
              <Field label="Cuota número">
                <input type="number" min={1} value={cuotaNumero}
                  onChange={(e) => setCuotaNumero(e.target.value)}
                  className="form-input tabular font-mono" />
              </Field>
            </div>
          )}

          {/* Notas */}
          <Field label="Notas (opcional)">
            <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Detalle adicional..."
              className="form-input" />
          </Field>
        </div>

        {/* Botones — full width en mobile */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 sm:mt-8 pt-5 sm:pt-6 hairline-t">
          <button onClick={onClose}
            className="px-5 py-3 sm:py-2.5 text-sm text-ink-300 hover:text-paper transition-colors text-center">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-3 sm:py-2.5 bg-amber text-ink-900 text-sm font-medium hover:bg-amber-light disabled:opacity-50 transition-all"
          >
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
          padding: 12px 14px;
          font-size: 16px;
          outline: none;
          transition: border-color 0.2s;
          -webkit-appearance: none;
          border-radius: 0;
        }
        @media (min-width: 640px) {
          .form-input {
            padding: 10px 14px;
            font-size: 14px;
          }
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
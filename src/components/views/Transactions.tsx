"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Edit2, Trash2, X, Filter } from "lucide-react";
import { toast } from "sonner";
import type { Transaction, AppConfig } from "@/types";
import { formatPesos, formatFecha, fechaToMes, formatMes, uniqueMonths, calcularFechaPagoTarjeta } from "@/lib/utils";
import { CATEGORIES, autoCategorizar, getCategoryColor } from "@/lib/categories";
import { useTransactions } from "@/components/DataProvider";

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
    const i = filtered.filter(t => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0);
    const e = filtered.filter(t => t.tipo === "egreso").reduce((s, t) => s + t.monto, 0);
    return { ingresos: i, egresos: e, balance: i - e };
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
            className="flex-1 bg-transparent text-sm text-paper outline-none placeholder:text-ink-400"
          />
        </div>

        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-ink-900/60 border border-ink-500 text-paper px-3 py-2 text-xs focus:border-amber outline-none cursor-pointer"
        >
          <option value="">Todos los meses</option>
          {months.map(m => <option key={m} value={m}>{formatMes(m)}</option>)}
        </select>

        <div className="flex border border-ink-500">
          {(["todos", "ingreso", "egreso"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
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
        </div>
      </div>

      {/* Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
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
              <tr><td colSpan={7} className="text-center py-12 text-ink-300 italic">Cargando...</td></tr>
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
                    {tx.tipo === "ingreso" ? "+" : "-"}{formatPesos(tx.monto)}
                  </span>
                </td>
                <td className="px-2 py-4 text-center text-xs text-ink-300 tabular">
                  {tx.cuotaTotal > 1 ? `${tx.cuotaNumero}/${tx.cuotaTotal}` : "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(tx); setShowForm(true); }}
                      className="p-1.5 text-ink-300 hover:text-paper transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1.5 text-ink-300 hover:text-terra-light transition-colors"
                    >
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
  const today = new Date().toISOString().slice(0, 10);

  const [tipo, setTipo] = useState<"ingreso" | "egreso">(editing?.tipo || "egreso");
  const [fechaConsumo, setFechaConsumo] = useState(editing?.fechaConsumo || today);
  const [fechaPago, setFechaPago] = useState(editing?.fechaPago || today);
  const [fechaPagoAuto, setFechaPagoAuto] = useState(!editing);
  const [descripcion, setDescripcion] = useState(editing?.descripcion || "");
  const [monto, setMonto] = useState(editing?.monto?.toString() || "");
  const [categoria, setCategoria] = useState(editing?.categoria || "Otros");
  const [subcategoria, setSubcategoria] = useState(editing?.subcategoria || "Sin categoría");
  const [fuente, setFuente] = useState<"manual" | "tarjeta" | "recibo">(editing?.fuente || "manual");
  const [cuotaTotal, setCuotaTotal] = useState(editing?.cuotaTotal?.toString() || "1");
  const [cuotaNumero, setCuotaNumero] = useState(editing?.cuotaNumero?.toString() || "1");
  const [notas, setNotas] = useState(editing?.notas || "");
  const [saving, setSaving] = useState(false);

  const subcategories = CATEGORIES.find(c => c.name === categoria)?.subcategories || ["Sin categoría"];

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
      moneda: "ARS",
      categoria,
      subcategoria,
      fuente,
      cuotaTotal: parseInt(cuotaTotal),
      cuotaNumero: parseInt(cuotaNumero),
      notas,
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
      className="fixed inset-0 bg-ink-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.25 }}
        className="surface-elevated w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">{editing ? "Editar" : "Nueva"}</div>
            <h2 className="display text-3xl text-paper">
              {editing ? "Modificar movimiento" : "Nuevo movimiento"}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-paper p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            {(["egreso", "ingreso"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
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

          {/* Monto + Fuente */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monto (ARS)">
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="form-input tabular font-mono"
              />
            </Field>
            <Field label="Fuente">
              <select value={fuente} onChange={(e) => setFuente(e.target.value as any)} className="form-input">
                <option value="manual">Manual / Efectivo</option>
                <option value="tarjeta">Tarjeta de crédito</option>
                <option value="recibo">Recibo de sueldo</option>
              </select>
            </Field>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* Categoría */}
          <div className="grid grid-cols-2 gap-4">
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

        <div className="flex justify-end gap-3 mt-8 pt-6 hairline-t">
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm text-ink-300 hover:text-paper transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-amber text-ink-900 text-sm font-medium hover:bg-amber-light disabled:opacity-50 transition-all"
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
          padding: 10px 14px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus {
          border-color: #C9A24B;
        }
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

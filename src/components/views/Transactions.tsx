"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Search, Edit2, Trash2, X, Copy, Download, ListChecks } from "lucide-react";
import { toast } from "sonner";
import type { Transaction, AppConfig, BucketOrigen, TransactionSource } from "@/types";
import { formatPesos, formatFecha, fechaToMes, formatMes, uniqueMonths, calcularFechaPagoTarjeta, hoyLocal } from "@/lib/utils";
import { ORIGEN_LABEL } from "@/lib/ahorro-calc";
import { CATEGORIES, autoCategorizar, getCategoryColor } from "@/lib/categories";
import { useTransactions } from "@/components/DataProvider";
import { UsdAmount } from "@/components/UsdAmount";
import LogoLoader from "@/components/LogoLoader";
import { ErrorState, StaleDataBanner } from "@/components/ui/States";
import AnimatedNumber, { AnimatedUsdAmount } from "@/components/AnimatedNumber";
import { transactionsApi, ApiError, errorMessage, type TransactionPayload } from "@/lib/api";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Field, focusFirstInvalid } from "@/components/ui/Field";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/States";
import { useSearchParams, useRouter } from "next/navigation";
import { transactionsToCsv, descargarArchivo } from "@/lib/csv";
import { esSueldo, type DatosRecibo } from "@/lib/sueldos";
import { sueldosApi } from "@/lib/api";
import useSWR from "swr";

interface Props { config: AppConfig; }

export default function Transactions({ config }: Props) {
  const { transactions, isLoading: loading, error, refresh } = useTransactions();
  const [filterMonth, setFilterMonth] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterFuente, setFilterFuente] = useState<"" | TransactionSource>("");
  const [filterMoneda, setFilterMoneda] = useState<"todas" | "ARS" | "USD">("todas");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [prefill, setPrefill] = useState<Transaction | null>(null);
  // Selección múltiple para recategorizar en lote
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const [visibleCount, setVisibleCount] = useState(50);
  const { confirmar, dialog: confirmDialog } = useConfirm();

  // `/transactions?nuevo=1` abre el alta directo (lo usan los estados vacíos de otras vistas).
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("nuevo") === "1") {
      setEditing(null);
      setShowForm(true);
      router.replace("/transactions");
    }
  }, [searchParams, router]);

  const openNew = () => { setEditing(null); setPrefill(null); setShowForm(true); };
  const openEdit = (tx: Transaction) => { setEditing(tx); setPrefill(null); setShowForm(true); };
  const openDuplicate = (tx: Transaction) => { setEditing(null); setPrefill(tx); setShowForm(true); };
  const hasFilters = Boolean(search || filterMonth || filterType !== "todos" || filterCategoria || filterFuente || filterMoneda !== "todas");
  const clearFilters = () => {
    setSearch(""); setFilterMonth(""); setFilterType("todos");
    setFilterCategoria(""); setFilterFuente(""); setFilterMoneda("todas");
  };
  const months = useMemo(() => uniqueMonths(transactions), [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterMonth && fechaToMes(t.fechaPago) !== filterMonth) return false;
      if (filterType !== "todos" && t.tipo !== filterType) return false;
      if (filterCategoria && t.categoria !== filterCategoria) return false;
      if (filterFuente && t.fuente !== filterFuente) return false;
      if (filterMoneda !== "todas" && (t.moneda || "ARS") !== filterMoneda) return false;
      if (search) {
        const s = search.toLowerCase();
        const campos = [t.descripcion, t.categoria, t.subcategoria, t.notas];
        if (!campos.some(c => c?.toLowerCase().includes(s))) return false;
      }
      return true;
    }).sort((a, b) => b.fechaPago.localeCompare(a.fechaPago));
  }, [transactions, filterMonth, filterType, filterCategoria, filterFuente, filterMoneda, search]);

  const toggleSelected = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };

  const exportCsv = () => {
    const sufijo = filterMonth || hoyLocal();
    descargarArchivo(`movimientos-${sufijo}.csv`, transactionsToCsv(filtered));
    toast.success(`${filtered.length} movimiento${filtered.length === 1 ? "" : "s"} exportado${filtered.length === 1 ? "" : "s"}`);
  };

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

  const handleDelete = async (tx: Transaction) => {
    // Cuotas siguientes de la misma compra (generadas juntas)
    const siguientes = tx.grupoCuotas
      ? transactions.filter(t => t.grupoCuotas === tx.grupoCuotas && t.cuotaNumero > tx.cuotaNumero).length
      : 0;
    const { ok, opcion } = await confirmar({
      title: "Eliminar movimiento",
      description: (
        <>
          Vas a eliminar <strong className="text-paper">{tx.descripcion}</strong> (
          {tx.moneda === "USD" ? <UsdAmount value={tx.monto} /> : formatPesos(tx.monto)}
          {tx.cuotaTotal > 1 ? `, cuota ${tx.cuotaNumero}/${tx.cuotaTotal}` : ""}). No se puede deshacer.
        </>
      ),
      ...(siguientes > 0
        ? { opcion: { label: `Eliminar también las ${siguientes} cuota${siguientes === 1 ? "" : "s"} siguiente${siguientes === 1 ? "" : "s"}`, marcada: true } }
        : {}),
    });
    if (!ok) return;
    try {
      const r = await transactionsApi.remove(tx.id, siguientes > 0 && opcion);
      toast.success(r.borrados > 1 ? `"${tx.descripcion}" eliminado (${r.borrados} cuotas)` : `"${tx.descripcion}" eliminado`);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo eliminar el movimiento"), { duration: 7000 });
    }
  };

  if (loading) return <LogoLoader className="min-h-[70vh]" />;
  if (error && transactions.length === 0) {
    return <ErrorState message={error} onRetry={refresh} className="min-h-[70vh]" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
      {error && <StaleDataBanner message={error} onRetry={refresh} />}
      <header className="mb-10 flex items-end justify-between">
        <div>
          <div className="eyebrow mb-2">Movimientos</div>
          <h1 className="display text-3xl sm:text-5xl text-paper">
            Cada <em className="italic">peso</em>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secundario" onClick={exportCsv} disabled={filtered.length === 0} aria-label="Exportar a CSV lo filtrado">
            <Download className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button variant="secundario" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting}>
            <ListChecks className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{selecting ? "Listo" : "Seleccionar"}</span>
            <span className="sr-only sm:hidden">{selecting ? "Terminar selección" : "Seleccionar varios"}</span>
          </Button>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nuevo
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="surface p-3 sm:p-5 mb-4 sm:mb-6 flex flex-wrap gap-3 sm:gap-4 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-300" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descripción o categoría…"
            aria-label="Buscar por descripción o categoría"
            className="min-h-11 flex-1 bg-transparent text-sm text-paper placeholder:text-ink-400"
          />
        </div>

        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          aria-label="Filtrar por mes"
          className="select-native min-h-11 bg-ink-900/60 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
        >
          <option value="">Todos los meses</option>
          {months.map(m => <option key={m} value={m}>{formatMes(m)}</option>)}
        </select>

        <Segmented
          label="Filtrar por tipo"
          size="sm"
          className="w-auto"
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: "todos", label: "Todos" },
            { value: "ingreso", label: "Ingresos" },
            { value: "egreso", label: "Gastos" },
          ]}
        />

        <select
          value={filterCategoria}
          onChange={(e) => setFilterCategoria(e.target.value)}
          aria-label="Filtrar por categoría"
          className="select-native min-h-11 bg-ink-900/60 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>

        <select
          value={filterFuente}
          onChange={(e) => setFilterFuente(e.target.value as "" | TransactionSource)}
          aria-label="Filtrar por fuente"
          className="select-native min-h-11 bg-ink-900/60 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
        >
          <option value="">Todas las fuentes</option>
          <option value="manual">Manual / Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="recibo">Recibo de sueldo</option>
        </select>

        <Segmented
          label="Filtrar por moneda"
          size="sm"
          className="w-auto"
          value={filterMoneda}
          onChange={setFilterMoneda}
          options={[
            { value: "todas", label: "Todas" },
            { value: "ARS", label: "ARS" },
            { value: "USD", label: "USD" },
          ]}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 text-ink-300 hover:text-paper text-sm flex items-center gap-1"
          >
            <X className="w-4 h-4" aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6">
        <div className="surface p-4 sm:p-6">
          <div className="eyebrow text-moss-light mb-1 sm:mb-2">Ingresos</div>
          <div className="display text-2xl sm:text-3xl lg:text-4xl text-paper tabular leading-none">
            <AnimatedNumber value={totals.ingresos} format={formatPesos} />
          </div>
        </div>
        <div className="surface p-4 sm:p-6">
          <div className="eyebrow text-terra-light mb-1 sm:mb-2">Gastos</div>
          <div className="display text-2xl sm:text-3xl lg:text-4xl text-paper tabular leading-none">
            <AnimatedNumber value={totals.egresos} format={formatPesos} />
          </div>
        </div>
        <div className="surface p-4 sm:p-6">
          <div className="eyebrow mb-1 sm:mb-2">Balance</div>
          <div className={`display text-2xl sm:text-3xl lg:text-4xl tabular leading-none ${totals.balance >= 0 ? "text-moss-light" : "text-terra-light"}`}>
            <AnimatedNumber value={totals.balance} format={formatPesos} />
          </div>
          {totals.hayUSD && (
            <div className={`text-sm tabular font-mono mt-2 ${totals.usdBalance >= 0 ? "text-moss-light" : "text-terra-light"}`}>
              <AnimatedUsdAmount value={totals.usdBalance} /> <span className="text-ink-300 text-xs">en dólares</span>
            </div>
          )}
        </div>
      </div>

      {selecting && (
        <RecategorizarBar
          ids={Array.from(selected)}
          onDone={() => { stopSelecting(); refresh(); }}
        />
      )}

      {/* Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
        {/* Desktop Table */}
        <table className="hidden md:table w-full">
          <caption className="sr-only">Movimientos</caption>
          <thead>
            <tr className="hairline-b">
              {selecting && (
                <th scope="col" className="pl-6 py-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los filtrados"
                    checked={filtered.length > 0 && filtered.every(t => selected.has(t.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map(t => t.id)) : new Set())}
                    className="w-4 h-4 accent-paper"
                  />
                </th>
              )}
              <th scope="col" className="eyebrow text-left px-6 py-4">Pago</th>
              <th scope="col" className="eyebrow text-left px-2 py-4">Consumo</th>
              <th scope="col" className="eyebrow text-left px-2 py-4">Descripción</th>
              <th scope="col" className="eyebrow text-left px-2 py-4">Categoría</th>
              <th scope="col" className="eyebrow text-right px-2 py-4">Monto</th>
              <th scope="col" className="eyebrow text-center px-2 py-4">Cuota</th>
              <th scope="col" className="eyebrow text-right px-6 py-4 w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={selecting ? 8 : 7}>
                <ListEmpty hasFilters={hasFilters} onClear={clearFilters} onNew={openNew} />
              </td></tr>
            ) : visibleRows.map((tx) => (
              <tr
                key={tx.id}
                className="hairline-b last:border-0 hover:bg-ink-700/20 transition-colors group"
              >
                {selecting && (
                  <td className="pl-6 py-4">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${tx.descripcion}`}
                      checked={selected.has(tx.id)}
                      onChange={() => toggleSelected(tx.id)}
                      className="w-4 h-4 accent-paper"
                    />
                  </td>
                )}
                <td className="px-6 py-4 text-sm text-paper tabular font-mono">{formatFecha(tx.fechaPago)}</td>
                <td className="px-2 py-4 text-xs text-ink-300 tabular font-mono">
                  {tx.fechaConsumo !== tx.fechaPago ? formatFecha(tx.fechaConsumo) : "—"}
                </td>
                <td className="px-2 py-4">
                  <div className="text-sm text-paper">{tx.descripcion}</div>
                  {tx.notas && <div className="text-xs text-ink-300 mt-0.5">{tx.notas}</div>}
                </td>
                <td className="px-2 py-4">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: getCategoryColor(tx.categoria) }} />
                    <span className="text-xs text-ink-200">{tx.categoria}</span>
                  </div>
                </td>
                <td className="px-2 py-4 text-right">
                  <Monto tx={tx} />
                </td>
                <td className="px-2 py-4 text-center text-xs text-ink-300 tabular">
                  {tx.cuotaTotal > 1 ? `${tx.cuotaNumero}/${tx.cuotaTotal}` : "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => openDuplicate(tx)}
                      className="p-2.5 text-ink-300 hover:text-paper transition-colors"
                      aria-label={`Duplicar ${tx.descripcion}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(tx)}
                      className="p-2.5 text-ink-300 hover:text-paper transition-colors"
                      aria-label={`Editar ${tx.descripcion}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx)}
                      className="p-2.5 text-ink-300 hover:text-terra-light transition-colors"
                      aria-label={`Eliminar ${tx.descripcion}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col divide-y divide-ink-600/60">
          {filtered.length === 0 ? (
            <ListEmpty hasFilters={hasFilters} onClear={clearFilters} onNew={openNew} />
          ) : visibleRows.map((tx) => (
            <div key={tx.id} className="p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start gap-3">
                {selecting && (
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${tx.descripcion}`}
                    checked={selected.has(tx.id)}
                    onChange={() => toggleSelected(tx.id)}
                    className="w-5 h-5 mt-0.5 shrink-0 accent-paper"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-paper font-medium mb-1">{tx.descripcion}</div>
                  <div className="text-xs text-ink-300 tabular font-mono">Pago: {formatFecha(tx.fechaPago)}</div>
                </div>
                <div className="text-right">
                  <Monto tx={tx} />
                  {tx.cuotaTotal > 1 && (
                    <div className="text-xs text-ink-300 mt-1">
                      Cuota {tx.cuotaNumero}/{tx.cuotaTotal}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: getCategoryColor(tx.categoria) }} />
                  <span className="text-xs text-ink-300">{tx.categoria}</span>
                </div>
                <div className="flex gap-2 -mr-3.5">
                  <button
                    onClick={() => openDuplicate(tx)}
                    className="text-ink-300 hover:text-paper p-3.5"
                    aria-label={`Duplicar ${tx.descripcion}`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(tx)}
                    className="text-ink-300 hover:text-paper p-3.5"
                    aria-label={`Editar ${tx.descripcion}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tx)}
                    className="text-ink-300 hover:text-terra-light p-3.5"
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
            type="button"
            onClick={() => setVisibleCount(prev => prev + 50)}
            className={buttonClasses("secundario")}
          >
            Mostrar más ({filtered.length - visibleCount} restantes)
          </button>
        </div>
      )}
      <div className="mt-3 text-center text-xs text-ink-300">
        Mostrando {Math.min(visibleCount, filtered.length)} de {filtered.length} movimientos
      </div>
      <TransactionForm
        open={showForm}
        editing={editing}
        prefill={prefill}
        config={config}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); refresh(); }}
      />
      {confirmDialog}
    </div>
  );
}

// ── Piezas de la lista ───────────────────────────────────────────────────────

/** Barra de selección múltiple: cambia la categoría de todos los elegidos. */
function RecategorizarBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [categoria, setCategoria] = useState(CATEGORIES[0].name);
  const subs = CATEGORIES.find(c => c.name === categoria)?.subcategories ?? ["Sin categoría"];
  const [subcategoria, setSubcategoria] = useState(subs[0]);
  const [saving, setSaving] = useState(false);

  const aplicar = async () => {
    setSaving(true);
    try {
      const r = await transactionsApi.recategorize(ids, categoria, subcategoria);
      toast.success(`${r.updated} movimiento${r.updated === 1 ? "" : "s"} pasado${r.updated === 1 ? "" : "s"} a ${categoria}`);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo cambiar la categoría"), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface p-3 sm:p-4 mb-4 flex flex-wrap items-center gap-3" role="region" aria-label="Acciones sobre la selección">
      <span className="text-sm text-paper tabular" aria-live="polite">
        {ids.length} seleccionado{ids.length === 1 ? "" : "s"}
      </span>
      <select
        value={categoria}
        onChange={(e) => {
          setCategoria(e.target.value);
          setSubcategoria(CATEGORIES.find(c => c.name === e.target.value)?.subcategories[0] ?? "Sin categoría");
        }}
        aria-label="Nueva categoría"
        className="select-native min-h-11 bg-ink-900/60 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
      >
        {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
      <select
        value={subcategoria}
        onChange={(e) => setSubcategoria(e.target.value)}
        aria-label="Nueva subcategoría"
        className="select-native min-h-11 bg-ink-900/60 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
      >
        {subs.map(sc => <option key={sc} value={sc}>{sc}</option>)}
      </select>
      <Button variant="secundario" onClick={aplicar} isLoading={saving} disabled={ids.length === 0}>
        Cambiar categoría
      </Button>
    </div>
  );
}

/** Monto con signo: verde si entra (ingreso), rojo si sale (gasto). */
function Monto({ tx }: { tx: Transaction }) {
  const esIngreso = tx.tipo === "ingreso";
  return (
    <span className={`tabular font-mono text-sm whitespace-nowrap ${esIngreso ? "text-moss-light" : "text-terra-light"}`}>
      <span className="sr-only">{esIngreso ? "Ingreso de " : "Gasto de "}</span>
      <span aria-hidden="true">{esIngreso ? "+" : "−"}</span>
      {tx.moneda === "USD" ? <UsdAmount value={tx.monto} /> : formatPesos(tx.monto)}
    </span>
  );
}

function ListEmpty({ hasFilters, onClear, onNew }: { hasFilters: boolean; onClear: () => void; onNew: () => void }) {
  return hasFilters ? (
    <EmptyState message="Sin movimientos para los filtros elegidos" action={{ label: "Limpiar filtros", onClick: onClear }} />
  ) : (
    <EmptyState message="Todavía no cargaste movimientos" action={{ label: "Cargar el primero", onClick: onNew }} />
  );
}

// ── Form modal ───────────────────────────────────────────────────────────────

interface FormProps {
  open: boolean;
  editing: Transaction | null;
  /** Al duplicar: datos para precargar un alta nueva (no se edita el original). */
  prefill?: Transaction | null;
  config: AppConfig;
  onClose: () => void;
  onSaved: () => void;
}

type Errors = Partial<Record<string, string>>;

const ORIGENES: BucketOrigen[] = ["regla", "emergencia", "auto", "mud", "vac", "tec", "largo"];

function TransactionForm({ open, editing, prefill, config, onClose, onSaved }: FormProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={editing ? "Editar" : "Nuevo"}
      title={editing ? "Modificar movimiento" : "Nuevo movimiento"}
      size="lg"
    >
      {/* key: cada apertura arranca con el estado del registro elegido */}
      <TransactionFormBody
        key={editing?.id ?? (prefill ? `dup-${prefill.id}` : "nuevo")}
        editing={editing} prefill={prefill} config={config} onClose={onClose} onSaved={onSaved}
      />
    </Dialog>
  );
}

function TransactionFormBody({ editing, prefill, config, onClose, onSaved }: Omit<FormProps, "open">) {
  const today = hoyLocal();
  // Valores iniciales: el registro que se edita, o el que se duplica (con fecha de hoy)
  const base = editing ?? (prefill ? { ...prefill, fechaConsumo: today, fechaPago: today } : null);
  const formRef = useRef<HTMLFormElement>(null);

  const [tipo, setTipo] = useState<"ingreso" | "egreso">(base?.tipo || "egreso");
  const [fechaConsumo, setFechaConsumo] = useState(base?.fechaConsumo || today);
  const [fechaPago, setFechaPago] = useState(base?.fechaPago || today);
  const [fechaPagoAuto, setFechaPagoAuto] = useState(!editing);
  const [descripcion, setDescripcion] = useState(base?.descripcion || "");
  const [monto, setMonto] = useState(base?.monto?.toString() || "");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(base?.moneda || "ARS");
  const [categoria, setCategoria] = useState(base?.categoria || "Otros");
  const [subcategoria, setSubcategoria] = useState(base?.subcategoria || "Sin categoría");
  const [fuente, setFuente] = useState<TransactionSource>(base?.fuente || "manual");
  const [cuotaTotal, setCuotaTotal] = useState(base?.cuotaTotal?.toString() || "1");
  const [cuotaNumero, setCuotaNumero] = useState(base?.cuotaNumero?.toString() || "1");
  const [notas, setNotas] = useState(base?.notas || "");
  const [origen, setOrigen] = useState<BucketOrigen>(base?.origen ?? "regla");
  const [asigMediano, setAsigMediano] = useState(base?.asigMediano ? String(base.asigMediano) : "");
  const [asigLargo, setAsigLargo] = useState(base?.asigLargo ? String(base.asigLargo) : "");
  // Cuotas: al dar de alta, crear las que faltan; al editar, aplicar a las siguientes
  const [crearCuotas, setCrearCuotas] = useState(true);
  const [aplicarAGrupo, setAplicarAGrupo] = useState(false);
  // Sueldo: datos opcionales del recibo (van a la hoja Sueldos)
  const [recibo, setRecibo] = useState<Record<keyof DatosRecibo, string>>({
    empresa: "", cargo: "", periodoTrabajado: "", bruto: "", jubilacion: "", obraSocial: "", ley19032: "", otrosDescuentos: "",
  });
  const setReciboCampo = (k: keyof DatosRecibo, v: string) => setRecibo(prev => ({ ...prev, [k]: v }));
  const esSueldoForm = esSueldo({ tipo, categoria, subcategoria, moneda });

  // Al editar un sueldo, se traen los datos del recibo que ya estaban
  const sueldos = useSWR(editing && esSueldo(editing) ? "/api/sueldos" : null, () => sueldosApi.list(), { revalidateOnFocus: false });
  const reciboCargado = useRef(false);
  useEffect(() => {
    const previo = sueldos.data?.sueldos.find(sd => sd.txId === editing?.id);
    if (!previo || reciboCargado.current) return;
    reciboCargado.current = true;
    const n = (v: number) => (v ? String(v) : "");
    setRecibo({
      empresa: previo.empresa, cargo: previo.cargo, periodoTrabajado: previo.periodoTrabajado,
      bruto: n(previo.bruto), jubilacion: n(previo.jubilacion), obraSocial: n(previo.obraSocial),
      ley19032: n(previo.ley19032), otrosDescuentos: n(previo.otrosDescuentos),
    });
  }, [sueldos.data, editing?.id]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const subcategories = CATEGORIES.find(c => c.name === categoria)?.subcategories || ["Sin categoría"];

  /** Editar un campo limpia su error. */
  const clear = (field: string) => setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));

  // Auto-categorize on description change (only for new)
  useEffect(() => {
    // Al duplicar no se pisa la categoría elegida mientras no cambie la descripción
    if (!editing && descripcion.length > 3 && descripcion !== prefill?.descripcion) {
      const auto = autoCategorizar(descripcion);
      setCategoria(auto.categoria);
      setSubcategoria(auto.subcategoria);
    }
  }, [descripcion, editing, prefill?.descripcion]);

  // Auto-calculate fechaPago when tarjeta + fechaConsumo
  useEffect(() => {
    if (fechaPagoAuto && fuente === "tarjeta" && tipo === "egreso") {
      setFechaPago(calcularFechaPagoTarjeta(fechaConsumo, config.cardCutoffDay, config.cardDueDay));
    } else if (fechaPagoAuto) {
      setFechaPago(fechaConsumo);
    }
  }, [fechaConsumo, fuente, tipo, fechaPagoAuto, config.cardCutoffDay, config.cardDueDay]);

  // Reparto del ahorro: sólo para ingresos en USD
  const esIngresoUSD = moneda === "USD" && tipo === "ingreso";
  const montoNum = parseFloat(monto) || 0;
  const asignado = (parseFloat(asigMediano) || 0) + (parseFloat(asigLargo) || 0);
  const sinAsignar = Math.round((montoNum - asignado) * 100) / 100;

  /** Obligatorios y formato, antes de ir al servidor (que valida lo mismo). */
  const validate = (): Errors => {
    const e: Errors = {};
    if (descripcion.trim().length < 2) e.descripcion = "Poné una descripción (mínimo 2 caracteres)";
    const n = parseFloat(monto);
    if (!monto) e.monto = "Poné el monto";
    else if (!(n > 0)) e.monto = "El monto tiene que ser mayor a 0";
    if (!fechaConsumo) e.fechaConsumo = "Indicá la fecha de consumo";
    if (!fechaPago) e.fechaPago = "Indicá la fecha de pago";
    if (fuente === "tarjeta") {
      const tot = parseInt(cuotaTotal, 10), num = parseInt(cuotaNumero, 10);
      if (!(tot >= 1)) e.cuotaTotal = "Mínimo 1 cuota";
      if (!(num >= 1)) e.cuotaNumero = "La cuota empieza en 1";
      else if (tot >= 1 && num > tot) e.cuotaNumero = "No puede superar el total de cuotas";
    }
    if (esIngresoUSD && montoNum > 0 && sinAsignar < -0.005) {
      e.asigMediano = `Asignaste US$ ${Math.abs(sinAsignar).toLocaleString("es-AR")} de más respecto del monto del ingreso`;
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

    const esTarjeta = fuente === "tarjeta";
    const payload: TransactionPayload = {
      ...(editing ? { id: editing.id, createdAt: editing.createdAt } : {}),
      tipo,
      fechaConsumo,
      fechaPago,
      descripcion: descripcion.trim(),
      monto: parseFloat(monto),
      moneda,
      categoria,
      subcategoria,
      fuente,
      cuotaTotal: esTarjeta ? parseInt(cuotaTotal, 10) : 1,
      cuotaNumero: esTarjeta ? parseInt(cuotaNumero, 10) : 1,
      notas,
      origen,
      ...(esIngresoUSD ? { asigMediano: parseFloat(asigMediano) || 0, asigLargo: parseFloat(asigLargo) || 0 } : {}),
      ...(editing?.grupoCuotas ? { grupoCuotas: editing.grupoCuotas, aplicarAGrupo } : {}),
      ...(!editing && esTarjeta ? { crearCuotas } : {}),
      ...(esSueldoForm ? { recibo: reciboPayload(recibo) } : {}),
    };

    try {
      if (editing) {
        const r = await transactionsApi.update({ ...payload, id: editing.id });
        toast.success(r.actualizados > 1
          ? `"${payload.descripcion}" actualizado en ${r.actualizados} cuotas`
          : `"${payload.descripcion}" actualizado`);
      } else {
        const r = await transactionsApi.create(payload);
        toast.success(r.creados > 1
          ? `"${payload.descripcion}" guardado con ${r.creados} cuotas`
          : `"${payload.descripcion}" guardado`);
      }
      onSaved();
    } catch (e) {
      // El error del servidor marca su campo; si no tiene campo, va al aviso.
      if (e instanceof ApiError && e.field) {
        setErrors({ [e.field]: e.message });
        focusFirstInvalid(formRef.current);
      } else {
        toast.error(errorMessage(e, "No se pudo guardar el movimiento"), { duration: 7000 });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <div className="space-y-4 sm:space-y-5">
        {/* Tipo */}
        <Segmented
          label="Tipo de movimiento"
          value={tipo}
          onChange={setTipo}
          options={[
            { value: "egreso", label: "↓ Gasto", tone: "negativo" },
            { value: "ingreso", label: "↑ Ingreso", tone: "positivo" },
          ]}
        />

        <Field label="Descripción" required error={errors.descripcion}>
          {(c) => (
            <input
              {...c}
              type="text"
              value={descripcion}
              onChange={(e) => { setDescripcion(e.target.value); clear("descripcion"); }}
              placeholder="Ej: Supermercado Coto"
              maxLength={100}
              className="form-input"
              data-autofocus
            />
          )}
        </Field>

        {/* Monto + Moneda */}
        <Field label={`Monto (${moneda})`} required error={errors.monto}>
          {(c) => (
            <div className="flex">
              <input
                {...c}
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => { setMonto(e.target.value); clear("monto"); clear("asigMediano"); }}
                placeholder="0,00"
                inputMode="decimal"
                className="form-input flex-1 tabular font-mono text-lg sm:text-base"
              />
              <Segmented
                label="Moneda"
                value={moneda}
                onChange={setMoneda}
                attached
                options={[{ value: "ARS", label: "ARS" }, { value: "USD", label: "USD" }]}
              />
            </div>
          )}
        </Field>

        <Field label="Fuente">
          {(c) => (
            <select {...c} value={fuente} onChange={(e) => setFuente(e.target.value as TransactionSource)} className="form-input">
              <option value="manual">Manual / Efectivo</option>
              <option value="tarjeta">Tarjeta de crédito</option>
              <option value="recibo">Recibo de sueldo</option>
            </select>
          )}
        </Field>

        {moneda === "USD" && (
          <p className="-mt-2 text-xs leading-relaxed text-ink-300">
            {tipo === "egreso"
              ? "Gasto en dólares: se descuenta de tu tenencia de USD y no afecta tu saldo en pesos."
              : "Ingreso en dólares: suma a tu tenencia de USD y no afecta tu saldo en pesos."}
          </p>
        )}

        {moneda === "USD" && tipo === "egreso" && (
          <Field
            label="Origen del gasto (ahorro)"
            hint={<>De qué bucket sale este gasto. &quot;Automático&quot; usa la regla (mediano → largo → piso); o elegí un sobre puntual.</>}
          >
            {(c) => (
              <select {...c} value={origen} onChange={(e) => setOrigen(e.target.value as BucketOrigen)} className="form-input">
                {ORIGENES.map(o => <option key={o} value={o}>{ORIGEN_LABEL[o]}</option>)}
              </select>
            )}
          </Field>
        )}

        {esIngresoUSD && (
          <fieldset className="surface p-4 space-y-3">
            <legend className="eyebrow px-1">Destino del ahorro</legend>
            <p className="text-xs text-ink-300 leading-relaxed">
              El piso de emergencia se completa primero de forma automática. Repartí el resto de este ingreso
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
            {montoNum > 0 && sinAsignar > 0.005 && (
              <p className="text-xs text-ink-300">
                Sin asignar: US$ {sinAsignar.toLocaleString("es-AR")}, va a mediano.
              </p>
            )}
          </fieldset>
        )}

        {/* Fechas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha de consumo" required error={errors.fechaConsumo}>
            {(c) => (
              <input
                {...c}
                type="date"
                value={fechaConsumo}
                onChange={(e) => { setFechaConsumo(e.target.value); clear("fechaConsumo"); }}
                className="form-input tabular"
              />
            )}
          </Field>
          <Field
            label="Fecha de pago real"
            required
            error={errors.fechaPago}
            extra={
              <label className="-my-3 flex cursor-pointer items-center gap-2 whitespace-nowrap py-3 text-xs text-ink-200">
                <input
                  type="checkbox"
                  checked={fechaPagoAuto}
                  onChange={(e) => setFechaPagoAuto(e.target.checked)}
                  className="h-4 w-4 accent-amber"
                />
                Automática
              </label>
            }
          >
            {(c) => (
              <input
                {...c}
                type="date"
                value={fechaPago}
                onChange={(e) => { setFechaPago(e.target.value); setFechaPagoAuto(false); clear("fechaPago"); }}
                disabled={fechaPagoAuto}
                className="form-input tabular"
              />
            )}
          </Field>
        </div>

        {/* Categoría */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoría" error={errors.categoria}>
            {(c) => (
              <select {...c} value={categoria} onChange={(e) => {
                setCategoria(e.target.value);
                setSubcategoria(CATEGORIES.find(cat => cat.name === e.target.value)?.subcategories[0] ?? "Sin categoría");
                clear("categoria");
              }} className="form-input">
                {CATEGORIES.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Subcategoría" error={errors.subcategoria}>
            {(c) => (
              <select {...c} value={subcategoria} onChange={(e) => { setSubcategoria(e.target.value); clear("subcategoria"); }} className="form-input">
                {subcategories.map(sc => <option key={sc} value={sc}>{sc}</option>)}
              </select>
            )}
          </Field>
        </div>

        {/* Cuotas */}
        {fuente === "tarjeta" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cuotas totales" error={errors.cuotaTotal}>
              {(c) => (
                <input {...c} type="number" min={1} value={cuotaTotal} inputMode="numeric"
                  onChange={(e) => { setCuotaTotal(e.target.value); clear("cuotaTotal"); clear("cuotaNumero"); }}
                  className="form-input tabular font-mono" />
              )}
            </Field>
            <Field label="Cuota número" error={errors.cuotaNumero}>
              {(c) => (
                <input {...c} type="number" min={1} value={cuotaNumero} inputMode="numeric"
                  onChange={(e) => { setCuotaNumero(e.target.value); clear("cuotaNumero"); }}
                  className="form-input tabular font-mono" />
              )}
            </Field>
            {(() => {
              const tot = parseInt(cuotaTotal, 10), num = parseInt(cuotaNumero, 10);
              if (!(tot > 1) || !(num >= 1) || num > tot) return null;
              const faltan = tot - num;
              return (
                <div className="col-span-2 -mt-1 space-y-2">
                  <p className="text-xs text-ink-300">
                    El monto es el de <span className="text-ink-100">cada cuota</span>
                    {montoNum > 0 && <> · total de la compra {formatPesos(montoNum * tot)}</>}.
                  </p>
                  {!editing && faltan > 0 && (
                    <label className="flex min-h-11 items-center gap-3 text-sm text-ink-100 cursor-pointer">
                      <input type="checkbox" checked={crearCuotas} onChange={(e) => setCrearCuotas(e.target.checked)}
                        className="w-4 h-4 accent-paper" />
                      Crear también las {faltan} cuota{faltan === 1 ? "" : "s"} que faltan, una por mes
                    </label>
                  )}
                  {editing?.grupoCuotas && num < tot && (
                    <label className="flex min-h-11 items-center gap-3 text-sm text-ink-100 cursor-pointer">
                      <input type="checkbox" checked={aplicarAGrupo} onChange={(e) => setAplicarAGrupo(e.target.checked)}
                        className="w-4 h-4 accent-paper" />
                      Aplicar descripción, categoría y monto también a las cuotas siguientes
                    </label>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {esSueldoForm && (
          <fieldset className="surface p-4 space-y-3">
            <legend className="eyebrow px-1">Datos del recibo (opcional)</legend>
            <p className="text-xs text-ink-300 leading-relaxed">
              Este ingreso también se guarda en la hoja Sueldos, como si importaras el recibo. El monto es el neto.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Empresa">
                {(c) => <input {...c} type="text" maxLength={80} value={recibo.empresa}
                  onChange={(e) => setReciboCampo("empresa", e.target.value)} className="form-input" />}
              </Field>
              <Field label="Cargo">
                {(c) => <input {...c} type="text" maxLength={80} value={recibo.cargo}
                  onChange={(e) => setReciboCampo("cargo", e.target.value)} className="form-input" />}
              </Field>
              <Field label="Período trabajado" hint="Si lo dejás vacío, se toma el mes anterior al cobro (según Ajustes).">
                {(c) => <input {...c} type="month" value={recibo.periodoTrabajado}
                  onChange={(e) => setReciboCampo("periodoTrabajado", e.target.value)} className="form-input tabular" />}
              </Field>
              <Field label="Bruto">
                {(c) => <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={recibo.bruto}
                  onChange={(e) => setReciboCampo("bruto", e.target.value)} placeholder="0,00" className="form-input tabular font-mono" />}
              </Field>
              <Field label="Jubilación">
                {(c) => <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={recibo.jubilacion}
                  onChange={(e) => setReciboCampo("jubilacion", e.target.value)} placeholder="0,00" className="form-input tabular font-mono" />}
              </Field>
              <Field label="Obra social">
                {(c) => <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={recibo.obraSocial}
                  onChange={(e) => setReciboCampo("obraSocial", e.target.value)} placeholder="0,00" className="form-input tabular font-mono" />}
              </Field>
              <Field label="Ley 19032 (PAMI)">
                {(c) => <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={recibo.ley19032}
                  onChange={(e) => setReciboCampo("ley19032", e.target.value)} placeholder="0,00" className="form-input tabular font-mono" />}
              </Field>
              <Field label="Otros descuentos">
                {(c) => <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={recibo.otrosDescuentos}
                  onChange={(e) => setReciboCampo("otrosDescuentos", e.target.value)} placeholder="0,00" className="form-input tabular font-mono" />}
              </Field>
            </div>
          </fieldset>
        )}

        <Field label="Notas (opcional)" error={errors.notas}>
          {(c) => (
            <input {...c} type="text" value={notas} maxLength={500}
              onChange={(e) => { setNotas(e.target.value); clear("notas"); }}
              placeholder="Detalle adicional…"
              className="form-input" />
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

/** Campos del recibo del formulario → payload: los vacíos no se mandan (conservan lo guardado). */
function reciboPayload(r: Record<keyof DatosRecibo, string>): DatosRecibo {
  const num = (v: string) => (v.trim() === "" ? undefined : parseFloat(v) || 0);
  const txt = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    empresa: txt(r.empresa), cargo: txt(r.cargo), periodoTrabajado: txt(r.periodoTrabajado),
    bruto: num(r.bruto), jubilacion: num(r.jubilacion), obraSocial: num(r.obraSocial),
    ley19032: num(r.ley19032), otrosDescuentos: num(r.otrosDescuentos),
  };
}

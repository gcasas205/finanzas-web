"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Recurrente } from "@/types";
import { recurrentesApi, ApiError, errorMessage, type RecurrentePayload } from "@/lib/api";
import { useCategorias } from "@/components/DataProvider";
import { formatPesos, formatMes } from "@/lib/utils";
import { UsdAmount } from "@/components/UsdAmount";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field, focusFirstInvalid } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export const RECURRENTES_KEY = "/api/recurrentes";

/** Gastos (o ingresos) fijos mensuales: alquiler, prepaga, suscripciones. */
export function GastosFijosSection() {
  const { data, error, mutate } = useSWR(RECURRENTES_KEY, () => recurrentesApi.list(), { revalidateOnFocus: false });
  const [editando, setEditando] = useState<Recurrente | null>(null);
  const [abierto, setAbierto] = useState(false);
  const { confirm, dialog } = useConfirm();

  const borrar = async (r: Recurrente) => {
    if (!(await confirm({ title: "Eliminar gasto fijo", description: <>Vas a eliminar <strong className="text-paper">{r.descripcion}</strong>. Los movimientos ya cargados no se tocan.</> }))) return;
    try {
      await recurrentesApi.borrar(r.id);
      toast.success(`"${r.descripcion}" eliminado`);
      mutate();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo eliminar"), { duration: 7000 });
    }
  };

  return (
    <section id="gastos-fijos" className="surface p-5 sm:p-8 mt-8 scroll-mt-24">
      <div className="eyebrow mb-1">Movimientos</div>
      <h2 className="display text-2xl text-paper mb-2">Gastos fijos</h2>
      <p className="text-xs text-ink-300 leading-relaxed mb-6 max-w-xl">
        Los que se repiten todos los meses. Cada mes, en Movimientos, te avisamos cuáles faltan cargar y los cargás con un
        toque. Si un gasto ya viene en el resumen de la tarjeta, no hace falta agregarlo acá.
      </p>
      {error ? (
        <p className="text-sm text-terra-light" role="alert">{errorMessage(error, "No pudimos traer los gastos fijos")}</p>
      ) : !data ? (
        <p className="text-sm text-ink-300" role="status">Cargando…</p>
      ) : (
        <>
          {data.recurrentes.length === 0 ? (
            <p className="text-sm text-ink-300 italic mb-4">Todavía no cargaste gastos fijos.</p>
          ) : (
            <div className="divide-y divide-ink-600/60 mb-4">
              {data.recurrentes.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-sm truncate ${r.activo ? "text-paper" : "text-ink-300 line-through"}`}>{r.descripcion}</div>
                    <div className="text-xs text-ink-300">
                      Día {r.dia} · {r.categoria}{!r.activo && " · pausado"}
                      {r.ultimoMes && ` · último: ${formatMes(r.ultimoMes, true)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-sm font-mono tabular mr-2 ${r.tipo === "ingreso" ? "text-moss-light" : "text-terra-light"}`}>
                      <span aria-hidden="true">{r.tipo === "ingreso" ? "+" : "−"}</span>
                      {r.moneda === "USD" ? <UsdAmount value={r.monto} /> : formatPesos(r.monto)}
                    </span>
                    <button type="button" onClick={() => { setEditando(r); setAbierto(true); }}
                      className="p-2.5 text-ink-300 hover:text-paper" aria-label={`Editar ${r.descripcion}`}>
                      <Edit2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => borrar(r)}
                      className="p-2.5 text-ink-300 hover:text-terra-light" aria-label={`Eliminar ${r.descripcion}`}>
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="secundario" onClick={() => { setEditando(null); setAbierto(true); }}>
            <Plus className="w-4 h-4" aria-hidden="true" /> Agregar gasto fijo
          </Button>
        </>
      )}
      <Dialog open={abierto} onClose={() => setAbierto(false)} eyebrow={editando ? "Editar" : "Nuevo"} title="Gasto fijo" size="lg">
        {abierto && (
          <RecurrenteForm
            key={editando?.id ?? "nuevo"}
            editando={editando}
            onClose={() => setAbierto(false)}
            onSaved={() => { setAbierto(false); mutate(); }}
          />
        )}
      </Dialog>
      {dialog}
    </section>
  );
}

function RecurrenteForm({ editando, onClose, onSaved }: { editando: Recurrente | null; onClose: () => void; onSaved: () => void }) {
  const { categorias, subcategoriasDe } = useCategorias();
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState<"egreso" | "ingreso">(editando?.tipo ?? "egreso");
  const [descripcion, setDescripcion] = useState(editando?.descripcion ?? "");
  const [monto, setMonto] = useState(editando ? String(editando.monto) : "");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(editando?.moneda ?? "ARS");
  const [categoria, setCategoria] = useState(editando?.categoria ?? "Vivienda");
  const [subcategoria, setSubcategoria] = useState(editando?.subcategoria ?? subcategoriasDe("Vivienda")[0]);
  const [fuente, setFuente] = useState<Recurrente["fuente"]>(editando?.fuente ?? "manual");
  const [dia, setDia] = useState(editando ? String(editando.dia) : "1");
  const [activo, setActivo] = useState(editando?.activo ?? true);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Partial<Record<string, string>> = {};
    if (descripcion.trim().length < 2) e.descripcion = "Poné una descripción (mínimo 2 caracteres)";
    if (!(parseFloat(monto) > 0)) e.monto = "El monto tiene que ser mayor a 0";
    const d = parseInt(dia, 10);
    if (!(d >= 1 && d <= 31)) e.dia = "Del 1 al 31";
    if (Object.keys(e).length) { setErrors(e); focusFirstInvalid(formRef.current); return; }
    const payload: RecurrentePayload = {
      tipo, descripcion: descripcion.trim(), monto: parseFloat(monto), moneda, categoria, subcategoria, fuente, dia: d, activo,
    };
    setSaving(true);
    try {
      if (editando) await recurrentesApi.actualizar({ ...payload, id: editando.id });
      else await recurrentesApi.crear(payload);
      toast.success(`"${payload.descripcion}" guardado`);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.field) { setErrors({ [err.field]: err.message }); focusFirstInvalid(formRef.current); }
      else toast.error(errorMessage(err, "No se pudo guardar"), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      <Segmented label="Tipo" value={tipo} onChange={setTipo}
        options={[{ value: "egreso", label: "↓ Gasto", tone: "negativo" }, { value: "ingreso", label: "↑ Ingreso", tone: "positivo" }]} />
      <Field label="Descripción" required error={errors.descripcion}>
        {(c) => <input {...c} type="text" maxLength={100} value={descripcion} data-autofocus placeholder="Ej: Alquiler"
          onChange={(e) => { setDescripcion(e.target.value); setErrors({}); }} className="form-input" />}
      </Field>
      <Field label={`Monto (${moneda})`} required error={errors.monto} hint="Si cambia mes a mes, poné el habitual: lo podés corregir al cargarlo.">
        {(c) => (
          <div className="flex">
            <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={monto}
              onChange={(e) => { setMonto(e.target.value); setErrors({}); }} className="form-input flex-1 tabular font-mono" />
            <Segmented label="Moneda" value={moneda} onChange={setMoneda} attached
              options={[{ value: "ARS", label: "ARS" }, { value: "USD", label: "USD" }]} />
          </div>
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Categoría">
          {(c) => (
            <select {...c} value={categoria} onChange={(e) => { setCategoria(e.target.value); setSubcategoria(subcategoriasDe(e.target.value)[0]); }} className="form-input">
              {categorias.map((cat) => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Subcategoría">
          {(c) => (
            <select {...c} value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className="form-input">
              {subcategoriasDe(categoria).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </Field>
        <Field label="Día del mes" required error={errors.dia} hint="Si el mes es más corto, se usa el último día.">
          {(c) => <input {...c} type="number" min={1} max={31} inputMode="numeric" value={dia}
            onChange={(e) => { setDia(e.target.value); setErrors({}); }} className="form-input tabular font-mono" />}
        </Field>
        <Field label="Fuente">
          {(c) => (
            <select {...c} value={fuente} onChange={(e) => setFuente(e.target.value as Recurrente["fuente"])} className="form-input">
              <option value="manual">Manual / Efectivo</option>
              <option value="tarjeta">Tarjeta de crédito</option>
            </select>
          )}
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm text-ink-100 cursor-pointer">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 accent-paper" />
        Activo (si lo pausás, no aparece como pendiente)
      </label>
      <DialogActions>
        <Button variant="fantasma" onClick={onClose}>Cancelar</Button>
        <Button type="submit" isLoading={saving}>Guardar</Button>
      </DialogActions>
    </form>
  );
}

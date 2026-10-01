"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useTransactions } from "@/components/DataProvider";
import { ahorroApi, ApiError, errorMessage } from "@/lib/api";
import { Field, focusFirstInvalid } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface SobreForm {
  key?: string;
  nombre: string;
  pct: string;
  objetivo: string;
  fechaObjetivo: string;
}

/** Plan de ahorro: piso, rendimiento supuesto y sobres (se guarda en la hoja Config). */
export function PlanAhorroSection() {
  const { ahorroConfig, refresh } = useTransactions();
  const formRef = useRef<HTMLFormElement>(null);
  const [piso, setPiso] = useState("");
  const [retorno, setRetorno] = useState("");
  const [sobres, setSobres] = useState<SobreForm[]>([]);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const cargado = useRef(false);
  const { confirm, dialog } = useConfirm();

  // Se precarga una sola vez con lo guardado
  useEffect(() => {
    if (!ahorroConfig || cargado.current) return;
    cargado.current = true;
    setPiso(String(ahorroConfig.emergenciaObjetivo));
    setRetorno(String(Math.round(ahorroConfig.sp500RetornoAnual * 10000) / 100));
    setSobres(ahorroConfig.sobres.map((s) => ({
      key: s.key, nombre: s.nombre, pct: String(s.pct), objetivo: String(s.objetivo), fechaObjetivo: s.fechaObjetivo ?? "",
    })));
  }, [ahorroConfig]);

  const sumaPct = sobres.reduce((a, s) => a + (parseFloat(s.pct) || 0), 0);
  const cambiar = (i: number, patch: Partial<SobreForm>) => {
    setSobres((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setErrors({});
  };
  const quitar = async (i: number) => {
    const s = sobres[i];
    const ok = await confirm({
      title: "Quitar sobre",
      description: <>Vas a quitar <strong className="text-paper">{s.nombre || "este sobre"}</strong>. Al guardar, el ahorro se
        recalcula y su saldo pasa a repartirse entre los demás sobres.</>,
      confirmLabel: "Quitar",
    });
    if (ok) setSobres((prev) => prev.filter((_, idx) => idx !== i));
  };

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Partial<Record<string, string>> = {};
    if (!(parseFloat(piso) >= 0)) e.piso = "Poné un monto (0 o más)";
    if (!Number.isFinite(parseFloat(retorno))) e.retorno = "Poné un porcentaje";
    sobres.forEach((s, i) => {
      if (!s.nombre.trim()) e[`nombre-${i}`] = "Poné un nombre";
      if (!(parseFloat(s.pct) >= 0) || parseFloat(s.pct) > 100) e[`pct-${i}`] = "Entre 0 y 100";
      if (!(parseFloat(s.objetivo) >= 0)) e[`objetivo-${i}`] = "Poné un objetivo";
    });
    if (Object.keys(e).length) { setErrors(e); focusFirstInvalid(formRef.current); return; }
    setSaving(true);
    try {
      await ahorroApi.guardarConfig({
        emergenciaObjetivo: parseFloat(piso),
        sp500RetornoPct: parseFloat(retorno),
        sobres: sobres.map((s) => ({
          ...(s.key ? { key: s.key } : {}),
          nombre: s.nombre.trim(),
          pct: parseFloat(s.pct),
          objetivo: parseFloat(s.objetivo),
          ...(s.fechaObjetivo ? { fechaObjetivo: s.fechaObjetivo } : {}),
        })),
      });
      toast.success("Plan de ahorro guardado");
      cargado.current = false; // que tome las claves nuevas de los sobres creados
      refresh();
    } catch (err) {
      if (err instanceof ApiError && err.field) toast.error(err.message, { duration: 7000 });
      else toast.error(errorMessage(err, "No se pudo guardar el plan"), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="plan-ahorro" className="surface p-5 sm:p-8 mt-8 scroll-mt-24">
      <div className="eyebrow mb-1">Ahorro</div>
      <h2 className="display text-2xl text-paper mb-2">Plan de ahorro</h2>
      <p className="text-xs text-ink-300 leading-relaxed mb-6 max-w-xl">
        Se guarda en la hoja Config. Cambiar % u objetivos recalcula todo el historial con el plan nuevo.
      </p>
      {!ahorroConfig ? (
        <p className="text-sm text-ink-300" role="status">Cargando el plan…</p>
      ) : (
        <form ref={formRef} onSubmit={guardar} noValidate className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Piso de emergencia (USD)" error={errors.piso} hint="Se llena primero con cada entrada de dólares.">
              {(c) => <input {...c} type="number" min="0" step="1" inputMode="decimal" value={piso}
                onChange={(e) => { setPiso(e.target.value); setErrors({}); }} className="form-input tabular font-mono" />}
            </Field>
            <Field label="Rendimiento supuesto S&P (% anual)" error={errors.retorno} hint="Sólo para la proyección ilustrativa.">
              {(c) => <input {...c} type="number" step="0.1" inputMode="decimal" value={retorno}
                onChange={(e) => { setRetorno(e.target.value); setErrors({}); }} className="form-input tabular font-mono" />}
            </Field>
          </div>

          <fieldset className="space-y-4">
            <legend className="eyebrow mb-2">Sobres del mediano plazo</legend>
            {sobres.map((s, i) => (
              <div key={s.key ?? `nuevo-${i}`} className="hairline-t pt-4 grid grid-cols-2 gap-3 sm:grid-cols-12 sm:items-end">
                <div className="col-span-2 sm:col-span-4">
                  <Field label="Nombre" error={errors[`nombre-${i}`]}>
                    {(c) => <input {...c} type="text" maxLength={40} value={s.nombre}
                      onChange={(e) => cambiar(i, { nombre: e.target.value })} className="form-input" />}
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="%" error={errors[`pct-${i}`]}>
                    {(c) => <input {...c} type="number" min="0" max="100" step="1" inputMode="decimal" value={s.pct}
                      onChange={(e) => cambiar(i, { pct: e.target.value })} className="form-input tabular font-mono" />}
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Objetivo USD" error={errors[`objetivo-${i}`]}>
                    {(c) => <input {...c} type="number" min="0" step="1" inputMode="decimal" value={s.objetivo}
                      onChange={(e) => cambiar(i, { objetivo: e.target.value })} className="form-input tabular font-mono" />}
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Para (opcional)">
                    {(c) => <input {...c} type="month" value={s.fechaObjetivo}
                      onChange={(e) => cambiar(i, { fechaObjetivo: e.target.value })} className="form-input tabular" />}
                  </Field>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button type="button" onClick={() => quitar(i)} className="p-3 text-ink-300 hover:text-terra-light"
                    aria-label={`Quitar el sobre ${s.nombre || i + 1}`}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secundario" onClick={() => setSobres((p) => [...p, { nombre: "", pct: "0", objetivo: "0", fechaObjetivo: "" }])}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Agregar sobre
              </Button>
              <span className={`text-xs tabular ${Math.abs(sumaPct - 100) < 0.01 ? "text-ink-300" : "text-terra-light"}`} aria-live="polite">
                Suma de %: {sumaPct}%{Math.abs(sumaPct - 100) < 0.01 ? "" : " (conviene que sume 100)"}
              </span>
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button type="submit" variant="secundario" isLoading={saving}>
              {!saving && <Check className="w-4 h-4" aria-hidden="true" />}
              Guardar plan
            </Button>
          </div>
        </form>
      )}
      {dialog}
    </section>
  );
}

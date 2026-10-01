"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { presupuestosApi, errorMessage } from "@/lib/api";
import { formatPesos } from "@/lib/utils";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useCategorias } from "@/components/DataProvider";

/** Presupuesto mensual por categoría de gasto (en pesos). Vacío = sin presupuesto. */
export function PresupuestoSection() {
  const { data, error, mutate } = useSWR("/api/presupuestos", () => presupuestosApi.list(), { revalidateOnFocus: false });
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const cargado = useRef(false);
  const categorias = useCategorias().categorias.filter((c) => c.name !== "Ingresos");

  useEffect(() => {
    if (!data || cargado.current) return;
    cargado.current = true;
    setValores(Object.fromEntries(Object.entries(data.presupuestos).map(([k, v]) => [k, String(v)])));
  }, [data]);

  const total = categorias.reduce((a, c) => a + (parseFloat(valores[c.name] ?? "") || 0), 0);

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const presupuestos = Object.fromEntries(
        categorias.map((c) => [c.name, Math.max(0, parseFloat(valores[c.name] ?? "") || 0)]),
      );
      const r = await presupuestosApi.guardar(presupuestos);
      mutate({ presupuestos: r.presupuestos }, { revalidate: false });
      toast.success("Presupuesto guardado");
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar el presupuesto"), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="presupuesto" className="surface p-5 sm:p-8 mt-8 scroll-mt-24">
      <div className="eyebrow mb-1">Gastos</div>
      <h2 className="display text-2xl text-paper mb-2">Presupuesto mensual</h2>
      <p className="text-xs text-ink-300 leading-relaxed mb-6 max-w-xl">
        Un tope en pesos por categoría. En el Resumen vas a ver cuánto llevás gastado de cada uno en el mes.
        Dejalo vacío para no presupuestar esa categoría.
      </p>
      {error ? (
        <p className="text-sm text-terra-light" role="alert">{errorMessage(error, "No pudimos traer el presupuesto")}</p>
      ) : !data ? (
        <p className="text-sm text-ink-300" role="status">Cargando…</p>
      ) : (
        <form onSubmit={guardar} noValidate className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categorias.map((c) => (
              <Field key={c.name} label={c.name}>
                {(f) => (
                  <input {...f} type="number" min="0" step="1000" inputMode="decimal" placeholder="Sin presupuesto"
                    value={valores[c.name] ?? ""}
                    onChange={(e) => setValores((p) => ({ ...p, [c.name]: e.target.value }))}
                    className="form-input tabular font-mono" />
                )}
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-300 tabular">
              Total presupuestado: {formatPesos(total)}
            </span>
            <Button type="submit" variant="secundario" isLoading={saving}>
              {!saving && <Check className="w-4 h-4" aria-hidden="true" />}
              Guardar presupuesto
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

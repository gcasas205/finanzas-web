"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useCategorias } from "@/components/DataProvider";
import { categoriasApi, errorMessage } from "@/lib/api";
import { CATEGORIA_COLORES } from "@/lib/categories";
import { Field, focusFirstInvalid } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Fila {
  /** Nombre guardado (para detectar renombres); vacío si es nueva */
  original: string;
  name: string;
  subs: string;
  color: string;
}

/** Ingresos y Otros las usa la app (sueldos, reintegros, sin categoría): no se quitan ni renombran. */
const FIJAS = new Set(["Ingresos", "Otros"]);

export function CategoriasSection() {
  const { categorias, refresh } = useCategorias();
  const formRef = useRef<HTMLFormElement>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const cargado = useRef(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (cargado.current || !categorias.length) return;
    cargado.current = true;
    setFilas(categorias.map((c) => ({ original: c.name, name: c.name, subs: c.subcategories.join(", "), color: c.color })));
  }, [categorias]);

  const cambiar = (i: number, patch: Partial<Fila>) => {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    setErrors({});
  };

  const quitar = async (i: number) => {
    const f = filas[i];
    const ok = await confirm({
      title: "Quitar categoría",
      description: <>Vas a quitar <strong className="text-paper">{f.name}</strong>. Los movimientos que ya la usan la conservan,
        pero no vas a poder elegirla para movimientos nuevos.</>,
      confirmLabel: "Quitar",
    });
    if (ok) setFilas((prev) => prev.filter((_, idx) => idx !== i));
  };

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Partial<Record<string, string>> = {};
    const vistos = new Set<string>();
    filas.forEach((f, i) => {
      const n = f.name.trim();
      if (!n) e[`name-${i}`] = "Poné un nombre";
      else if (vistos.has(n.toLowerCase())) e[`name-${i}`] = "Ya hay una categoría con ese nombre";
      vistos.add(n.toLowerCase());
      if (!f.subs.split(",").some((x) => x.trim())) e[`subs-${i}`] = "Poné al menos una subcategoría";
    });
    if (Object.keys(e).length) { setErrors(e); focusFirstInvalid(formRef.current); return; }

    const renombres = Object.fromEntries(
      filas.filter((f) => f.original && f.original !== f.name.trim()).map((f) => [f.original, f.name.trim()]),
    );
    setSaving(true);
    try {
      const r = await categoriasApi.guardar(
        filas.map((f) => ({
          name: f.name.trim(),
          subcategories: Array.from(new Set(f.subs.split(",").map((x) => x.trim()).filter(Boolean))),
          color: f.color,
        })),
        renombres,
      );
      toast.success(r.migrados > 0 ? `Categorías guardadas (${r.migrados} movimientos actualizados)` : "Categorías guardadas");
      setFilas((prev) => prev.map((f) => ({ ...f, original: f.name.trim() })));
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudieron guardar las categorías"), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="categorias" className="surface p-5 sm:p-8 mt-8 scroll-mt-24">
      <div className="eyebrow mb-1">Movimientos</div>
      <h2 className="display text-2xl text-paper mb-2">Categorías</h2>
      <p className="text-xs text-ink-300 leading-relaxed mb-6 max-w-xl">
        Se guardan en la pestaña Categorias. Si renombrás una, también se actualizan los movimientos, el presupuesto
        y las reglas que la usaban. Las subcategorías van separadas por coma.
      </p>
      <form ref={formRef} onSubmit={guardar} noValidate className="space-y-4">
        {filas.map((f, i) => {
          const fija = FIJAS.has(f.original);
          return (
            <div key={f.original || `nueva-${i}`} className="hairline-t pt-4 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-3">
                <Field label="Nombre" error={errors[`name-${i}`]} hint={fija ? "La usa la app: no se renombra." : undefined}>
                  {(c) => <input {...c} type="text" maxLength={40} value={f.name} disabled={fija}
                    onChange={(e) => cambiar(i, { name: e.target.value })} className="form-input disabled:opacity-60" />}
                </Field>
              </div>
              <div className="sm:col-span-6">
                <Field label="Subcategorías" error={errors[`subs-${i}`]}>
                  {(c) => <input {...c} type="text" value={f.subs}
                    onChange={(e) => cambiar(i, { subs: e.target.value })} className="form-input" />}
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Color">
                  {(c) => (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full shrink-0 border border-ink-500" style={{ background: f.color }} aria-hidden="true" />
                      <select {...c} value={f.color} onChange={(e) => cambiar(i, { color: e.target.value })} className="form-input">
                        {CATEGORIA_COLORES.map((col, n) => <option key={col} value={col}>Color {n + 1}</option>)}
                      </select>
                    </div>
                  )}
                </Field>
              </div>
              <div className="sm:col-span-1 flex justify-end">
                {!fija && (
                  <button type="button" onClick={() => quitar(i)} className="p-3 text-ink-300 hover:text-terra-light"
                    aria-label={`Quitar la categoría ${f.name || i + 1}`}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button variant="secundario" onClick={() => setFilas((p) => [...p, {
            original: "", name: "", subs: "General", color: CATEGORIA_COLORES[p.length % CATEGORIA_COLORES.length],
          }])}>
            <Plus className="w-4 h-4" aria-hidden="true" /> Agregar categoría
          </Button>
          <Button type="submit" variant="secundario" isLoading={saving}>
            {!saving && <Check className="w-4 h-4" aria-hidden="true" />}
            Guardar categorías
          </Button>
        </div>
      </form>
      {dialog}
    </section>
  );
}

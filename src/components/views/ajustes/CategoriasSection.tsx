"use client";

import { useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useCategorias } from "@/components/DataProvider";
import { categoriasApi, errorMessage } from "@/lib/api";
import { CATEGORIA_COLORES } from "@/lib/categories";
import { focusFirstInvalid } from "@/components/ui/Field";
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
        <div className="divide-y divide-ink-600/60 hairline-t hairline-b">
          {filas.map((f, i) => {
            const fija = FIJAS.has(f.original);
            const idNombre = `cat-nombre-${i}`;
            const idSubs = `cat-subs-${i}`;
            return (
              <div key={f.original || `nueva-${i}`} className="py-5 space-y-3">
                {/* Nombre con su color al lado, y quitar a la derecha */}
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: f.color }} aria-hidden="true" />
                  <label htmlFor={idNombre} className="sr-only">Nombre de la categoría</label>
                  <input
                    id={idNombre}
                    type="text"
                    maxLength={40}
                    value={f.name}
                    disabled={fija}
                    placeholder="Nombre de la categoría"
                    aria-invalid={Boolean(errors[`name-${i}`]) || undefined}
                    aria-describedby={errors[`name-${i}`] ? `${idNombre}-error` : undefined}
                    onChange={(e) => cambiar(i, { name: e.target.value })}
                    className="form-input flex-1 min-w-0 font-medium disabled:opacity-100 disabled:cursor-not-allowed"
                  />
                  {/* Mismo ancho para "Fija" y la papelera: los nombres quedan alineados */}
                  <div className="w-11 shrink-0 flex justify-center">
                    {fija ? (
                      <span className="text-xs text-ink-300 px-1.5 py-1 border border-control" title="La usa la app: no se renombra ni se quita">
                        Fija
                      </span>
                    ) : (
                      <button type="button" onClick={() => quitar(i)} className="w-11 h-11 inline-flex items-center justify-center text-ink-300 hover:text-terra-light"
                        aria-label={`Quitar la categoría ${f.name || i + 1}`}>
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {errors[`name-${i}`] && (
                  <p id={`${idNombre}-error`} className="text-xs text-terra-light pl-6">{errors[`name-${i}`]}</p>
                )}

                <div className="pl-6 pr-14 space-y-3 max-sm:pr-0">
                  <div>
                    <label htmlFor={idSubs} className="eyebrow block mb-1.5">Subcategorías</label>
                    {/* textarea que crece con el texto (Safari no soporta field-sizing): la lista nunca queda cortada */}
                    <AutoTextarea
                      id={idSubs}
                      value={f.subs}
                      aria-invalid={Boolean(errors[`subs-${i}`]) || undefined}
                      aria-describedby={errors[`subs-${i}`] ? `${idSubs}-error` : undefined}
                      onChange={(e) => cambiar(i, { subs: e.target.value })}
                      className="form-input w-full resize-none leading-relaxed"
                    />
                    {errors[`subs-${i}`] && <p id={`${idSubs}-error`} className="text-xs text-terra-light mt-1">{errors[`subs-${i}`]}</p>}
                  </div>

                  <div>
                  <span className="eyebrow block" aria-hidden="true">Color</span>
                  <div role="radiogroup" aria-label={`Color de ${f.name || "la categoría"}`} className="flex flex-wrap items-center -ml-3">
                    {CATEGORIA_COLORES.map((col, n) => {
                      const elegido = f.color.toLowerCase() === col.toLowerCase();
                      return (
                        <button
                          key={col}
                          type="button"
                          role="radio"
                          aria-checked={elegido}
                          aria-label={`Color ${n + 1}`}
                          onClick={() => cambiar(i, { color: col })}
                          className="w-11 h-11 inline-flex items-center justify-center rounded-full"
                        >
                          <span
                            className={`w-5 h-5 rounded-full transition-shadow ${elegido ? "ring-2 ring-paper ring-offset-2 ring-offset-ink-800" : ""}`}
                            style={{ background: col }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

/** Textarea que crece con su contenido (mide scrollHeight; Safari no soporta field-sizing). */
function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ajustar = () => { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; };
    ajustar();
    // También al cambiar el ancho (rotar el celular, achicar la ventana)
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

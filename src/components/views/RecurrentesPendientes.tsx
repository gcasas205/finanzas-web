"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { recurrentesApi, errorMessage } from "@/lib/api";
import { pendientesDelMes, fechaDelMes } from "@/lib/recurrentes";
import { formatPesos, formatMes, formatFecha, hoyLocal } from "@/lib/utils";
import { UsdAmount } from "@/components/UsdAmount";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { RECURRENTES_KEY } from "@/components/views/ajustes/GastosFijosSection";

/** Aviso con los gastos fijos del mes que faltan cargar, y su carga con un toque. */
export function RecurrentesPendientes({ onCargados }: { onCargados: () => void }) {
  const { data, mutate } = useSWR(RECURRENTES_KEY, () => recurrentesApi.list(), { revalidateOnFocus: false });
  const mes = hoyLocal().slice(0, 7);
  const pendientes = data ? pendientesDelMes(data.recurrentes, mes) : [];
  const [abierto, setAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);

  if (!pendientes.length) return null;

  const abrir = () => { setElegidos(new Set(pendientes.map((p) => p.id))); setAbierto(true); };
  const cargar = async () => {
    setCargando(true);
    try {
      const r = await recurrentesApi.cargar(Array.from(elegidos), mes);
      toast.success(`${r.cargados} gasto${r.cargados === 1 ? "" : "s"} fijo${r.cargados === 1 ? "" : "s"} cargado${r.cargados === 1 ? "" : "s"}`);
      setAbierto(false);
      mutate();
      onCargados();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudieron cargar"), { duration: 7000 });
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div className="surface px-4 sm:px-5 py-3 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" role="status">
        <div className="flex items-start gap-3">
          <CalendarClock className="w-4 h-4 text-ink-300 mt-0.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-ink-100">
            Tenés {pendientes.length} gasto{pendientes.length === 1 ? "" : "s"} fijo{pendientes.length === 1 ? "" : "s"} de{" "}
            {formatMes(mes)} sin cargar.
          </p>
        </div>
        <Button variant="secundario" onClick={abrir} className="shrink-0">Revisar y cargar</Button>
      </div>

      <Dialog open={abierto} onClose={() => setAbierto(false)} eyebrow={formatMes(mes)} title="Gastos fijos del mes" size="lg">
        <p className="text-xs text-ink-300 mb-4">
          Elegí cuáles cargar. Si alguno cambió de monto, cargalo y después editalo en la lista.{" "}
          <Link href="/settings#gastos-fijos" className="underline underline-offset-2 hover:text-paper">Administrar gastos fijos</Link>
        </p>
        <div className="divide-y divide-ink-600/60">
          {pendientes.map((p) => (
            <label key={p.id} className="py-3 flex items-center gap-3 cursor-pointer min-h-11">
              <input
                type="checkbox"
                checked={elegidos.has(p.id)}
                onChange={() => setElegidos((prev) => {
                  const n = new Set(prev);
                  if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
                  return n;
                })}
                className="w-4 h-4 accent-paper shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-paper truncate">{p.descripcion}</span>
                <span className="block text-xs text-ink-300">{formatFecha(fechaDelMes(mes, p.dia))} · {p.categoria}</span>
              </span>
              <span className={`text-sm font-mono tabular whitespace-nowrap ${p.tipo === "ingreso" ? "text-moss-light" : "text-terra-light"}`}>
                <span aria-hidden="true">{p.tipo === "ingreso" ? "+" : "−"}</span>
                {p.moneda === "USD" ? <UsdAmount value={p.monto} /> : formatPesos(p.monto)}
              </span>
            </label>
          ))}
        </div>
        <DialogActions>
          <Button variant="fantasma" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button variant="exito" onClick={cargar} isLoading={cargando} disabled={elegidos.size === 0}>
            Cargar {elegidos.size}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

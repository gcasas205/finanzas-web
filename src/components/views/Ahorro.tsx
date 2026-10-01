"use client";

import { useMemo, useRef, useState } from "react";
import { PiggyBank, ShieldCheck, TrendingUp, AlertTriangle, ArrowLeftRight, Trash2, Settings } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAhorro } from "@/components/DataProvider";
import { UsdAmount } from "@/components/UsdAmount";
import { computeAhorro, destinosAhorro, type SobreResultado, type BucketKey, type MovimientoAhorro } from "@/lib/ahorro-calc";
import { aporteMensualNecesario } from "@/lib/ahorro-config";
import { formatFecha, formatMes, hoyLocal } from "@/lib/utils";
import { ahorroApi, ApiError, errorMessage } from "@/lib/api";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field, focusFirstInvalid } from "@/components/ui/Field";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import LogoLoader from "@/components/LogoLoader";
import { ErrorState, StaleDataBanner } from "@/components/ui/States";
import { AnimatedUsdAmount } from "@/components/AnimatedNumber";
import { PALETTE } from "@/lib/palette";

// Los sobres toman los 4 colores de sobre en orden (se repiten si hay más)
const SOBRE_COLORES = ["var(--color-sobre-auto)", "var(--color-sobre-mud)", "var(--color-sobre-vac)", "var(--color-sobre-tec)"];
const EMERG_COLOR = "var(--color-piso)";
const LARGO_COLOR = "var(--color-largo)";

export default function Ahorro() {
  const { dolarOps, transactions, ahorroConfig, movAhorro, isLoading, error, refresh } = useAhorro();
  const [moviendo, setMoviendo] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const r = useMemo(
    () => (ahorroConfig ? computeAhorro(dolarOps, transactions, ahorroConfig, movAhorro) : null),
    [dolarOps, transactions, ahorroConfig, movAhorro],
  );

  const borrarPase = async (m: MovimientoAhorro) => {
    if (!m.paseId) return;
    const ok = await confirm({ title: "Eliminar pase", description: <>Vas a eliminar el pase &quot;{m.concepto}&quot; del {formatFecha(m.fecha)}.</> });
    if (!ok) return;
    try {
      await ahorroApi.borrarPase(m.paseId);
      toast.success("Pase eliminado");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo eliminar el pase"), { duration: 7000 });
    }
  };

  if (error && (!ahorroConfig || (dolarOps.length === 0 && transactions.length === 0))) {
    return <ErrorState message={error} onRetry={refresh} className="min-h-[60vh]" />;
  }
  if (isLoading || !r || !ahorroConfig) {
    return <LogoLoader className="min-h-[60vh]" />;
  }

  const { emergencia, mediano, largo } = r;
  const ret = ahorroConfig.sp500RetornoAnual * 100;
  const descuadre = Math.abs(r.descuadre) >= 0.5;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px]">
      {error && <StaleDataBanner message={error} onRetry={refresh} />}
      {/* Header */}
      <header className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <PiggyBank className="w-3.5 h-3.5" strokeWidth={1.5} /> Objetivos en moneda dura
        </div>
        <h1 className="display text-3xl sm:text-5xl text-paper">
          Tu <em className="italic">ahorro</em>
        </h1>
        <p className="mt-3 text-xs text-ink-300 leading-relaxed max-w-2xl">
          Todo sale de tu tenencia de dólares. El piso de emergencia se llena primero; recién ahí
          crecen el mediano y el largo plazo. Los sobres, el reparto y los objetivos se editan en Ajustes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secundario" onClick={() => setMoviendo(true)}>
            <ArrowLeftRight className="w-4 h-4" aria-hidden="true" /> Mover entre destinos
          </Button>
          <Link href="/settings#plan-ahorro" className={buttonClasses("fantasma")}>
            <Settings className="w-4 h-4" aria-hidden="true" /> Editar plan
          </Link>
        </div>
      </header>

      {/* Reconciliación */}
      <div className="surface p-4 sm:p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
        <ReconItem label="Tenencia neta" value={r.tenenciaNeta} strong />
        <div className="hidden sm:block flex-1" />
        <ReconItem label="Piso" value={emergencia.balance} />
        <ReconItem label="Mediano" value={mediano.balance} />
        <ReconItem label="Largo" value={largo.balance} />
        <div
          className={`text-xs tracking-wide flex items-center gap-1.5 ${descuadre ? "text-terra-light" : "text-moss-light"}`}
        >
          <span className="text-base leading-none">●</span>
          {descuadre ? <>descuadre <UsdAmount value={Math.abs(r.descuadre)} /></> : "asignado = tenencia"}
        </div>
      </div>

      {/* ── Nivel 1: Piso de emergencia ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3">
        <StageBadge n={1} />
        <div className="eyebrow">Base</div>
        <span className="text-xs px-2 py-0.5 border border-control text-ink-200">
          Se llena primero
        </span>
      </div>
      <div className="surface p-5 sm:p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: EMERG_COLOR }} />
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-ink-200" strokeWidth={1.3} aria-hidden="true" />
            <h2 className="display text-2xl sm:text-3xl text-paper">Piso base de emergencia</h2>
          </div>
          <div className="sm:text-right">
            <div className="display text-3xl sm:text-4xl tabular" style={{ color: EMERG_COLOR }}>
              <AnimatedUsdAmount value={emergencia.balance} />
            </div>
            <div className="text-xs text-ink-300 tabular mt-0.5">
              objetivo <UsdAmount value={emergencia.objetivo} />
            </div>
          </div>
        </div>
        <ProgressBar progreso={emergencia.progreso} color={EMERG_COLOR} tall />
        <div className="mt-4 flex items-center justify-between gap-4 text-xs">
          {emergencia.completo ? (
            <span className="text-moss-light font-medium">Piso completo · ahorro habilitado</span>
          ) : (
            <span className="text-ink-200">
              Faltan <UsdAmount value={emergencia.falta} /> — lo que compres va acá hasta cubrirlo
            </span>
          )}
          <span className="tabular text-ink-200">{Math.round(emergencia.progreso * 100)}%</span>
        </div>
      </div>

      {/* ── Nivel 2: Mediano plazo ──────────────────────────────────── */}
      <StageHeader
        n={2}
        titulo="Mediano plazo"
        sub="El pozo se reparte entre los sobres por los % de la config. Si uno se completa, el excedente pasa a los que faltan."
        rate={<>saldo <b className="text-paper font-medium"><UsdAmount value={mediano.balance} /></b></>}
        locked={!emergencia.completo && mediano.balance <= 0}
      />
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-2 transition-opacity ${!emergencia.completo && mediano.balance <= 0 ? "opacity-40" : ""}`}>
        {mediano.sobres.map((s, i) => (
          <SobreCard
            key={s.key}
            sobre={s}
            color={SOBRE_COLORES[i % SOBRE_COLORES.length]}
            fechaObjetivo={ahorroConfig.sobres.find((c) => c.key === s.key)?.fechaObjetivo}
          />
        ))}
      </div>
      {mediano.libre > 0.5 && (
        <p className="text-xs text-ink-100 flex items-center gap-2 mb-8" role="note">
          <AlertTriangle className="w-4 h-4 shrink-0 text-terra-light" strokeWidth={1.5} aria-hidden="true" />
          Excedente sin destino (sobres completos): <UsdAmount value={mediano.libre} />. Conviene sumar un
          objetivo o mandar más al largo plazo.
        </p>
      )}

      {/* ── Nivel 3: Largo plazo ────────────────────────────────────── */}
      <StageHeader
        n={3}
        titulo="Largo plazo"
        sub="USD apartados dentro de tu tenencia (no se valúa el S&P acá). La proyección es ilustrativa."
        rate={<>destino S&amp;P 500 · 15–20 años</>}
        locked={!emergencia.completo && largo.balance <= 0}
      />
      <div className={`surface p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 transition-opacity ${!emergencia.completo && largo.balance <= 0 ? "opacity-40" : ""}`}>
        <div>
          <div className="eyebrow mb-2" style={{ color: LARGO_COLOR }}>USD apartados</div>
          <div className="display text-3xl sm:text-4xl tabular" style={{ color: LARGO_COLOR }}>
            <AnimatedUsdAmount value={largo.balance} />
          </div>
          <div className="text-xs text-ink-300 mt-2">
            promedio ~<UsdAmount value={largo.aporteMensualProm} />/mes en los últimos {largo.mesesConAporte}{" "}
            {largo.mesesConAporte === 1 ? "mes" : "meses"} (desde el primer aporte)
          </div>
        </div>
        <div className="lg:border-l lg:border-ink-600/60 lg:pl-10">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} /> Proyección ilustrativa
          </div>
          <ProjRow label="A 15 años" value={largo.proyeccion15} />
          <ProjRow label="A 20 años" value={largo.proyeccion20} />
          <p className="text-xs text-ink-400 mt-3 leading-relaxed">
            Supone invertir lo apartado y seguir aportando el promedio actual, a un {ret.toFixed(0)}% anual
            nominal (editable en Config). Es solo ilustrativa: el rendimiento real varía y puede ser negativo.
            No es una recomendación de inversión.
          </p>
        </div>
      </div>

      <Historial
        onBorrarPase={borrarPase}
        movimientos={r.historial}
        nombres={{
          emergencia: "Piso",
          largo: "Largo plazo",
          ...Object.fromEntries(mediano.sobres.map((s) => [s.key, s.nombre])),
        } as Record<BucketKey, string>}
      />

      <p className="mt-8 text-xs text-ink-400 leading-relaxed max-w-2xl">
        Los aportes se cargan al comprar dólares (pestaña Dólares) o al recibir USD (Movimientos). Los gastos y
        ventas descuentan de un sobre —por la regla automática o el que elijas—. Los objetivos y % se editan
        en Ajustes y se guardan en la hoja Config del Google Sheets.
      </p>
      <PaseDialog
        open={moviendo}
        onClose={() => setMoviendo(false)}
        opciones={destinosAhorro(ahorroConfig)}
        saldos={{ emergencia: emergencia.balance, largo: largo.balance, ...Object.fromEntries(mediano.sobres.map((s) => [s.key, s.balance])) }}
        onSaved={() => { setMoviendo(false); refresh(); }}
      />
      {confirmDialog}
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function ReconItem({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-300">{label}</span>
      <span className={`tabular ${strong ? "text-paper font-medium" : "text-ink-100"} text-sm`}>
        <AnimatedUsdAmount value={value} />
      </span>
    </div>
  );
}

/** Círculo numerado que identifica el nivel (1/2/3), como en un stepper —
 *  más escaneable de un vistazo que el texto "Nivel N" que tenía antes. */
function StageBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink-100 text-ink-900 text-xs font-bold shrink-0">
      {n}
    </span>
  );
}

function StageHeader({ n, titulo, sub, rate, locked }: {
  n: number; titulo: string; sub: string; rate: React.ReactNode; locked: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <StageBadge n={n} />
          <h2 className="display text-2xl sm:text-3xl text-paper">{titulo}</h2>
        </div>
        <div className="text-xs text-ink-300">{rate}</div>
      </div>
      {locked && <div className="eyebrow mt-1.5">Se activa al completar el piso</div>}
      <p className="text-xs text-ink-300 mt-1 max-w-2xl leading-relaxed">{sub}</p>
    </div>
  );
}

function SobreCard({ sobre, color, fechaObjetivo }: { sobre: SobreResultado; color: string; fechaObjetivo?: string }) {
  const falta = Math.max(0, sobre.objetivo - sobre.balance);
  const plan = fechaObjetivo && !sobre.completo ? aporteMensualNecesario(falta, fechaObjetivo, hoyLocal().slice(0, 7)) : null;
  return (
    <div className={`surface p-5 relative overflow-hidden ${sobre.completo ? "border-moss/40" : ""}`}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="display text-xl text-paper">{sobre.nombre}</span>
        <span className="text-xs text-ink-300 tabular">{sobre.pct}%</span>
      </div>
      <div className="text-xs text-ink-100 mb-2 tabular">
        <b className="text-paper text-body"><AnimatedUsdAmount value={sobre.balance} /></b>
        <span className="text-ink-300"> / <UsdAmount value={sobre.objetivo} /></span>
      </div>
      <ProgressBar progreso={sobre.progreso} color={color} />
      <div className="flex items-center justify-between mt-2.5 text-xs">
        <span className="text-ink-300">{sobre.completo ? "Objetivo cumplido" : "en curso"}</span>
        <span className={`tabular ${sobre.completo ? "text-moss-light" : "text-paper"}`}>
          {Math.round(sobre.progreso * 100)}%
        </span>
      </div>
      {plan && fechaObjetivo && (
        <div className="mt-2 text-xs text-ink-200">
          Para {formatMes(fechaObjetivo)}: ~<UsdAmount value={plan.porMes} />/mes
          <span className="text-ink-300"> ({plan.meses} {plan.meses === 1 ? "mes" : "meses"})</span>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ progreso, color, tall }: { progreso: number; color: string; tall?: boolean }) {
  const pct = Math.max(0, Math.min(1, progreso)) * 100;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-sm border border-ink-600 ${tall ? "h-5" : "h-3.5"}`}
      style={{ background: PALETTE.pista }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function ProjRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-ink-600/50 last:border-0">
      <span className="text-xs text-ink-200">{label}</span>
      <span className="display text-xl text-paper tabular"><UsdAmount value={value} /></span>
    </div>
  );
}

/** Qué entró y salió de cada bucket, filtrable por bucket. */
function Historial({ movimientos, nombres, onBorrarPase }: {
  movimientos: MovimientoAhorro[]; nombres: Record<BucketKey, string>; onBorrarPase: (m: MovimientoAhorro) => void;
}) {
  const [bucket, setBucket] = useState<BucketKey | "">("");
  const [visibles, setVisibles] = useState(15);
  const filas = bucket ? movimientos.filter((m) => m.cambios[bucket] !== undefined) : movimientos;
  if (!movimientos.length) return null;

  return (
    <section className="mt-10" aria-labelledby="historial-titulo">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <div className="eyebrow mb-1">Historial</div>
          <h2 id="historial-titulo" className="display text-2xl sm:text-3xl text-paper">Qué entró y qué salió</h2>
        </div>
        <select
          value={bucket}
          onChange={(e) => { setBucket(e.target.value as BucketKey | ""); setVisibles(15); }}
          aria-label="Filtrar el historial por destino"
          className="select-native min-h-11 bg-ink-800 border border-control text-paper pl-3 pr-9 py-2 text-sm focus:border-amber cursor-pointer"
        >
          <option value="">Todos los destinos</option>
          {(Object.keys(nombres) as BucketKey[]).map((k) => <option key={k} value={k}>{nombres[k]}</option>)}
        </select>
      </div>
      <div className="surface divide-y divide-ink-600/60">
        {filas.length === 0 ? (
          <p className="p-6 text-sm text-ink-300 italic">Sin movimientos para este destino.</p>
        ) : filas.slice(0, visibles).map((m, i) => (
          <div key={`${m.fecha}-${i}`} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0 flex items-start gap-2">
              <div className="min-w-0">
                <div className="text-sm text-paper truncate">{m.concepto}</div>
                <div className="text-xs text-ink-300 tabular font-mono">{formatFecha(m.fecha)}</div>
              </div>
              {m.paseId && (
                <button type="button" onClick={() => onBorrarPase(m)}
                  className="p-2.5 -my-1.5 text-ink-300 hover:text-terra-light shrink-0" aria-label={`Eliminar ${m.concepto}`}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
              {(Object.entries(m.cambios) as Array<[BucketKey, number]>)
                .filter(([k]) => !bucket || k === bucket)
                .map(([k, v]) => (
                  <span key={k} className={`text-xs tabular font-mono whitespace-nowrap ${v >= 0 ? "text-moss-light" : "text-terra-light"}`}>
                    <span className="text-ink-300 font-sans">{nombres[k] ?? k} </span>
                    {v >= 0 ? "+" : "−"}<UsdAmount value={Math.abs(v)} />
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
      {filas.length > visibles && (
        <div className="mt-3 text-center">
          <button type="button" onClick={() => setVisibles((v) => v + 15)}
            className="min-h-11 px-4 text-sm text-ink-200 hover:text-paper">
            Mostrar más ({filas.length - visibles} restantes)
          </button>
        </div>
      )}
    </section>
  );
}

/** Pase de plata entre destinos del ahorro (no cambia la tenencia). */
function PaseDialog({ open, onClose, opciones, saldos, onSaved }: {
  open: boolean;
  onClose: () => void;
  opciones: Array<{ value: BucketKey; label: string }>;
  saldos: Record<string, number>;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} eyebrow="Ahorro" title="Mover entre destinos" size="sm">
      {open && <PaseForm opciones={opciones} saldos={saldos} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function PaseForm({ opciones, saldos, onClose, onSaved }: {
  opciones: Array<{ value: BucketKey; label: string }>;
  saldos: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [desde, setDesde] = useState<string>(opciones.find((o) => (saldos[o.value] ?? 0) > 0)?.value ?? opciones[0]?.value ?? "");
  const [hacia, setHacia] = useState<string>(opciones.find((o) => o.value !== desde)?.value ?? "");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [notas, setNotas] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const disponible = saldos[desde] ?? 0;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const n = parseFloat(monto);
    const e: Partial<Record<string, string>> = {};
    if (!(n > 0)) e.monto = "Poné un monto mayor a 0";
    else if (n > disponible + 0.005) e.monto = "No hay tanto en ese destino";
    if (desde === hacia) e.hacia = "Elegí un destino distinto del origen";
    if (!fecha) e.fecha = "Indicá la fecha";
    if (Object.keys(e).length) { setErrors(e); focusFirstInvalid(formRef.current); return; }
    setSaving(true);
    try {
      await ahorroApi.crearPase({ fecha, desde, hacia, montoUSD: n, notas });
      toast.success("Pase registrado");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.field) { setErrors({ [err.field]: err.message }); focusFirstInvalid(formRef.current); }
      else toast.error(errorMessage(err, "No se pudo registrar el pase"), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      <Field label="Desde" hint={<>Disponible: <UsdAmount value={disponible} /></>}>
        {(c) => (
          <select {...c} value={desde} onChange={(e) => { setDesde(e.target.value); setErrors({}); }} className="form-input">
            {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </Field>
      <Field label="Hacia" error={errors.hacia}>
        {(c) => (
          <select {...c} value={hacia} onChange={(e) => { setHacia(e.target.value); setErrors({}); }} className="form-input">
            {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </Field>
      <Field label="Monto (USD)" required error={errors.monto}>
        {(c) => (
          <input {...c} type="number" step="0.01" min="0" inputMode="decimal" value={monto} data-autofocus
            onChange={(e) => { setMonto(e.target.value); setErrors({}); }} placeholder="0,00" className="form-input tabular font-mono" />
        )}
      </Field>
      <Field label="Fecha" required error={errors.fecha}>
        {(c) => <input {...c} type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} className="form-input tabular" />}
      </Field>
      <Field label="Notas (opcional)">
        {(c) => <input {...c} type="text" maxLength={200} value={notas} onChange={(e) => setNotas(e.target.value)} className="form-input" />}
      </Field>
      <p className="text-xs text-ink-300">Mover plata entre destinos no cambia tu tenencia de dólares.</p>
      <DialogActions>
        <Button variant="fantasma" onClick={onClose}>Cancelar</Button>
        <Button type="submit" isLoading={saving}>Mover</Button>
      </DialogActions>
    </form>
  );
}

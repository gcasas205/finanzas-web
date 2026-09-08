"use client";

import { useMemo } from "react";
import { PiggyBank, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";
import { useAhorro } from "@/components/DataProvider";
import { UsdAmount } from "@/components/UsdAmount";
import { computeAhorro, type SobreResultado } from "@/lib/ahorro-calc";
import type { SobreKey } from "@/types";

const SOBRE_COLOR: Record<SobreKey, string> = {
  auto: "#A04A2F",
  mud: "#6A8970",
  vac: "#D4886E",
  tec: "#E8C982",
};
const EMERG_COLOR = "#C9A24B";
const LARGO_COLOR = "#4E7A6B";

export default function Ahorro() {
  const { dolarOps, transactions, ahorroConfig, isLoading } = useAhorro();

  const r = useMemo(
    () => (ahorroConfig ? computeAhorro(dolarOps, transactions, ahorroConfig) : null),
    [dolarOps, transactions, ahorroConfig],
  );

  if (isLoading || !r || !ahorroConfig) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px]">
        <div className="eyebrow mb-2">Objetivos en moneda dura</div>
        <h1 className="display text-3xl sm:text-5xl text-paper mb-8">Ahorro</h1>
        <div className="text-ink-300 italic">Cargando tu plan de ahorro…</div>
      </div>
    );
  }

  const { emergencia, mediano, largo } = r;
  const ret = ahorroConfig.sp500RetornoAnual * 100;
  const descuadre = Math.abs(r.descuadre) >= 0.5;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px]">
      {/* Header */}
      <header className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <PiggyBank className="w-3.5 h-3.5" strokeWidth={1.5} /> Objetivos en moneda dura
        </div>
        <h1 className="display text-3xl sm:text-5xl text-paper">
          Tu <em className="italic text-amber">ahorro</em>
        </h1>
        <p className="mt-3 text-[13px] text-ink-300 leading-relaxed max-w-2xl">
          Todo sale de tu tenencia de dólares. El piso de emergencia se llena primero; recién ahí
          crecen el mediano y el largo plazo. El reparto y los objetivos se editan en la hoja
          <span className="text-ink-100"> Config</span> del Sheets.
        </p>
      </header>

      {/* Reconciliación */}
      <div className="surface p-4 sm:p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
        <ReconItem label="Tenencia neta" value={r.tenenciaNeta} strong />
        <div className="hidden sm:block flex-1" />
        <ReconItem label="Piso" value={emergencia.balance} />
        <ReconItem label="Mediano" value={mediano.balance} />
        <ReconItem label="Largo" value={largo.balance} />
        <div
          className={`text-[11px] tracking-wide flex items-center gap-1.5 ${descuadre ? "text-terra-light" : "text-moss-light"}`}
        >
          <span className="text-base leading-none">●</span>
          {descuadre ? <>descuadre <UsdAmount value={Math.abs(r.descuadre)} /></> : "asignado = tenencia"}
        </div>
      </div>

      {/* ── Nivel 1: Piso de emergencia ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3">
        <div className="eyebrow text-amber">Nivel 1 · Base</div>
        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 border border-amber/50 text-amber">
          Se llena primero
        </span>
      </div>
      <div className="surface p-5 sm:p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: EMERG_COLOR }} />
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-amber" strokeWidth={1.3} />
            <h2 className="display text-2xl sm:text-3xl text-paper">Piso base de emergencia</h2>
          </div>
          <div className="sm:text-right">
            <div className="display text-3xl sm:text-4xl tabular" style={{ color: EMERG_COLOR }}>
              <UsdAmount value={emergencia.balance} />
            </div>
            <div className="text-[11px] text-ink-300 tabular mt-0.5">
              objetivo <UsdAmount value={emergencia.objetivo} />
            </div>
          </div>
        </div>
        <ProgressBar progreso={emergencia.progreso} color={EMERG_COLOR} tall />
        <div className="mt-4 flex items-center justify-between gap-4 text-[12.5px]">
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
        n="Nivel 2"
        titulo="Mediano plazo"
        sub="El pozo se reparte entre los sobres por los % de la config. Si uno se completa, el excedente pasa a los que faltan."
        rate={<>saldo <b className="text-paper font-medium"><UsdAmount value={mediano.balance} /></b></>}
        locked={!emergencia.completo && mediano.balance <= 0}
      />
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-2 transition-opacity ${!emergencia.completo && mediano.balance <= 0 ? "opacity-40" : ""}`}>
        {mediano.sobres.map((s) => (
          <SobreCard key={s.key} sobre={s} color={SOBRE_COLOR[s.key]} />
        ))}
      </div>
      {mediano.libre > 0.5 && (
        <p className="text-[11.5px] text-amber-light flex items-center gap-2 mb-8">
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
          Excedente sin destino (sobres completos): <UsdAmount value={mediano.libre} />. Conviene sumar un
          objetivo o mandar más al largo plazo.
        </p>
      )}

      {/* ── Nivel 3: Largo plazo ────────────────────────────────────── */}
      <StageHeader
        n="Nivel 3"
        titulo="Largo plazo"
        sub="USD apartados dentro de tu tenencia (no se valúa el S&P acá). La proyección es ilustrativa."
        rate={<>destino S&amp;P 500 · 15–20 años</>}
        locked={!emergencia.completo && largo.balance <= 0}
      />
      <div className={`surface p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 transition-opacity ${!emergencia.completo && largo.balance <= 0 ? "opacity-40" : ""}`}>
        <div>
          <div className="eyebrow mb-2" style={{ color: LARGO_COLOR }}>USD apartados</div>
          <div className="display text-3xl sm:text-4xl tabular" style={{ color: LARGO_COLOR }}>
            <UsdAmount value={largo.balance} />
          </div>
          <div className="text-[12px] text-ink-300 mt-2">
            promedio actual ~<UsdAmount value={largo.aporteMensualProm} />/mes en {largo.mesesConAporte}{" "}
            {largo.mesesConAporte === 1 ? "mes" : "meses"}
          </div>
        </div>
        <div className="lg:border-l lg:border-ink-600/60 lg:pl-10">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} /> Proyección ilustrativa
          </div>
          <ProjRow label="A 15 años" value={largo.proyeccion15} />
          <ProjRow label="A 20 años" value={largo.proyeccion20} />
          <p className="text-[10.5px] text-ink-400 mt-3 leading-relaxed">
            Supone invertir lo apartado y seguir aportando el promedio actual, a un {ret.toFixed(0)}% anual
            nominal (editable en Config). Es solo ilustrativa: el rendimiento real varía y puede ser negativo.
            No es una recomendación de inversión.
          </p>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-ink-400 leading-relaxed max-w-2xl">
        Los aportes se cargan al comprar dólares (pestaña Dólares) o al recibir USD (Movimientos). Los gastos y
        ventas descuentan de un sobre —por la regla automática o el que elijas—. Los objetivos y % viven en la
        hoja Config del Google Sheets.
      </p>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function ReconItem({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ink-300">{label}</span>
      <span className={`tabular ${strong ? "text-paper font-medium" : "text-ink-100"} text-sm`}>
        <UsdAmount value={value} />
      </span>
    </div>
  );
}

function StageHeader({ n, titulo, sub, rate, locked }: {
  n: string; titulo: string; sub: string; rate: React.ReactNode; locked: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="eyebrow mb-2">{n}{locked ? " · se activa al completar el piso" : ""}</div>
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="display text-2xl sm:text-3xl text-paper">{titulo}</h2>
        <div className="text-[12px] text-ink-300">{rate}</div>
      </div>
      <p className="text-[12.5px] text-ink-300 mt-1 max-w-2xl leading-relaxed">{sub}</p>
    </div>
  );
}

function SobreCard({ sobre, color }: { sobre: SobreResultado; color: string }) {
  return (
    <div className={`surface p-5 relative overflow-hidden ${sobre.completo ? "border-moss/40" : ""}`}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="display text-xl text-paper">{sobre.nombre}</span>
        <span className="text-[11px] text-ink-300 tabular">{sobre.pct}%</span>
      </div>
      <div className="text-[13px] text-ink-100 mb-2 tabular">
        <b className="text-paper text-[15px]"><UsdAmount value={sobre.balance} /></b>
        <span className="text-ink-300"> / <UsdAmount value={sobre.objetivo} /></span>
      </div>
      <ProgressBar progreso={sobre.progreso} color={color} />
      <div className="flex items-center justify-between mt-2.5 text-[11px]">
        <span className="text-ink-300">{sobre.completo ? "Objetivo cumplido" : "en curso"}</span>
        <span className={`tabular ${sobre.completo ? "text-moss-light" : "text-paper"}`}>
          {Math.round(sobre.progreso * 100)}%
        </span>
      </div>
    </div>
  );
}

function ProgressBar({ progreso, color, tall }: { progreso: number; color: string; tall?: boolean }) {
  const pct = Math.max(0, Math.min(1, progreso)) * 100;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-sm border border-ink-600 ${tall ? "h-5" : "h-3.5"}`}
      style={{ background: "#1A1916" }}
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
      <span className="text-[12px] text-ink-200">{label}</span>
      <span className="display text-xl text-paper tabular"><UsdAmount value={value} /></span>
    </div>
  );
}

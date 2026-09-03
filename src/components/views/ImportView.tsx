"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CreditCard, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AppConfig, Transaction } from "@/types";
import { formatPesos, formatFecha, formatMes } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categories";
import { useTransactions } from "@/components/DataProvider";

interface Props { config: AppConfig; }

type DocType = "tarjeta" | "sueldo";
type ParseResult = any;

export default function ImportView({ config }: Props) {
  const { refresh } = useTransactions();
  const [docType, setDocType] = useState<DocType>("tarjeta");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  // Lista editable de la vista previa de tarjeta
  const [editedTxs, setEditedTxs] = useState<Transaction[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result?.type === "visa") setEditedTxs(result.transactions ?? []);
    else setEditedTxs([]);
  }, [result]);

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setResult(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("tipo", docType);
      formData.append("action", "preview");
      const r = await fetch("/api/import-pdf", { method: "POST", body: formData });
      const data = await r.json();
      if (data.error) toast.error(data.error);
      else setResult(data.result);
    } catch (e: any) {
      toast.error("Error al procesar: " + (e?.message ?? "desconocido"));
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    if (docType === "tarjeta" && editedTxs.length === 0) {
      toast.error("No quedan movimientos para importar");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", docType);
      formData.append("action", "import");
      if (docType === "tarjeta") {
        // Se manda la lista revisada (editada / sin las filas quitadas)
        formData.append("transactions", JSON.stringify(editedTxs));
      }
      const r = await fetch("/api/import-pdf", { method: "POST", body: formData });
      const data = await r.json();
      if (data.ok) {
        const count = data.imported ?? (docType === "sueldo" ? 1 : editedTxs.length);
        toast.success(`Importados ${count} registros`);
        setResult(null);
        setFile(null);
        refresh();
      } else {
        toast.error(data.error || "Error al importar");
      }
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? "desconocido"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px]">
      <header className="mb-10">
        <div className="eyebrow mb-2">Importar</div>
        <h1 className="display text-3xl sm:text-5xl text-paper">
          Desde tus <em className="italic text-amber">PDFs</em>
        </h1>
        <p className="text-ink-300 text-sm mt-2">
          Subí tu resumen de tarjeta o recibo de sueldo y se parsean automáticamente
        </p>
      </header>

      {/* Doc type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <TypeCard
          active={docType === "tarjeta"}
          onClick={() => { setDocType("tarjeta"); setResult(null); setFile(null); }}
          icon={CreditCard}
          label="Resumen de Tarjeta"
          description="VISA ICBC · Importa todos los consumos como egresos"
        />
        <TypeCard
          active={docType === "sueldo"}
          onClick={() => { setDocType("sueldo"); setResult(null); setFile(null); }}
          icon={FileText}
          label="Recibo de Sueldo"
          description="Detecta bruto, neto y retenciones automáticamente"
        />
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        className={`surface p-8 sm:p-12 text-center cursor-pointer transition-all hover:bg-ink-700/30 group ${
          parsing ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-amber animate-spin" />
            <p className="text-sm text-ink-200">Analizando PDF...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-ink-300 group-hover:text-amber transition-colors" strokeWidth={1.5} />
            <div>
              <p className="text-sm text-paper">{file ? file.name : "Hacé clic para seleccionar un PDF"}</p>
              <p className="text-[11px] text-ink-400 mt-1">o arrastrá el archivo aquí</p>
            </div>
          </div>
        )}
      </div>

      {/* Results preview */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="mt-8"
          >
            {result.type === "visa" && (
              <VisaPreview
                result={result}
                txs={editedTxs}
                onChange={setEditedTxs}
              />
            )}
            {result.type === "sueldo" && <SueldoPreview result={result} />}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 mt-6">
              <button
                onClick={() => { setResult(null); setFile(null); }}
                className="px-5 py-2.5 text-sm text-ink-300 hover:text-paper transition-colors order-2 sm:order-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || (docType === "tarjeta" && editedTxs.length === 0)}
                className="inline-flex items-center justify-center gap-2 bg-moss text-paper px-6 py-2.5 text-sm font-medium hover:bg-moss-light disabled:opacity-50 transition-all order-1 sm:order-2"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {importing
                  ? "Importando..."
                  : docType === "tarjeta"
                    ? `Importar ${editedTxs.length} movimiento${editedTxs.length === 1 ? "" : "s"}`
                    : "Importar todo"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypeCard({ active, onClick, icon: Icon, label, description }: {
  active: boolean; onClick: () => void; icon: any; label: string; description: string;
}) {
  return (
    <button onClick={onClick}
      className={`surface p-6 text-left transition-all ${active ? "border-amber bg-amber/5" : "hover:bg-ink-700/20"}`}>
      <Icon className={`w-5 h-5 mb-3 ${active ? "text-amber" : "text-ink-300"}`} strokeWidth={1.5} />
      <div className={`text-sm mb-1 ${active ? "text-paper" : "text-ink-200"}`}>{label}</div>
      <div className="text-[11px] text-ink-400">{description}</div>
    </button>
  );
}

function VisaPreview({ result, txs, onChange }: {
  result: any; txs: Transaction[]; onChange: (t: Transaction[]) => void;
}) {
  const total = txs.reduce((s, t) => s + t.monto, 0);

  const update = (i: number, patch: Partial<Transaction>) => {
    onChange(txs.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  };
  const remove = (i: number) => onChange(txs.filter((_, idx) => idx !== i));

  return (
    <div className="surface p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <div className="eyebrow mb-1">Vista previa · editable</div>
          <h3 className="display text-2xl text-paper">
            {txs.length} transaccion{txs.length === 1 ? "" : "es"}
          </h3>
          <div className="text-xs text-ink-300 mt-1 space-x-4">
            {result.titular && <span>Titular: {result.titular}</span>}
            {result.cierre && <span>Cierre: {result.cierre}</span>}
            {result.vencimiento && <span>Vencimiento: {result.vencimiento}</span>}
          </div>
          <p className="text-[11px] text-ink-400 mt-2">
            Revisá antes de importar: podés corregir descripción, categoría y monto, o quitar filas con la papelera.
          </p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <div className="eyebrow text-terra mb-1">Total</div>
          <div className="display text-2xl text-terra-light tabular">{formatPesos(total)}</div>
        </div>
      </div>

      <div className="max-h-[28rem] overflow-y-auto overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="hairline-b">
              <th className="eyebrow text-left px-2 py-2">Consumo</th>
              <th className="eyebrow text-left px-2 py-2">Pago</th>
              <th className="eyebrow text-left px-2 py-2">Descripción</th>
              <th className="eyebrow text-left px-2 py-2">Categoría</th>
              <th className="eyebrow text-right px-2 py-2">Monto</th>
              <th className="eyebrow text-right px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx, i) => (
              <tr key={i} className="hairline-b last:border-0">
                <td className="px-2 py-2 text-xs text-ink-200 font-mono tabular whitespace-nowrap">{formatFecha(tx.fechaConsumo)}</td>
                <td className="px-2 py-2 text-xs text-amber font-mono tabular whitespace-nowrap">{formatFecha(tx.fechaPago)}</td>
                <td className="px-2 py-2">
                  <input
                    value={tx.descripcion}
                    onChange={(e) => update(i, { descripcion: e.target.value })}
                    className="w-full bg-transparent border-b border-transparent hover:border-ink-500 focus:border-amber text-sm text-paper py-1 outline-none transition-colors"
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={tx.categoria}
                    onChange={(e) => update(i, { categoria: e.target.value })}
                    className="bg-ink-800 border border-ink-500 text-xs text-ink-100 px-2 py-1 focus:border-amber outline-none cursor-pointer max-w-[130px]"
                  >
                    {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number" step="0.01" value={tx.monto}
                    onChange={(e) => update(i, { monto: parseFloat(e.target.value) || 0 })}
                    className="w-24 bg-transparent border-b border-transparent hover:border-ink-500 focus:border-amber text-sm text-right font-mono tabular text-terra-light py-1 outline-none transition-colors"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => remove(i)}
                    className="p-1.5 text-ink-400 hover:text-terra-light transition-colors"
                    title="Quitar de la importación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {txs.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-ink-300 italic">
                Quitaste todos los movimientos
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SueldoPreview({ result }: { result: any }) {
  const s = result.sueldo;
  if (!s) return <div className="surface p-8 text-ink-300 italic">No se pudo parsear el recibo.</div>;
  return (
    <div className="surface p-4 sm:p-8">
      <div className="eyebrow mb-1">Vista previa · Recibo de sueldo</div>
      <h3 className="display text-2xl text-paper mb-6">{s.empresa || "Empresa"}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 text-sm">
        <Item label="Cargo" value={s.cargo || "—"} />
        <Item label="Período trabajado" value={s.periodoTrabajado ? formatMes(s.periodoTrabajado) : "—"} />
        <Item label="Período de pago" value={s.periodoPago ? formatMes(s.periodoPago) : "—"} accent />
        <Item label="Fecha estimada pago" value={s.fechaPago || "—"} accent />
        <div className="col-span-1 sm:col-span-2 hairline-t mt-2 pt-4" />
        <Item label="Sueldo básico (bruto)" value={formatPesos(s.bruto)} mono />
        <div className="hidden sm:block" />
        <Item label="Jubilación (11%)" value={`-${formatPesos(s.jubilacion)}`} mono />
        <Item label="Ley 19032 (3%)" value={`-${formatPesos(s.ley19032)}`} mono />
        <Item label="Obra Social (3%)" value={`-${formatPesos(s.obraSocial)}`} mono />
        {s.otrosDescuentos > 0 && <Item label="Otros descuentos" value={`-${formatPesos(s.otrosDescuentos)}`} mono />}
        <div className="col-span-1 sm:col-span-2 hairline-t mt-2 pt-4" />
        <div className="col-span-1 sm:col-span-2 flex items-end justify-between">
          <div>
            <div className="eyebrow text-moss-light mb-1">Total neto</div>
            <div className="display text-4xl text-moss-light tabular">{formatPesos(s.neto)}</div>
          </div>
          {s.neto > 0 && (
            <div className="flex items-center gap-2 text-xs text-moss-light">
              <Check className="w-4 h-4" />
              Ingreso en {s.periodoPago ? formatMes(s.periodoPago) : "—"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`${accent ? "text-amber" : "text-paper"} ${mono ? "font-mono tabular" : ""}`}>{value}</div>
    </div>
  );
}
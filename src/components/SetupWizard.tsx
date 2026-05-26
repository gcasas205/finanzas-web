"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { AppConfig } from "@/types";

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Partial<AppConfig>>({
    nombre: "",
    googleSheetId: "",
    googleCredsPath: "",
    mpTna: 27,
    cardCutoffDay: 23,
    cardDueDay: 5,
    salaryPaymentOffsetMonths: 1,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await r.json();
      setTestResult(data.connection);
      if (data.connection?.ok) {
        toast.success("Conexión exitosa con Google Sheets");
      }
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message });
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = async () => {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    toast.success("Configuración guardada");
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="eyebrow mb-3">Bienvenido</div>
          <h1 className="display text-5xl text-paper mb-3">
            Configurá tu <em className="text-amber italic">espacio</em>
          </h1>
          <p className="text-ink-300 text-sm">
            Tres pasos para conectar tu hoja de cálculo y empezar
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-12">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 w-12 transition-all duration-500 ${
                s <= step ? "bg-amber" : "bg-ink-600"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35 }}
            className="surface p-10"
          >
            {step === 1 && (
              <>
                <div className="eyebrow mb-2">Paso 1 · Identidad</div>
                <h2 className="display text-3xl mb-2">¿Cómo te llamás?</h2>
                <p className="text-ink-300 text-sm mb-8">
                  Solo para personalizar el saludo
                </p>

                <input
                  type="text"
                  value={config.nombre}
                  onChange={(e) => setConfig({ ...config, nombre: e.target.value })}
                  placeholder="Tu nombre"
                  autoFocus
                  className="w-full bg-transparent border-0 border-b border-ink-500 text-paper text-2xl py-3 px-0 outline-none focus:border-amber transition-colors display"
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="eyebrow mb-2">Paso 2 · Google Sheets</div>
                <h2 className="display text-3xl mb-2">Conectá tu hoja</h2>
                <p className="text-ink-300 text-sm mb-8 leading-relaxed">
                  Vamos a guardar todos los datos en una hoja de Google Sheets tuya.
                  Necesitás crear una cuenta de servicio en Google Cloud Console y
                  compartir tu planilla con su email.
                </p>

                <div className="space-y-5">
                  <div>
                    <label className="eyebrow block mb-2">Google Sheet ID</label>
                    <input
                      type="text"
                      value={config.googleSheetId}
                      onChange={(e) => setConfig({ ...config, googleSheetId: e.target.value })}
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                      className="w-full bg-ink-900/60 border border-ink-500 text-paper px-4 py-3 outline-none focus:border-amber transition-colors text-sm font-mono"
                    />
                    <p className="text-[11px] text-ink-300 mt-1">
                      Lo encontrás en la URL: docs.google.com/spreadsheets/d/<span className="text-amber">[ID]</span>/edit
                    </p>
                  </div>

                  <div>
                    <label className="eyebrow block mb-2">Ruta al .json de credenciales</label>
                    <input
                      type="text"
                      value={config.googleCredsPath}
                      onChange={(e) => setConfig({ ...config, googleCredsPath: e.target.value })}
                      placeholder="C:\Users\Gonzalo\credenciales.json"
                      className="w-full bg-ink-900/60 border border-ink-500 text-paper px-4 py-3 outline-none focus:border-amber transition-colors text-sm font-mono"
                    />
                  </div>

                  <button
                    onClick={testConnection}
                    disabled={!config.googleSheetId || !config.googleCredsPath || testing}
                    className="mt-2 inline-flex items-center gap-2 text-amber hover:text-amber-light text-sm border border-amber/40 px-4 py-2 hover:bg-amber/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Probar conexión
                  </button>

                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-sm flex items-start gap-2 ${
                        testResult.ok ? "text-moss-light" : "text-terra-light"
                      }`}
                    >
                      {testResult.ok ? (
                        <>
                          <Check className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>Conexión exitosa. Las pestañas se crearán automáticamente.</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{testResult.error}</span>
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="eyebrow mb-2">Paso 3 · Ciclos</div>
                <h2 className="display text-3xl mb-2">Tu ciclo financiero</h2>
                <p className="text-ink-300 text-sm mb-8 leading-relaxed">
                  Para distinguir cuándo realizás un gasto de cuándo realmente lo pagás.
                </p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="eyebrow block mb-2">Día de cierre tarjeta</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={config.cardCutoffDay}
                      onChange={(e) => setConfig({ ...config, cardCutoffDay: parseInt(e.target.value) || 1 })}
                      className="w-full bg-ink-900/60 border border-ink-500 text-paper px-4 py-3 outline-none focus:border-amber font-mono"
                    />
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">Día de vencimiento</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={config.cardDueDay}
                      onChange={(e) => setConfig({ ...config, cardDueDay: parseInt(e.target.value) || 1 })}
                      className="w-full bg-ink-900/60 border border-ink-500 text-paper px-4 py-3 outline-none focus:border-amber font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="eyebrow block mb-2">TNA Mercado Pago (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.mpTna}
                      onChange={(e) => setConfig({ ...config, mpTna: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-ink-900/60 border border-ink-500 text-paper px-4 py-3 outline-none focus:border-amber font-mono"
                    />
                    <p className="text-[11px] text-ink-300 mt-1">
                      Tasa actual ~24-27%. Lo podés actualizar después en Ajustes.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-10 pt-6 hairline-t">
              <button
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
                className="text-ink-300 hover:text-paper transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Atrás
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !config.nombre) ||
                    (step === 2 && (!testResult?.ok))
                  }
                  className="inline-flex items-center gap-2 bg-amber text-ink-900 px-6 py-3 text-sm font-medium hover:bg-amber-light transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continuar <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  className="inline-flex items-center gap-2 bg-moss text-paper px-6 py-3 text-sm font-medium hover:bg-moss-light transition-all"
                >
                  Empezar <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-[11px] text-ink-400 mt-8 tracking-wider uppercase">
          Tus datos viven solo en tu Google Sheets — nada se sube a la nube
        </p>
      </motion.div>
    </div>
  );
}

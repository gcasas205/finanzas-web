"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { AppConfig } from "@/types";
import { configApi, errorMessage } from "@/lib/api";

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
      const data = await configApi.save(config);
      setTestResult(data.connection);
      if (data.connection.ok) {
        toast.success("Conexión exitosa con Google Sheets");
      }
    } catch (e) {
      setTestResult({ ok: false, error: errorMessage(e, "No se pudo probar la conexión") });
    } finally {
      setTesting(false);
    }
  };

  const [finishing, setFinishing] = useState(false);
  const handleFinish = async () => {
    setFinishing(true);
    try {
      await configApi.save(config);
      toast.success("Configuración guardada");
      onComplete();
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar la configuración"), { duration: 7000 });
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="eyebrow mb-3">Bienvenido</div>
          <h1 className="display text-5xl text-paper mb-3">
            Configurá tu <em className="italic">espacio</em>
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
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="surface p-6 sm:p-10"
          >
            {step === 1 && (
              <>
                <div className="eyebrow mb-2">Paso 1 · Identidad</div>
                <h2 className="display text-3xl mb-2">¿Cómo te llamás?</h2>
                <p className="text-ink-300 text-sm mb-8">
                  Solo para personalizar el saludo
                </p>

                <label htmlFor="setup-nombre" className="sr-only">Tu nombre</label>
                <input
                  id="setup-nombre"
                  type="text"
                  value={config.nombre}
                  onChange={(e) => setConfig({ ...config, nombre: e.target.value })}
                  placeholder="Tu nombre"
                  autoFocus
                  className="w-full bg-transparent border-0 border-b border-control text-paper text-2xl py-3 px-0 focus:border-amber transition-colors display placeholder:text-ink-400"
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
                    <label htmlFor="setup-sheet" className="eyebrow block mb-2">Google Sheet ID</label>
                    <input
                      id="setup-sheet"
                      aria-describedby="setup-sheet-hint"
                      type="text"
                      value={config.googleSheetId}
                      onChange={(e) => setConfig({ ...config, googleSheetId: e.target.value })}
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                      className="form-input font-mono"
                    />
                    <p id="setup-sheet-hint" className="text-xs text-ink-300 mt-1">
                      Lo encontrás en la URL: docs.google.com/spreadsheets/d/<span className="text-paper">[ID]</span>/edit
                    </p>
                  </div>

                  <div>
                    <label htmlFor="setup-creds" className="eyebrow block mb-2">Ruta al .json de credenciales</label>
                    <input
                      id="setup-creds"
                      type="text"
                      value={config.googleCredsPath}
                      onChange={(e) => setConfig({ ...config, googleCredsPath: e.target.value })}
                      placeholder="C:\Users\Gonzalo\credenciales.json"
                      className="form-input font-mono"
                    />
                  </div>

                  <button
                    onClick={testConnection}
                    disabled={!config.googleSheetId || !config.googleCredsPath || testing}
                    className="mt-2 inline-flex min-h-11 items-center gap-2 text-paper text-sm border border-control px-4 py-2 hover:border-ink-300 hover:bg-ink-700/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Probar conexión
                  </button>

                  {testResult && (
                    <motion.div
                      role="status"
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
                    <label htmlFor="setup-cierre" className="eyebrow block mb-2">Día de cierre tarjeta</label>
                    <input
                      id="setup-cierre"
                      type="number"
                      min={1}
                      max={31}
                      value={config.cardCutoffDay}
                      onChange={(e) => setConfig({ ...config, cardCutoffDay: parseInt(e.target.value) || 1 })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="setup-venc" className="eyebrow block mb-2">Día de vencimiento</label>
                    <input
                      id="setup-venc"
                      type="number"
                      min={1}
                      max={31}
                      value={config.cardDueDay}
                      onChange={(e) => setConfig({ ...config, cardDueDay: parseInt(e.target.value) || 1 })}
                      className="form-input font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="setup-tna" className="eyebrow block mb-2">TNA Mercado Pago (%)</label>
                    <input
                      id="setup-tna"
                      type="number"
                      step="0.1"
                      value={config.mpTna}
                      onChange={(e) => setConfig({ ...config, mpTna: parseFloat(e.target.value) || 0 })}
                      className="form-input font-mono"
                    />
                    <p className="text-xs text-ink-300 mt-1">
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
                className="min-h-11 text-ink-300 hover:text-paper transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
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
                  className="inline-flex min-h-11 items-center gap-2 bg-amber text-ink-900 px-6 py-3 text-sm font-medium hover:bg-amber-light transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continuar <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={finishing}
                  aria-busy={finishing || undefined}
                  className="inline-flex min-h-11 items-center gap-2 bg-amber text-ink-900 px-6 py-3 text-sm font-medium hover:bg-amber-light transition-all disabled:opacity-50"
                >
                  {finishing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
                  Empezar <Check className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-xs text-ink-300 mt-8">
          Tus datos viven solo en tu Google Sheets — nada se sube a la nube
        </p>
      </motion.div>
    </div>
  );
}

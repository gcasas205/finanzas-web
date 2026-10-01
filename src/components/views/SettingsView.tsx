"use client";

import { useRef, useState } from "react";
import { Check, ExternalLink, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import type { AppConfig } from "@/types";
import { useRouter } from "next/navigation";
import { useRefreshConfig } from "@/components/ConfigProvider";
import { configApi, ApiError, errorMessage, request } from "@/lib/api";
import { descargarArchivo } from "@/lib/csv";
import { hoyLocal } from "@/lib/utils";
import { PlanAhorroSection } from "@/components/views/ajustes/PlanAhorroSection";
import { PresupuestoSection } from "@/components/views/ajustes/PresupuestoSection";
import { CategoriasSection } from "@/components/views/ajustes/CategoriasSection";
import { GastosFijosSection } from "@/components/views/ajustes/GastosFijosSection";
import { Field, focusFirstInvalid } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Props {
  config: AppConfig;
}

type Errors = Partial<Record<keyof AppConfig, string>>;

export default function SettingsView({ config }: Props) {
  const router = useRouter();
  const refreshConfig = useRefreshConfig();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<AppConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    const dia = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;
    if (!dia(form.cardCutoffDay)) e.cardCutoffDay = "El día de cierre va de 1 a 31";
    if (!dia(form.cardDueDay)) e.cardDueDay = "El día de vencimiento va de 1 a 31";
    if (!(form.mpTna >= 0)) e.mpTna = "La TNA no puede ser negativa";
    return e;
  };

  /** Guarda y devuelve el estado de conexión, o null si falló. */
  const save = async () => {
    const found = validate();
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirstInvalid(formRef.current);
      return null;
    }
    try {
      return await configApi.save(form);
    } catch (e) {
      if (e instanceof ApiError && e.field) {
        setErrors({ [e.field]: e.message });
        focusFirstInvalid(formRef.current);
      } else {
        toast.error(errorMessage(e, "No se pudieron guardar los ajustes"), { duration: 7000 });
      }
      return null;
    }
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    const res = await save();
    setSaving(false);
    if (!res) return;
    toast.success("Ajustes guardados");
    refreshConfig(); // la hoja Config ya persistió; refrescamos la config en vivo
    router.refresh();
  };

  const [bajando, setBajando] = useState(false);
  const descargarBackup = async () => {
    setBajando(true);
    try {
      const data = await request<unknown>("/api/backup");
      descargarArchivo(`finanzas-backup-${hoyLocal()}.json`, JSON.stringify(data, null, 2), "application/json");
      toast.success("Backup descargado");
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo armar el backup"), { duration: 7000 });
    } finally {
      setBajando(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestOk(null);
    // Guardar primero para que la prueba use los nuevos datos
    const res = await save();
    setTesting(false);
    if (!res) return;
    setTestOk(res.connection.ok);
    if (res.connection.ok) toast.success("Conexión OK");
    else toast.error(res.connection.error || "No se pudo conectar", { duration: 7000 });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[900px]">
      <header className="mb-10">
        <div className="eyebrow mb-2">Ajustes</div>
        <h1 className="display text-3xl sm:text-5xl text-paper">
          Tu <em className="italic">configuración</em>
        </h1>
      </header>

      <form ref={formRef} onSubmit={handleSave} noValidate className="space-y-8">
        <Section title="Perfil" eyebrow="Identidad">
          <Field label="Nombre" error={errors.nombre}>
            {(c) => (
              <input {...c} type="text" value={form.nombre} maxLength={40}
                onChange={e => update("nombre", e.target.value)} className="form-input" />
            )}
          </Field>
        </Section>

        <Section title="Google Sheets" eyebrow="Base de datos">
          <Field
            label="Google Sheet ID"
            error={errors.googleSheetId}
            hint={<>URL: docs.google.com/spreadsheets/d/<span className="text-paper">[este ID]</span>/edit</>}
          >
            {(c) => (
              <input {...c} type="text" value={form.googleSheetId}
                onChange={e => update("googleSheetId", e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjg…"
                className="form-input font-mono" />
            )}
          </Field>
          <Field label="Ruta al .json de credenciales" error={errors.googleCredsPath}>
            {(c) => (
              <input {...c} type="text" value={form.googleCredsPath}
                onChange={e => update("googleCredsPath", e.target.value)}
                placeholder="C:\Users\...\credenciales.json"
                className="form-input font-mono" />
            )}
          </Field>
          <div className="flex items-start gap-2 text-xs text-ink-300 leading-relaxed border-l border-control pl-3">
            <AlertCircle className="w-4 h-4 text-ink-300 mt-0.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>
              El <span className="text-ink-200">Sheet ID</span> y las
              <span className="text-ink-200"> credenciales</span> son datos de arranque:
              en Vercel se toman de las variables de entorno y editarlos acá no persiste
              (harían falta para poder leer la propia hoja). El resto de los ajustes
              —nombre, TNA y los días de tarjeta— sí se guardan en la hoja Config e impactan al instante.
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2" aria-live="polite">
            <Button variant="secundario" onClick={handleTest} isLoading={testing}>
              Probar conexión
            </Button>
            {testOk === true && <span className="text-sm text-moss-light flex items-center gap-1"><Check className="w-4 h-4" aria-hidden="true" /> Conectado</span>}
            {testOk === false && <span className="text-sm text-terra-light flex items-center gap-1"><AlertCircle className="w-4 h-4" aria-hidden="true" /> Sin conexión</span>}
          </div>
        </Section>

        <Section title="Ciclos financieros" eyebrow="Tarjeta y sueldo">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Día cierre tarjeta" error={errors.cardCutoffDay} hint="Día del mes en que cierra el resumen">
              {(c) => (
                <input {...c} type="number" min={1} max={31} inputMode="numeric" value={Number.isFinite(form.cardCutoffDay) ? form.cardCutoffDay : ""}
                  onChange={e => update("cardCutoffDay", parseInt(e.target.value, 10))}
                  className="form-input font-mono" />
              )}
            </Field>
            <Field label="Día vencimiento pago" error={errors.cardDueDay} hint="Día en que vence el pago del resumen">
              {(c) => (
                <input {...c} type="number" min={1} max={31} inputMode="numeric" value={Number.isFinite(form.cardDueDay) ? form.cardDueDay : ""}
                  onChange={e => update("cardDueDay", parseInt(e.target.value, 10))}
                  className="form-input font-mono" />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Mercado Pago" eyebrow="Inversión">
          <Field
            label="TNA (%)"
            error={errors.mpTna}
            hint="Consultá la tasa en la app de Mercado Pago → Dinero disponible → Rendimiento."
          >
            {(c) => (
              <input {...c} type="number" step={0.1} min={0} inputMode="decimal" value={Number.isFinite(form.mpTna) ? form.mpTna : ""}
                onChange={e => update("mpTna", parseFloat(e.target.value))}
                className="form-input font-mono" />
            )}
          </Field>
          <a href="https://www.mercadopago.com.ar/" target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-200 hover:text-paper link-underline">
            Abrir Mercado Pago <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </Section>

        <div className="pt-6 hairline-t flex justify-end">
          <Button type="submit" isLoading={saving}>
            {!saving && <Check className="w-4 h-4" aria-hidden="true" />}
            Guardar ajustes
          </Button>
        </div>
      </form>

      <PlanAhorroSection />
      <PresupuestoSection />
      <GastosFijosSection />
      <CategoriasSection />

      <section className="surface p-5 sm:p-8 mt-8">
        <div className="eyebrow mb-1">Tus datos</div>
        <h2 className="display text-2xl text-paper mb-2">Copia de seguridad</h2>
        <p className="text-xs text-ink-300 leading-relaxed mb-5 max-w-xl">
          Descargá todo lo que está en la planilla (movimientos, sueldos, dólares y ajustes) en un archivo.
          No incluye los datos de conexión. Guardalo en un lugar seguro: tiene tu información financiera.
        </p>
        <Button variant="secundario" onClick={descargarBackup} isLoading={bajando}>
          {!bajando && <Download className="w-4 h-4" aria-hidden="true" />}
          Descargar backup
        </Button>
      </section>
    </div>
  );
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5 sm:p-8">
      <div className="eyebrow mb-1">{eyebrow}</div>
      <h2 className="display text-2xl text-paper mb-6">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

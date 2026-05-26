"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { AppConfig } from "@/types";

interface Props {
  config: AppConfig;
  onSaved: (c: AppConfig) => void;
}

export default function SettingsView({ config, onSaved }: Props) {
  const [form, setForm] = useState<AppConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const update = (key: keyof AppConfig, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      onSaved(data.config);
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestOk(null);
    // Guardar primero para que la prueba use los nuevos datos
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const r = await fetch("/api/config");
    const data = await r.json();
    setTestOk(data.connection?.ok ?? false);
    setTesting(false);
    if (data.connection?.ok) toast.success("Conexión OK");
    else toast.error(data.connection?.error || "Error de conexión");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[900px]">
      <header className="mb-10">
        <div className="eyebrow mb-2">Ajustes</div>
        <h1 className="display text-3xl sm:text-5xl text-paper">
          Tu <em className="italic text-amber">configuración</em>
        </h1>
      </header>

      <div className="space-y-8">
        {/* Profile */}
        <Section title="Perfil" eyebrow="Identidad">
          <Field label="Nombre">
            <input type="text" value={form.nombre} onChange={e => update("nombre", e.target.value)}
              className="form-input" />
          </Field>
        </Section>

        {/* Google Sheets */}
        <Section title="Google Sheets" eyebrow="Base de datos">
          <Field label="Google Sheet ID">
            <input type="text" value={form.googleSheetId} onChange={e => update("googleSheetId", e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjg..."
              className="form-input font-mono text-xs" />
            <p className="text-[10px] text-ink-400 mt-1">
              URL: docs.google.com/spreadsheets/d/<span className="text-amber">[este ID]</span>/edit
            </p>
          </Field>
          <Field label="Ruta al .json de credenciales">
            <input type="text" value={form.googleCredsPath} onChange={e => update("googleCredsPath", e.target.value)}
              placeholder="C:\Users\...\credenciales.json"
              className="form-input font-mono text-xs" />
          </Field>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={handleTest} disabled={testing}
              className="inline-flex items-center gap-2 text-xs text-amber border border-amber/40 px-4 py-2 hover:bg-amber/5 transition-all disabled:opacity-50">
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Probar conexión
            </button>
            {testOk === true && <span className="text-xs text-moss-light flex items-center gap-1"><Check className="w-3 h-3" /> OK</span>}
            {testOk === false && <span className="text-xs text-terra-light flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Error</span>}
          </div>
        </Section>

        {/* Financial cycles */}
        <Section title="Ciclos financieros" eyebrow="Tarjeta y sueldo">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Día cierre tarjeta">
              <input type="number" min={1} max={31} value={form.cardCutoffDay}
                onChange={e => update("cardCutoffDay", parseInt(e.target.value) || 1)}
                className="form-input font-mono" />
              <p className="text-[10px] text-ink-400 mt-1">Día del mes en que cierra el resumen</p>
            </Field>
            <Field label="Día vencimiento pago">
              <input type="number" min={1} max={31} value={form.cardDueDay}
                onChange={e => update("cardDueDay", parseInt(e.target.value) || 1)}
                className="form-input font-mono" />
              <p className="text-[10px] text-ink-400 mt-1">Día en que vence el pago del resumen</p>
            </Field>
          </div>
        </Section>

        {/* Mercado Pago */}
        <Section title="Mercado Pago" eyebrow="Inversión">
          <Field label="TNA (%)">
            <input type="number" step={0.1} value={form.mpTna}
              onChange={e => update("mpTna", parseFloat(e.target.value) || 0)}
              className="form-input font-mono" />
            <p className="text-[10px] text-ink-400 mt-1">
              Tasa actual: ~24-27%. Consultá en la app de Mercado Pago → Dinero disponible → Rendimiento.
            </p>
          </Field>
          <a href="https://www.mercadopago.com.ar/" target="_blank" rel="noopener"
            className="inline-flex items-center gap-2 text-xs text-amber hover:text-amber-light link-underline mt-1">
            Abrir Mercado Pago <ExternalLink className="w-3 h-3" />
          </a>
        </Section>

        {/* Save */}
        <div className="pt-6 hairline-t flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 bg-amber text-ink-900 px-6 py-3 text-sm font-medium hover:bg-amber-light disabled:opacity-50 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar configuración
          </button>
        </div>
      </div>

      <style jsx global>{`
        .form-input {
          width: 100%;
          background: rgba(13, 18, 13, 0.6);
          border: 1px solid #3A3833;
          color: #F4F1EA;
          padding: 10px 14px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus { border-color: #C9A24B; }
      `}</style>
    </div>
  );
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="surface p-8">
      <div className="eyebrow mb-1">{eyebrow}</div>
      <h3 className="display text-2xl text-paper mb-6">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow block mb-2">{label}</label>
      {children}
    </div>
  );
}

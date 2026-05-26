"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Upload,
  Settings,
  LogOut,
} from "lucide-react";
import Dashboard from "./views/Dashboard";
import Transactions from "./views/Transactions";
import Analytics from "./views/Analytics";
import ImportView from "./views/ImportView";
import SettingsView from "./views/SettingsView";
import type { AppConfig } from "@/types";

type View = "dashboard" | "transactions" | "analytics" | "import" | "settings";

const NAV_ITEMS: Array<{ id: View; label: string; icon: any; description: string }> = [
  { id: "dashboard",    label: "Resumen",       icon: LayoutDashboard, description: "Vista general" },
  { id: "transactions", label: "Movimientos",   icon: ArrowLeftRight,  description: "Ingresos y gastos" },
  { id: "analytics",    label: "Análisis",      icon: TrendingUp,      description: "Tendencias y BI" },
  { id: "import",       label: "Importar",      icon: Upload,          description: "PDFs y archivos" },
  { id: "settings",     label: "Ajustes",       icon: Settings,        description: "Configuración" },
];

export default function AppShell({ initialConfig }: { initialConfig: AppConfig }) {
  const [view, setView] = useState<View>("dashboard");
  const [config, setConfig] = useState(initialConfig);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hairline-b sm:hairline-b-0 sm:border-r sm:border-ink-600/60 sm:min-h-screen">
        <div className="sticky top-0 p-8 flex flex-col h-screen">
          {/* Logo */}
          <div className="mb-12">
            <div className="eyebrow mb-1">Finanzas</div>
            <h1 className="display text-3xl text-paper leading-none">
              {config.nombre || "Casas"}
              <span className="text-amber italic">.</span>
            </h1>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`w-full text-left group relative px-3 py-2.5 transition-all ${
                    isActive ? "text-paper" : "text-ink-300 hover:text-paper"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-ink-700/50 border-l-2 border-amber"
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <div className="relative flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <div className="flex-1">
                      <div className="text-sm">{item.label}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="pt-6 hairline-t space-y-3">
            <UserBadge />
            <div className="text-[10px] text-ink-300 tracking-widest uppercase">
              v1.0 · Edición Personal
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {view === "dashboard" && <Dashboard config={config} />}
          {view === "transactions" && <Transactions config={config} />}
          {view === "analytics" && <Analytics config={config} />}
          {view === "import" && <ImportView config={config} />}
          {view === "settings" && <SettingsView config={config} onSaved={setConfig} />}
        </motion.div>
      </main>
    </div>
  );
}

function UserBadge() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const initials = (session.user.name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-ink-600 flex items-center justify-center shrink-0">
        <span className="text-[10px] text-ink-200 font-medium">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-paper truncate">
          {session.user.name}
        </div>
        <div className="text-[9px] text-ink-400 truncate">
          {session.user.email}
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-ink-400 hover:text-terra-light transition-colors p-1"
        title="Cerrar sesión"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
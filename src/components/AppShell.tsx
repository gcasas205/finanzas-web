"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  DollarSign,
  PiggyBank,
} from "lucide-react";
import { DataProvider } from "./DataProvider";
import type { AppConfig } from "@/types";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Resumen",     icon: LayoutDashboard },
  { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/dolares",      label: "Dólares",     icon: DollarSign },
  { href: "/ahorro",       label: "Ahorro",      icon: PiggyBank },
  { href: "/analytics",    label: "Análisis",    icon: TrendingUp },
  { href: "/import",       label: "Importar",    icon: Upload },
  { href: "/settings",     label: "Ajustes",     icon: Settings },
];

export default function AppShell({ initialConfig, children }: { initialConfig: AppConfig, children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DataProvider>
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 hairline-b bg-ink-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="text-ink-200 p-1">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="display text-lg text-paper leading-none">
            {initialConfig.nombre || "Finanzas"}<span className="text-amber italic">.</span>
          </h1>
        </div>
        <div className="eyebrow text-[9px]">
          {NAV_ITEMS.find(n => pathname.startsWith(n.href))?.label}
        </div>
      </div>

      {/* ── Mobile drawer overlay ───────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink-900/70 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 left-0 bottom-0 w-[270px] bg-ink-900 border-r border-ink-600/60 z-50 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 pb-4">
                <div>
                  <div className="eyebrow mb-1">Finanzas</div>
                  <h1 className="display text-2xl text-paper leading-none">
                    {initialConfig.nombre || "Casas"}<span className="text-amber italic">.</span>
                  </h1>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-ink-300 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`block w-full text-left relative px-4 py-3 rounded-sm transition-all ${
                        isActive ? "text-paper bg-ink-700/50" : "text-ink-300"
                      }`}
                    >
                      {isActive && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-amber" />}
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-5 hairline-t space-y-3">
                <UserBadge />
                <div className="text-[10px] text-ink-300 tracking-widest uppercase">
                  v3.3 · Edición Personal
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-ink-600/60 min-h-screen">
        <div className="sticky top-0 p-8 flex flex-col h-screen">
          <div className="mb-12">
            <div className="eyebrow mb-1">Finanzas</div>
            <h1 className="display text-3xl text-paper leading-none">
              {initialConfig.nombre || "Casas"}
              <span className="text-amber italic">.</span>
            </h1>
          </div>

          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block w-full text-left group relative px-3 py-2.5 transition-all ${
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
                    <span className="text-sm">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="pt-6 hairline-t space-y-3">
            <UserBadge />
            <div className="text-[10px] text-ink-300 tracking-widest uppercase">
              v3.3 · Edición Personal
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-ink-900/95 backdrop-blur-md hairline-t z-40 flex">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                isActive ? "text-amber" : "text-ink-400 hover:text-ink-300"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-[10px] tracking-wider uppercase font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {children}
      </main>
    </div>
    </DataProvider>
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
        <div className="text-[11px] text-paper truncate">{session.user.name}</div>
        <div className="text-[9px] text-ink-400 truncate">{session.user.email}</div>
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
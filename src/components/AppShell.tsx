"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
  MoreHorizontal,
  DollarSign,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";
import { DataProvider } from "./DataProvider";
import { useConfig } from "./ConfigProvider";
import { Dialog } from "./ui/Dialog";
import { cn } from "@/lib/utils";
import type { AppConfig } from "@/types";

interface NavItem {
  href: string;
  label: string;
  /** Etiqueta corta para la barra inferior móvil (5 pestañas en 320px). */
  short: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",    label: "Resumen",     short: "Resumen", icon: LayoutDashboard },
  { href: "/transactions", label: "Movimientos", short: "Movim.",  icon: ArrowLeftRight },
  { href: "/dolares",      label: "Dólares",     short: "Dólares", icon: DollarSign },
  { href: "/ahorro",       label: "Ahorro",      short: "Ahorro",  icon: PiggyBank },
  { href: "/analytics",    label: "Análisis",    short: "Análisis", icon: TrendingUp },
  { href: "/import",       label: "Importar",    short: "Importar", icon: Upload },
  { href: "/settings",     label: "Ajustes",     short: "Ajustes", icon: Settings },
];

/** En celular: 4 destinos principales + "Más" (el resto). */
const MOBILE_MAIN = NAV_ITEMS.slice(0, 4);
const MOBILE_MORE = NAV_ITEMS.slice(4);

const isActive = (pathname: string, href: string) => pathname.startsWith(href);

export default function AppShell({ initialConfig, children }: { initialConfig: AppConfig, children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Nombre en vivo (Ajustes lo persiste en la hoja Config); fallback al del SSR.
  const nombre = useConfig().nombre || initialConfig.nombre;
  const current = NAV_ITEMS.find(n => isActive(pathname, n.href));
  const moreActive = MOBILE_MORE.some(n => isActive(pathname, n.href));

  return (
    <DataProvider>
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-paper focus:px-4 focus:py-3 focus:text-sm focus:text-ink-900"
    >
      Saltar al contenido
    </a>
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Mobile top bar ──────────────────────────────────── */}
      <header className="lg:hidden flex items-center justify-between px-4 h-14 hairline-b bg-ink-900/80 backdrop-blur-md sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <Link href="/dashboard" className="display text-lg text-paper leading-none">
          {nombre || "Finanzas"}<span className="text-amber italic">.</span>
        </Link>
        {current && <div className="eyebrow">{current.label}</div>}
      </header>

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-ink-600/60 min-h-screen">
        <div className="sticky top-0 p-8 flex flex-col h-screen">
          <div className="mb-12">
            <div className="eyebrow mb-1">Finanzas</div>
            <div className="display text-3xl text-paper leading-none">
              {nombre || "Casas"}
              <span className="text-amber italic">.</span>
            </div>
          </div>

          <nav aria-label="Principal" className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 w-full items-center text-left group relative px-3 transition-colors",
                    active ? "text-paper" : "text-ink-300 hover:text-paper",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-ink-700/50 border-l-2 border-amber"
                      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <div className="relative flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="pt-6 hairline-t space-y-3">
            <UserBadge />
            <div className="text-xs text-ink-300">v5.1 · Edición personal</div>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav: 5 pestañas, activo en píldora de marca ── */}
      <nav
        aria-label="Principal"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-ink-900/95 backdrop-blur-md hairline-t z-40 flex pb-[env(safe-area-inset-bottom)]"
      >
        {MOBILE_MAIN.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "flex-1 flex min-h-16 flex-col items-center justify-center gap-1 transition-colors",
            moreActive ? "text-paper" : "text-ink-300 hover:text-paper",
          )}
        >
          <TabIcon icon={MoreHorizontal} active={moreActive} />
          <span className="text-xs">Más</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Más" size="sm">
        <nav aria-label="Más secciones" className="-mx-2 space-y-1">
          {MOBILE_MORE.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 px-3 transition-colors",
                  active ? "bg-ink-700/50 text-paper border-l-2 border-amber" : "text-ink-200 hover:text-paper",
                )}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 pt-5 hairline-t">
          <UserBadge />
        </div>
      </Dialog>

      {/* ── Main content ────────────────────────────────────── */}
      <main
        id="contenido"
        tabIndex={-1}
        className="flex-1 min-w-0 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-0 focus:outline-none"
      >
        {children}
      </main>
    </div>
    </DataProvider>
  );
}

function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors",
        active && "bg-amber text-ink-900",
      )}
    >
      <Icon className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "flex-1 flex min-h-16 flex-col items-center justify-center gap-1 transition-colors",
        active ? "text-paper" : "text-ink-300 hover:text-paper",
      )}
    >
      <TabIcon icon={item.icon} active={active} />
      <span className="text-xs" aria-hidden="true">{item.short}</span>
    </Link>
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
      <div className="w-8 h-8 rounded-full bg-ink-600 flex items-center justify-center shrink-0" aria-hidden="true">
        <span className="text-xs text-ink-200 font-medium">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-paper truncate">{session.user.name}</div>
        <div className="text-xs text-ink-300 truncate">{session.user.email}</div>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-ink-300 hover:text-terra-light transition-colors p-3 -m-2"
        aria-label="Cerrar sesión"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

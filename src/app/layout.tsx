import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finanzas — Casas",
  description: "Seguimiento financiero personal",
  applicationName: "Finanzas",
  // iPhone: "Agregar a inicio" abre la app a pantalla completa con este ícono.
  // black-translucent: el contenido va detrás de la barra de estado (la barra
  // superior ya reserva env(safe-area-inset-top)).
  // Los íconos salen de los archivos de app/: icon.svg y apple-icon.png.
  appleWebApp: { capable: true, title: "Finanzas", statusBarStyle: "black-translucent" },
};

// viewport-fit=cover: la barra inferior móvil respeta env(safe-area-inset-bottom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0F0D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${jetbrains.variable}`}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster
          position="bottom-right"
          theme="dark"
          visibleToasts={3}
          duration={4500}
          toastOptions={{
            style: {
              background: "var(--toast-bg)",
              border: "1px solid var(--toast-border)",
              borderRadius: "2px",
              color: "var(--toast-text)",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}

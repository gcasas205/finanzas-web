import type { Metadata } from "next";
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
          toastOptions={{
            style: {
              background: "#13120F",
              border: "1px solid #3A3833",
              borderRadius: "2px",
              color: "#F4F1EA",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}

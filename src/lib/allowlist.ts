/**
 * Emails autorizados (variable ALLOWED_EMAILS, separada por comas).
 * Falla cerrado: si la lista está vacía, nadie entra. Antes, sin la variable,
 * cualquier cuenta de Google podía leer y escribir la planilla.
 */
export function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

/** Sólo rutas internas ("/algo"), nunca "//dominio" ni URLs absolutas: evita redirecciones abiertas. */
export function safeInternalPath(path: string | null | undefined, fallback = "/"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}

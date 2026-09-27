import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isEmailAllowed } from "@/lib/allowlist";

/**
 * Protege todas las rutas excepto /login, /api/auth/* y estáticos.
 * - Páginas sin sesión → /login?callbackUrl=<ruta actual>.
 * - API sin sesión → 401 JSON (antes era un redirect: el fetch recibía HTML y
 *   `r.json()` explotaba con un error genérico).
 * - La lista ALLOWED_EMAILS se vuelve a chequear en cada request, así sacar un
 *   email de la lista corta el acceso sin esperar a que venza su sesión (30 días).
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  if (token && isEmailAllowed(token.email)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { detail: "Tu sesión venció. Ingresá de nuevo.", code: "unauthorized" },
      { status: 401 },
    );
  }

  const login = new URL("/login", req.url);
  login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  if (token) login.searchParams.set("error", "AccessDenied");
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas salvo:
     * - /login
     * - /api/auth (endpoints de NextAuth)
     * - /_next/static, /_next/image (archivos estáticos)
     * - /favicon.ico, /icon.svg
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|icon\\.svg).*)",
  ],
};

export { default } from "next-auth/middleware";

/**
 * Protege todas las rutas excepto:
 * - /login (página de login)
 * - /api/auth/* (endpoints de NextAuth)
 * - /_next/* (archivos estáticos de Next.js)
 * - /favicon.ico
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login
     * - /api/auth (NextAuth endpoints)
     * - /_next/static (static files)
     * - /_next/image (image optimization)
     * - /favicon.ico
     */
    "/((?!login|api/auth|api/health|_next/static|_next/image|favicon\\.ico).*)",
  ],
};

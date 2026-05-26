import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Emails permitidos. Solo estas cuentas de Google pueden iniciar sesión.
 * Configurá la variable de entorno ALLOWED_EMAILS con una lista separada por comas.
 * Ej: ALLOWED_EMAILS="gonzalo@gmail.com,otro@gmail.com"
 *
 * Si no se configura, CUALQUIER cuenta de Google puede entrar (no recomendado).
 */
function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /**
     * Controla quién puede iniciar sesión.
     * Si ALLOWED_EMAILS está configurado, solo esos emails pueden entrar.
     */
    async signIn({ user }) {
      const allowed = getAllowedEmails();
      if (allowed.length === 0) return true; // Sin whitelist → todos entran
      return allowed.includes(user.email?.toLowerCase() ?? "");
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
});

export { handler as GET, handler as POST };

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getAllowedEmails, isEmailAllowed } from "@/lib/allowlist";

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
     * Controla quién puede iniciar sesión: sólo los emails de ALLOWED_EMAILS.
     * Sin la variable no entra nadie (falla cerrado).
     */
    async signIn({ user }) {
      if (getAllowedEmails().length === 0) {
        console.error("[auth] ALLOWED_EMAILS está vacío: se rechaza el ingreso. Configurá la variable.");
        return false;
      }
      return isEmailAllowed(user.email);
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { id?: string }).id = token.sub;
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

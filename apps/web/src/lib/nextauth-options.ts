import { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail } from "@/lib/auth-db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  pages: { signIn: "/signin" },           // use your custom page
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const row = await findUserByEmail(String(creds.email));
        if (!row) return null;

        // verify password
        const ok = await bcrypt.compare(String(creds.password), row.password_hash);
        if (!ok) return null;

        // derive fields robustly
        const displayName =
          row.name ??
          (row.first_name || row.last_name
            ? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()
            : row.username ?? String(row.email).split("@")[0]);

        const role =
          row.role ??
          (typeof row.is_admin === "boolean" ? (row.is_admin ? "admin" : "user") : "user");

        // Get user's team from the team column (defaults to 'esg' if not set)
        const team = row.team ?? row.default_domain ?? "esg";

        return {
          id: String(row.id),
          name: displayName,
          email: row.email,
          role,
          team,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role ?? "user";
        token.team = (user as any).team ?? "esg";
        token.is_admin = (user as any).role === "admin";
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).role = token.role ?? "user";
      (session as any).team = token.team ?? "esg";
      (session as any).is_admin = token.is_admin ?? false;
      // add id and is_admin to user object for convenience
      if (token?.sub) (session.user as any).id = token.sub;
      (session.user as any).role = token.role ?? "user";
      (session.user as any).team = token.team ?? "esg";
      (session.user as any).is_admin = token.is_admin ?? false;
      return session;
    },
  },
};
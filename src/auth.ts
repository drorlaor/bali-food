import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { ensureDb } from "@/db/seed";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Minimal scopes only - keeps Google Family Link from triggering parent re-verification.
      authorization: { params: { scope: "openid email profile", prompt: "select_account" } },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = (profile?.email || user.email || "").toLowerCase().trim();
      if (!email) return false;
      await ensureDb();
      const db = getDb();
      const existing = await db.select().from(users).where(eq(users.email, email)).get();
      const avatar = (profile?.picture as string | undefined) || user.image || null;
      if (existing) {
        if (!existing.isActive) return false;
        if (avatar && avatar !== existing.avatarUrl) {
          await db.update(users).set({ avatarUrl: avatar }).where(eq(users.id, existing.id));
        }
        return true;
      }
      const initialParents = (process.env.INITIAL_PARENT_EMAIL || "")
        .toLowerCase()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (initialParents.includes(email)) {
        await db.insert(users).values({
          id: crypto.randomUUID(),
          email,
          displayName: user.name || "הורה",
          role: "parent",
          avatarUrl: avatar,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        return true;
      }
      return false;
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email.toLowerCase();
      return token;
    },
    async session({ session, token }) {
      if (token.email && session.user) session.user.email = token.email as string;
      return session;
    },
  },
});

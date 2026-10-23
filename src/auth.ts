import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { checkAccess } from "@/server/access";

/**
 * Email-only sign-in so Playwright can cross the real allowlist check without Google.
 * Never enabled on Vercel, and refuses any request not addressed to localhost.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export const e2eLoginEnabled = process.env.E2E_TEST_LOGIN === "1" && !process.env.VERCEL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ authorization: { params: { hd: "delightree.com", prompt: "select_account" } } }),
    ...(e2eLoginEnabled
      ? [
          Credentials({
            id: "e2e",
            credentials: { email: {} },
            authorize: ({ email }, request) =>
              LOCAL_HOSTS.has(new URL(request.url).hostname) ? { email: String(email) } : null,
          }),
        ]
      : []),
  ],
  pages: { signIn: "/sign-in", error: "/sign-in" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && (!profile?.email_verified || profile.hd !== "delightree.com")) return false;
      return !!user.email && (await checkAccess(user.email)).allowed;
    },
  },
});

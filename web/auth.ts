import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authorizeCredentials } from "@/lib/auth/authorize-credentials";
import {
  mergeCredentialsIntoJwt,
  mergeJwtIntoSession,
} from "@/lib/auth/next-auth-credential-bridge";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) =>
        authorizeCredentials(credentials?.email, credentials?.password),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      mergeCredentialsIntoJwt(token, user);
      return token;
    },
    session({ session, token }) {
      mergeJwtIntoSession(session, token);
      return session;
    },
  },
});

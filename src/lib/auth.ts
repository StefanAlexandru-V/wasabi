import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      authorization: {
        params: {
          scope: "read:org repo",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const account = await prisma.account.findFirst({
        where: { userId: user.id!, provider: "github" },
      });
      if (account) {
        await prisma.user.update({
          where: { id: user.id! },
          data: { githubId: account.providerAccountId },
        });
      }
    },
    async linkAccount({ account }) {
      if (account.provider === "github" && account.access_token) {
        try {
          const encrypted = encrypt(account.access_token);
          await prisma.account.update({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            data: { access_token: encrypted },
          });
        } catch {
          // TOKEN_ENCRYPTION_KEY not set — token stored as-is
        }
      }
    },
  },
  pages: {
    signIn: "/",
  },
});

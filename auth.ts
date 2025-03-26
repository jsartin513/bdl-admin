import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const GOOGLE_OAUTH_ID = process.env.AUTH_GOOGLE_ID;
const GOOGLE_OAUTH_SECRET = process.env.AUTH_GOOGLE_SECRET;


export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: GOOGLE_OAUTH_ID,
      clientSecret: GOOGLE_OAUTH_SECRET,
      authorization: {
        params: {
          scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets.readonly openid email profile',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}
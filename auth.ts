import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const GOOGLE_OAUTH_ID = process.env.AUTH_GOOGLE_ID;
const GOOGLE_OAUTH_SECRET = process.env.AUTH_GOOGLE_SECRET;

const cookiePrefix = process.env.NODE_ENV === "development" ? "" : "__Secure-";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: GOOGLE_OAUTH_ID,
      clientSecret: GOOGLE_OAUTH_SECRET,
      authorization: {
        params: {
          scope:
            "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets.readonly openid email profile",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
      checks: ["state"],
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresIn = account.expires_in;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        session.accessToken = token.accessToken;
      }
      if (token?.refreshToken) {
        session.refreshToken = typeof token.refreshToken === "string" ? token.refreshToken : undefined;
      }
      if (token?.expiresIn) {
        const expiresAt = new Date(Date.now() + Number(token.expiresIn) * 1000);
        session.expiresAt = expiresAt;
      }
      return session;
    },
  },
  cookies: {
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
        maxAge: 900,
      },
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
        maxAge: 900,
      },
    },
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
  },
});

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}

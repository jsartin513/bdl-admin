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
            "https://www.googleapis.com/auth/spreadsheets.readonly openid email profile",
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
        token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
      }
      
      // Check if token is expired and refresh if needed
      if (token.accessToken && token.refreshToken && token.expiresAt) {
        const now = Date.now();
        const expiresAt = typeof token.expiresAt === 'number' ? token.expiresAt : Date.now();
        
        // Refresh token if it expires in the next 5 minutes
        if (now >= expiresAt - 5 * 60 * 1000) {
          try {
            console.log('Refreshing expired access token...');
            
            const response = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: GOOGLE_OAUTH_ID!,
                client_secret: GOOGLE_OAUTH_SECRET!,
                refresh_token: token.refreshToken as string,
                grant_type: 'refresh_token',
              }),
            });
            
            if (!response.ok) {
              throw new Error(`Token refresh failed: ${response.status}`);
            }
            
            const refreshedTokens = await response.json();
            
            token.accessToken = refreshedTokens.access_token;
            token.expiresAt = now + refreshedTokens.expires_in * 1000;
            
            // Google may return a new refresh token, use it if available
            if (refreshedTokens.refresh_token) {
              token.refreshToken = refreshedTokens.refresh_token;
            }
            
            console.log('Token refreshed successfully');
          } catch (error) {
            console.error('Error refreshing token:', error);
            // Token refresh failed, user will need to re-authenticate
            token.accessToken = undefined;
            token.refreshToken = undefined;
            token.expiresAt = undefined;
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        session.accessToken = token.accessToken;
      }
      if (token?.refreshToken) {
        session.refreshToken = typeof token.refreshToken === 'string' ? token.refreshToken : undefined;
      }
      if (token?.expiresAt) {
        session.expiresAt = new Date(token.expiresAt as number);
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
    refreshToken?: string;
    expiresAt?: number;
  }
}
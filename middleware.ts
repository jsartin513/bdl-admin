import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  const AUTH_SECRET = process.env.AUTH_SECRET;

  let tokenParams: Parameters<typeof getToken>[0] = { req, secret: AUTH_SECRET };

  // Specify secure cookie settings for production
  if (process.env.NODE_ENV !== "development") {
    tokenParams = {
      ...tokenParams,
      cookieName: "__Secure-authjs.session-token",
      secureCookie: true,
    } as Parameters<typeof getToken>[0];
  }

  const token = await getToken(tokenParams);
  const { pathname, search } = req.nextUrl;

  // Regex to match paths that should be protected
  const protectedPaths = /^\/(?!_next\/|static\/|favicon\.ico|login$|api\/.*$).*/;

  if (protectedPaths.test(pathname)) {
    if (token) {
      // User is authenticated, allow access
      return NextResponse.next();
    } else {
      // User is not authenticated
      if (pathname === "/logout") {
        // Redirect users coming from /logout to /test
        return NextResponse.redirect(new URL("/test", req.nextUrl.origin));
      }

      // Redirect unauthenticated users to the login page
      const newUrl = new URL("/login", req.nextUrl.origin);
      newUrl.searchParams.set("redirect", pathname + search); // Save the original path and query
      return NextResponse.redirect(newUrl);
    }
  }

  // Remove unused cookie handling for API routes
  return NextResponse.next();
}
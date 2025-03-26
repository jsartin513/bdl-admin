import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  const AUTH_SECRET = process.env.AUTH_SECRET;

  let tokenParams: Parameters<typeof getToken>[0] = { req, secret: AUTH_SECRET };

  // IF we're not in localhost, we need to specify cookie name
  if (process.env.NODE_ENV !== "development") {
    tokenParams = {
      ...tokenParams,
      cookieName: "__Secure-authjs.session-token", // Specify the cookie name
      secureCookie: true, // Ensure secure cookies in production
    } as Parameters<typeof getToken>[0]; // Type assertion to avoid TypeScript error
  }

  const token = await getToken(tokenParams);
  const { pathname, search } = req.nextUrl;

  // Regex to match paths that should be protected
  const protectedPaths = /^\/(?!_next\/|static\/|favicon\.ico|login$|api\/.*$).*/;

  if (protectedPaths.test(pathname)) {
    console.log("middleware: Checking if user is authenticated");

    if (token) {
      console.log("middleware: User is authenticated");
      return NextResponse.next();
    } else {
      console.log("middleware: User is not authenticated, redirecting to login");
      const newUrl = new URL("/login", req.nextUrl.origin);
      newUrl.searchParams.set("redirect", pathname + search); // Save the original path and query
      return NextResponse.redirect(newUrl);
    }
  }

  // Add the _vercel_jwt cookie for API routes
  if (pathname.startsWith("/api") && process.env.NODE_ENV !== "development") {
    console.log("fixing cookie maybe")
    const jwtCookie = req.cookies.get("__Secure-authjs.session-token")?.value;
    console.log("jwtCookie", jwtCookie);
    if (jwtCookie) {
      const headers = new Headers(req.headers);
      headers.set("Cookie", `_vercel_jwt=${jwtCookie}`);

      return NextResponse.next({
        request: {
          headers,
        },
      });
    }
  }

  return NextResponse.next();
}
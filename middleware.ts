import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  
  const AUTH_SECRET = process.env.AUTH_SECRET;
  const token = await getToken({ req, secret: AUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Regex to match paths that should be protected
  const protectedPaths = /^\/(?!_next\/|static\/|favicon\.ico|login$|api\/.*$).*/;

  if (protectedPaths.test(pathname)) {
    console.log("middleware.ts");
    console.log('req.nextUrl', req.nextUrl);
    console.log('req.nextUrl.pathname', req.nextUrl.pathname);

    if (token) {
      return NextResponse.next();
    } else {
      console.log("Redirecting to login page");
      const newUrl = new URL("/login", req.nextUrl.origin);
      return NextResponse.redirect(newUrl);
    }
  }

  return NextResponse.next();
}
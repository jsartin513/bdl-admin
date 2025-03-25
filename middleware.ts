import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  const AUTH_SECRET = process.env.AUTH_SECRET;
  const token = await getToken({ req, secret: AUTH_SECRET });
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

  return NextResponse.next();
}
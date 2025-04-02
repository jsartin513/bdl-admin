import { NextResponse } from "next/server";
import { cookies } from "next/headers"; // Import cookies from next/headers
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

export async function GET() {
  // Fetch the session using NextAuth
  const session = await auth();
  // Extract user data from the session
  const user = session
    ? {
        isLoggedIn: true,
        session: session,
      }
    : {
        isLoggedIn: false,
        name: null,
        permissions: [],
        authTokenExpires: null,
      };

  // Environment information
  const appInfo = {
    nodeEnv: process.env.NODE_ENV || "development", // Replace with other app info as needed
  };

  // Fetch cookies
  const cookiesData = await cookies();
  const callbackUrl =
    cookiesData.get("__Secure-authjs.callback-url")?.value || // Production cookie
    cookiesData.get("authjs.callback-url")?.value || // Development cookie
    null;

  const csrfToken =
    cookiesData.get("__Host-authjs.csrf-token")?.value || // Production cookie
    cookiesData.get("authjs.csrf-token")?.value || // Development cookie
    null;

  return NextResponse.json({
    success: true,
    message: "Backend is working!",
    user,
    appInfo,
    cookies: {
      callbackUrl,
      csrfToken,
    },
  });
}

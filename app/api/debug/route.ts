import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers"; // Import cookies from next/headers
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

export async function GET(request: NextRequest) {
  // Fetch the session using NextAuth
  console.log("Fetching session...");
  console.log("Typeof request:", typeof request);
  const session = await auth(); // Use the auth function to get the session
  
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

  console.log("callbackUrl:", callbackUrl);

  const csrfToken =
    cookiesData.get("__Host-authjs.csrf-token")?.value || // Production cookie
    cookiesData.get("authjs.csrf-token")?.value || // Development cookie
    null;

  console.log("csrfToken:", csrfToken);

  let cookieList: string[] = [];
  const cookiesFromRequest = request.headers.get("cookie") || null;
  if (cookiesFromRequest) {
    cookieList = cookiesFromRequest.split(";").map((cookie) => cookie.trim());
  }


  // Log the cookies
  console.log("Cookies from request:", cookiesFromRequest);
  console.log("Cookies from headers:", cookieList);
  console.log("Cookies from next/headers:", cookiesData);
  console.log("Session:", session);
  console.log("User:", user);
  console.log("App Info:", appInfo);
  console.log("Request URL:", request.url);
  console.log("Request Headers:", request.headers);

  return NextResponse.json({
    success: true,
    message: "Backend is working!",
    user,
    appInfo,
    cookies: {
      callbackUrl,
      csrfToken,
    },
    cookiesFromNextHeaders: cookiesData,
    cookiesFromRequest: cookieList,
  });
}

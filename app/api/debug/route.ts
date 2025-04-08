import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers"; // Import cookies from next/headers

export async function GET(request: NextRequest) {
  // Extract the session from the custom header
  const sessionHeader = request.headers.get("X-Session");
  let session = null;

  if (sessionHeader) {
    try {
      session = JSON.parse(sessionHeader);
    } catch (err) {
      console.error("Failed to parse session from header:", err);
    }
  }

  // Log the session for debugging
  console.log("Session from header:", session);

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

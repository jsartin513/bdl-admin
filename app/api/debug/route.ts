import { NextRequest, NextResponse } from "next/server";

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

  // Extract user data from the session
  const user = session
    ? {
        isLoggedIn: true,
        session: {
          name: session.user?.name || null,
          email: session.user?.email || null,
          permissions: session.permissions || [],
          authTokenExpires: session.expiresAt || null,
        },
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

  return NextResponse.json({
    success: true,
    message: "Backend is working!",
    user,
    appInfo,
  });
}

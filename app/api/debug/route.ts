import { NextResponse } from "next/server";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

export async function GET() {

    // Fetch the session using NextAuth
    const session  = await auth()
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

    return NextResponse.json({
        success: true,
        message: "Backend is working!",
        user,
        appInfo,
    });
}
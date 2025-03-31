import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { getToken } from "next-auth/jwt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boston Dodgeball League",
  description: "Payment Checker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch the user's authentication token
  const AUTH_SECRET = process.env.AUTH_SECRET;
  const token = await getToken({ req: { headers: {} }, secret: AUTH_SECRET });

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav
          style={{
            padding: "1rem",
            backgroundColor: "#333", // Dark gray background
            color: "#ADD8E6", // Light blue text
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <Link
              href="/"
              style={{
                marginRight: "1rem",
                color: "#ADD8E6",
                textDecoration: "none",
              }}
            >
              Home
            </Link>
            <Link
              href="/payment"
              style={{
                marginRight: "1rem",
                color: "#ADD8E6",
                textDecoration: "none",
              }}
            >
              Payment
            </Link>
            <Link
              href="/test"
              style={{
                marginRight: "1rem",
                color: "#ADD8E6",
                textDecoration: "none",
              }}
            >
              Test
            </Link>
            <Link
              href="/login"
              style={{
                marginRight: "1rem",
                color: "#ADD8E6",
                textDecoration: "none",
              }}
            >
              Login
            </Link>
          </div>
          <div>
            {token ? (
              <span>
                Welcome, {token.name || "User"}!{" "}
                <Link
                  href="/api/auth/signout"
                  style={{ color: "#ADD8E6", textDecoration: "none" }}
                >
                  Logout
                </Link>
              </span>
            ) : (
              <Link
                href="/api/auth/signin"
                style={{ color: "#ADD8E6", textDecoration: "none" }}
              >
                Login
              </Link>
            )}
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}


import Link from "next/link";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

export default async function TopNav() {
  // Fetch the user's session using the `auth` object
  const session = await auth();

  return (
    <nav className="bg-gray-800 text-blue-300 p-4 flex justify-between items-center">
      <div className="flex space-x-4">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <Link href="/payment" className="hover:underline">
          Payment
        </Link>
        <Link href="/test" className="hover:underline">
          Test
        </Link>
        <Link href="/login" className="hover:underline">
          Re-authorize
        </Link>
      </div>
      <div>
        {session?.user ? (
          <span>
            Welcome, {session.user.name || "User"}!{" "}
          </span>
        ) : (
          <Link href="/api/auth/signin" className="hover:underline">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
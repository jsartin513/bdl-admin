import Link from "next/link";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

export default async function TopNav() {
  // Fetch the user's session using the `auth` object
  const session = await auth();

  return (
    <nav className="bg-gray-800 text-blue-300 p-4 flex justify-between items-center">
      <div className="flex space-x-4">
        <Link href="/payment" className="hover:underline">
          Payment
        </Link>
        <Link href="/test" className="hover:underline">
          Test
        </Link>
      </div>
      <div>
        {session?.user ? (
          <div>
            <Link
              href="/logout" // Link to the reauthorization page
              className="hover:underline text-blue-300"
            >
              Sign Out
            </Link>
            <span className="ml-2 text-blue-300">  {session.user.name || "User"}</span>
            
          </div>
        ) : (
          <Link href="/api/auth/signin" className="hover:underline">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}

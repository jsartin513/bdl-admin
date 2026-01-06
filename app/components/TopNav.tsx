import Link from "next/link";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

export default async function TopNav() {
  // Fetch the user's session using the `auth` object
  const session = await auth();

  return (
    <nav className="bg-gray-800 text-blue-300 p-4 flex justify-between items-center">
      <div className="flex space-x-4 items-center">
        {/* Dropdown menu for auth-required pages */}
        <div className="relative group">
          <button className="hover:underline flex items-center">
            Admin
            <svg
              className="ml-1 w-4 h-4 inline-block"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <div className="absolute left-0 mt-2 w-56 bg-gray-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 border border-gray-700">
            <div className="py-1">
              <Link
                href="/schedules-live"
                className="block px-4 py-2 text-blue-300 hover:bg-gray-700 hover:text-white"
              >
                League Schedules (Live)
              </Link>
              <Link
                href="/timer"
                className="block px-4 py-2 text-blue-300 hover:bg-gray-700 hover:text-white"
              >
                Round Timer
              </Link>
              <Link
                href="/test"
                className="block px-4 py-2 text-blue-300 hover:bg-gray-700 hover:text-white"
              >
                Show Permissions (debugging)
              </Link>
            </div>
          </div>
        </div>
        {/* Public pages remain top-level */}
        <Link href="/schedules-static" className="hover:underline">
          League Schedules (Static)
        </Link>
        <Link href="/create-league" className="hover:underline">
          Create League
        </Link>
        <Link href="/timer-standalone" className="hover:underline">
          Standalone Timer
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

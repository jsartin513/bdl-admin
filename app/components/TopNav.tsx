import Link from "next/link";

export default function TopNav() {
  return (
    <nav className="bg-gray-800 text-blue-300 p-4 flex justify-between items-center">
      <div className="flex space-x-4 items-center">
        <Link href="/schedules" className="hover:underline">
          League Schedules
        </Link>
        <Link href="/create-league" className="hover:underline">
          Create League
        </Link>
      </div>
    </nav>
  );
}

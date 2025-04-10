import { signOut } from "@/auth";

export default function SignOut() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-md rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Sign Out
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Logging out will remove your session and you will need to log in again.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button
            type="submit"
            className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
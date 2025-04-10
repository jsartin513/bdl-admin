import { signIn } from "@/auth";

export default function SignIn({ redirect }: { redirect: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: redirect }); // Pass the redirect URL
      }}
    >
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Signin with Google
      </button>
    </form>
  );
}
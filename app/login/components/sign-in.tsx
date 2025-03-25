import { signIn } from "@/auth";

export default function SignIn({ redirect }: { redirect: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: redirect }); // Pass the redirect URL
      }}
    >
      <button type="submit">Signin with Google</button>
    </form>
  );
}
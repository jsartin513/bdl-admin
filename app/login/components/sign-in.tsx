'use client';
import { signIn } from "next-auth/react";

export default function SignIn() {
  const handleSignIn = async () => {
    await signIn("google");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSignIn();
      }}
    >
      <button type="submit">Sign in with Google</button>
    </form>
  );
}
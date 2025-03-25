import React from "react";
import SignIn from "./components/sign-in";

interface PageProps {
  searchParams: Promise<{ redirect?: string }>;
}

const LoginPage = async ({ searchParams }: PageProps) => {
  const { redirect } = await searchParams;
  const redirectUrl = redirect ? redirect: "/";


  return (
    <div>
      <h1>Login</h1>
      <SignIn redirect={redirectUrl} />
    </div>
  );
};

export default LoginPage;

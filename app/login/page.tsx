import React from "react";
import SignIn from "./components/sign-in";

const LoginPage = async ({ searchParams }: { searchParams: { redirect?: string } }) => {
  const awaitedSearchParams = await searchParams;
  const redirect = awaitedSearchParams.redirect || "/";
  return (
    <div>
      <h1>Login</h1>
      <SignIn redirect={redirect} />
    </div>
  );
};

export default LoginPage;

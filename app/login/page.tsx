import React from "react";
import SignIn from "./components/sign-in";

interface PageProps {
  searchParams: Promise<{ redirect?: string }>;
}

const LoginPage = async ({ searchParams }: PageProps) => {
  const { redirect } = await searchParams;
  const redirectUrl = redirect ? redirect : "/";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-md rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Login with Google
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Please log in using your Google account to continue.
        </p>
        <SignIn redirect={redirectUrl} />
      </div>
    </div>
  );
};

export default LoginPage;

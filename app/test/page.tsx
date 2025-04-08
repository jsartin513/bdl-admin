import React from "react";
import { headers } from "next/headers";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

const Page = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any | null = null;
  let error: string | null = null;

  try {
    // Fetch the session
    const session = await auth();

    // Get the incoming request headers
    const incomingHeaders = await headers();

    // Forward the headers and session to the backend
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/debug`, {
      cache: "no-store", // Ensures the data is fetched fresh for every request
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(incomingHeaders.entries()), // Forward all incoming headers
        "X-Session": JSON.stringify(session), // Pass the session explicitly
      },
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    data = await response.json();
  } catch (err: unknown) {
    if (err instanceof Error) {
      error = err.message;
    } else {
      error = "An unknown error occurred";
    }
  }

  return (
    <div>
      <h1>Backend Response</h1>
      {error ? (
        <p style={{ color: "red" }}>Error: {error}</p>
      ) : data ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default Page;

import React from "react";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file


const SHEET_ID = "1xPeaPyM1uLpbxmWgHZ5f7ya7hxGu-3pgNj9J7t0N6NA";

type Registrant = {
  registrationDate: string;
  email: string;
  name: string;
  waiverTimestamp: string | null;
  waiverStatus: string;
};

async function getWaivers(): Promise<{ registrants: Registrant[]; error?: string }> {
  // If you need to pass auth/session, extract from cookies here
  // const cookieStore = cookies();
  // const session = cookieStore.get("your-session-cookie-name")?.value;

    // Fetch the session
    const session = await auth();

    // Fetch processed registration data from the backend
    const res = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL
      }/api/waivers?sheetId=${SHEET_ID}&sheetName=${encodeURIComponent(
        "Form Responses 1" // Use the correct sheet name
      )}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Session": JSON.stringify(session), // Pass the session explicitly
        },
        cache: "no-store", // Ensure fresh data is fetched for every request
      }
    );

  const data = await res.json();
  return data;
}

export default async function WaiversPage() {
  const { registrants = [], error } = await getWaivers();

  return (
    <main style={{ padding: 24, margin: 24 }}>
      <h1>League Registrations & Waiver Status</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!error && (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: 8 }}>Name</th>
              <th style={{ border: "1px solid #ccc", padding: 8 }}>Email</th>
              <th style={{ border: "1px solid #ccc", padding: 8 }}>Registration Date</th>
              <th style={{ border: "1px solid #ccc", padding: 8 }}>Waiver Status</th>
              <th style={{ border: "1px solid #ccc", padding: 8 }}>Waiver Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {registrants.map((r, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #ccc", padding: 8 }}>{r.name}</td>
                <td style={{ border: "1px solid #ccc", padding: 8 }}>{r.email}</td>
                <td style={{ border: "1px solid #ccc", padding: 8 }}>{r.registrationDate}</td>
                <td style={{ border: "1px solid #ccc", padding: 8 }}>{r.waiverStatus}</td>
                <td style={{ border: "1px solid #ccc", padding: 8 }}>{r.waiverTimestamp || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
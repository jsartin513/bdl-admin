/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

const SHEET_NAME = "Form Responses 1"; // This is the name of the Google Sheet
const SHEET_ID = "19_KylHMmaft-a2FXXM9EWJTMRVo4hAOqV4VN5ASyBiY"; // Test sheet

const PaymentPage = async () => {
  let registrations: any[] = [];
  let latestPaymentTimestamp: string | null = null;
  let error: string | null = null;

  try {
    // Fetch the session
    const session = await auth();

    // Fetch processed registration data from the backend
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL
      }/api/registrations?sheetId=${SHEET_ID}&sheetName=${encodeURIComponent(
        SHEET_NAME
      )}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Session": JSON.stringify(session), // Pass the session explicitly
        },
        cache: "no-store", // Ensure fresh data is fetched for every request
      }
    );

    const data = await response.json();
    if (response.ok) {
      registrations = data.registrations;
      latestPaymentTimestamp = data.latestPaymentTimestamp;
    } else {
      error = data.error;
    }
  } catch (err) {
    error = "Failed to fetch data";
    console.error(err);
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1
        style={{
          color: "#fff",
          fontSize: "2em",
          borderBottom: "2px solid #333",
          paddingBottom: "10px",
        }}
      >
        Registered Players
      </h1>
      {latestPaymentTimestamp && (
        <p>
          Latest Payment Timestamp:{" "}
          <strong>{new Date(latestPaymentTimestamp).toLocaleString()}</strong>
        </p>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {registrations.length > 0 ? (
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {registrations.map((registration) => (
            <li
              key={registration.email}
              style={{
                marginBottom: "10px",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            >
              <strong>{registration.name}</strong> ({registration.email}) -{" "}
              {registration.paymentStatus === "Paid" ? (
                <span style={{ color: "green" }}>
                  {registration.paymentStatus} on{" "}
                  {registration.paymentDetails?.date} (Transaction ID:{" "}
                  {registration.paymentDetails?.transactionId})
                </span>
              ) : (
                <span style={{ color: "red" }}>
                  {registration.paymentStatus}
                </span>
              )}
              <br />
              {registration.waiverStatus === "Waiver Signed" ? (
                <span style={{ color: "lightblue" }}>
                  {registration.waiverStatus}:{" "}
                  {new Date(registration.waiverTimestamp).toLocaleString()}
                </span>
              ) : (
                <span style={{ color: "orange" }}>
                  {registration.waiverStatus}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>Loading..</p>
      )}
    </div>
  );
};

export default PaymentPage;

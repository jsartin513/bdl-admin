/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

const PAYMENT_AMOUNT = "$50.00";
const PAYMENT_TYPE = "Payment";
const PAYMENT_TO = "Boston Dodgeball League";

// Define the sheetId and sheetName as constants or fetch them dynamically if needed
const SHEET_NAME = "Form Responses 1"; // This is the ID of the Google Sheet
const SHEET_ID = "1y_F-hwJ-qZnsNz-YnmUK0fyMo3hpA6Thr_UC6PYbR_k"; // Test sheet

const PaymentPage = async () => {
  let registrations: any[] = [];
  let payments: any[] = [];
  let players: any[] = [];
  let latestPaymentTimestamp: string | null = null;
  let error: string | null = null;

  try {
    // Fetch the session
    const session = await auth();

    // Fetch registration data
    const registrationResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/registrations?sheetId=${SHEET_ID}&sheetName=${encodeURIComponent(SHEET_NAME)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Session": JSON.stringify(session), // Pass the session explicitly
        },
        cache: "no-store", // Ensure fresh data is fetched for every request
      }
    );
    const registrationData = await registrationResponse.json();
    if (registrationResponse.ok) {
      registrations = registrationData.registrations;
    } else {
      error = registrationData.error;
    }

    // Fetch payment data
    const paymentResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/payments`, {
      headers: {
        "Content-Type": "application/json",
        "X-Session": JSON.stringify(session), // Pass the session explicitly
      },
      cache: "no-store", // Ensure fresh data is fetched for every request
    });
    const paymentData = await paymentResponse.json();
    if (paymentResponse.ok) {
      payments = paymentData.payments;
      latestPaymentTimestamp = paymentData.latestPaymentTimestamp;
    } else {
      error = paymentData.error;
    }

    // Fetch player data (waiver information)
    const playerResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/players`, {
      headers: {
        "Content-Type": "application/json",
        "X-Session": JSON.stringify(session), // Pass the session explicitly
      },
      cache: "no-store", // Ensure fresh data is fetched for every request
    });
    const playerData = await playerResponse.json();
    if (playerResponse.ok) {
      players = playerData.players;
    } else {
      error = playerData.error;
    }
  } catch (err) {
    error = "Failed to fetch data";
    console.error(err);
  }

  const getPaymentDetails = (name: string) => {
    const payment = payments.find(
      (payment) =>
        payment.from === name?.trim() &&
        payment.amountTotal === PAYMENT_AMOUNT &&
        payment.to === PAYMENT_TO &&
        payment.type === PAYMENT_TYPE
    );
    return payment ? { date: payment.date, transactionId: payment.id } : null;
  };

  const getWaiverDetails = (email: string) => {
    const player = players.find((player) => player.email === email);
    return player ? player.waiverTimestamp : null;
  };

  const sortedRegistrations = registrations.sort((a, b) => {
    const aPaid = getPaymentDetails(a.name) ? 1 : 0;
    const bPaid = getPaymentDetails(b.name) ? 1 : 0;
    return bPaid - aPaid;
  });

  const isAfterLatestPayment = (registrationDate: string) => {
    if (!latestPaymentTimestamp) return false;

    const latestPaymentDate = new Date(latestPaymentTimestamp);
    const registrationDateObj = new Date(registrationDate);

    // Check if either date is invalid
    if (isNaN(latestPaymentDate.getTime()) || isNaN(registrationDateObj.getTime())) {
      console.error("Invalid date value:", { latestPaymentTimestamp, registrationDate });
      return false;
    }

    return registrationDateObj.getTime() > latestPaymentDate.getTime();
  };

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
          {sortedRegistrations.map((registration) => {
            const paymentDetails = getPaymentDetails(registration.name);
            const waiverTimestamp = getWaiverDetails(registration.email);
            const registeredAfter = isAfterLatestPayment(registration.registrationDate);
            return (
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
                {paymentDetails ? (
                  <span style={{ color: "green" }}>
                    Paid {paymentDetails.date} (Transaction ID:{" "}
                    {paymentDetails.transactionId})
                  </span>
                ) : (
                  <span style={{ color: "red" }}>
                    Unpaid{" "}
                    {registeredAfter
                      ? "(Registered after latest venmo export)"
                      : "(Registered within venmo export period)"}
                  </span>
                )}
                <br />
                {waiverTimestamp ? (
                  <span style={{ color: "lightblue" }}>
                    Waiver Signed: {new Date(waiverTimestamp).toLocaleString()}
                  </span>
                ) : (
                  <span style={{ color: "orange" }}>Waiver Not Signed</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Loading..</p>
      )}
    </div>
  );
};

export default PaymentPage;
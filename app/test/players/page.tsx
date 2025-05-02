/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file

const PlayersMatchPage = async () => {
  let waiverPlayers: any[] = [];
  let venmoPayments: any[] = [];
  let error: string | null = null;

  try {
    // Fetch the session
    const session = await auth();

    // Fetch waiver players
    const waiverResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/players`, {
      headers: {
        "Content-Type": "application/json",
        "X-Session": JSON.stringify(session), // Pass the session explicitly
      },
      cache: "no-store", // Ensure fresh data is fetched for every request
    });
    const waiverData = await waiverResponse.json();
    if (waiverResponse.ok) {
      waiverPlayers = waiverData.players; // Array of player objects
    } else {
      error = waiverData.error;
    }

    // Fetch Venmo payments
    const venmoResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/payments`, {
      headers: {
        "Content-Type": "application/json",
        "X-Session": JSON.stringify(session), // Pass the session explicitly
      },
      cache: "no-store", // Ensure fresh data is fetched for every request
    });
    const venmoData = await venmoResponse.json();
    if (venmoResponse.ok) {
      venmoPayments = venmoData.payments; // Array of payment objects
    } else {
      error = venmoData.error;
    }
  } catch (err) {
    error = "Failed to fetch data";
    console.error(err);
  }

  // Match logic
  const matches = waiverPlayers.map((player) => {
    const match = venmoPayments.find((payment) =>
      payment?.from?.toLowerCase().includes(player.fullName.toLowerCase())
    );
    return match
      ? {
          waiver: player.fullName,
          email: player.email,
          waiverTimestamp: player.waiverTimestamp,
          paymentDate: match.date,
          paymentAmount: match.amountTotal,
          transactionId: match.id,
        }
      : null;
  }).filter(Boolean);

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
        Match Players with Venmo Payments
      </h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div>
        <h2>Waiver Players</h2>
        <ul>
          {waiverPlayers.map((player, index) => (
            <li key={index}>
              {player.fullName} ({player.email}) - Waiver Signed:{" "}
              {player.waiverTimestamp
                ? new Date(player.waiverTimestamp).toLocaleString()
                : "Not Signed"}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Venmo Payments</h2>
        <ul>
          {venmoPayments.map((payment, index) => (
            <li key={index}>
              From: {payment.from} - Amount: {payment.amountTotal} - Date:{" "}
              {new Date(payment.date).toLocaleString()} - Transaction ID: {payment.id}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Matches</h2>
        <ul>
          {matches.map((match, index) =>
            match ? (
              <li key={index}>
                Waiver: {match.waiver} ({match.email}) - Waiver Signed:{" "}
                {new Date(match.waiverTimestamp).toLocaleString()} - Payment:{" "}
                {match.paymentAmount} on {new Date(match.paymentDate).toLocaleString()} (Transaction ID:{" "}
                {match.transactionId})
              </li>
            ) : null
          )}
        </ul>
      </div>
    </div>
  );
};

export default PlayersMatchPage;
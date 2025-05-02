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
      waiverPlayers = waiverData.players.map((player: any) => ({
        name: player.fullName,
        email: player.email,
      })); // Extract only name and email
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
      venmoPayments = venmoData.payments.map((payment: any) => ({
        name: payment.from,
      })); // Extract only name
    } else {
      error = venmoData.error;
    }
  } catch (err) {
    error = "Failed to fetch data";
    console.error(err);
  }

  // Helper function to extract the last name
  const getLastName = (fullName: string) => {
    const parts = fullName?.trim().split(" ");
    return parts?.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  };

  // Match logic
  const exactMatches = waiverPlayers.map((player) => {
    const match = venmoPayments.find((payment) =>
      payment?.name?.toLowerCase().includes(player.name.toLowerCase())
    );
    return match
      ? {
          name: player.name,
          email: player.email,
        }
      : null;
  }).filter(Boolean);

  const almostMatches = waiverPlayers.map((player) => {
    const playerLastName = getLastName(player.name);
    const match = venmoPayments.find((payment) => {
      const paymentLastName = getLastName(payment.name);
      return playerLastName && playerLastName === paymentLastName;
    });
    return match
      ? {
          waiverName: player.name,
          venmoName: match.name,
        }
      : null;
  })
    .filter(Boolean)
    .filter(
      (almostMatch) =>
        !exactMatches.some(
          (exactMatch) =>
            exactMatch?.name?.toLowerCase() === almostMatch?.waiverName?.toLowerCase()
        )
    );

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
              {player.name} ({player.email})
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Venmo Payments</h2>
        <ul>
          {venmoPayments.map((payment, index) => (
            <li key={index}>{payment.name}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Exact Matches</h2>
        <ul>
          {exactMatches.map((match, index) =>
            match ? (
              <li key={index}>
                {match.name} ({match.email})
              </li>
            ) : null
          )}
        </ul>
      </div>
      <div>
        <h2>Almost Matches (Last Name Matches)</h2>
        <ul>
          {almostMatches.map((match, index) =>
            match ? (
              <li key={index}>
                Waiver: {match.waiverName} - Venmo: {match.venmoName}
              </li>
            ) : null
          )}
        </ul>
      </div>
    </div>
  );
};

export default PlayersMatchPage;
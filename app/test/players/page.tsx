/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react";
import { auth } from "@/auth"; // Import the `auth` object from your auth.ts file
import { EQUIVALENT_NAMES } from "@/app/_lib/constants"; // Import the constants file

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
        name: player?.fullName?.trim(), // Trim whitespace
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
        name: payment?.from?.trim(), // Trim whitespace
      })); // Extract only name
    } else {
      error = venmoData.error;
    }
  } catch (err) {
    error = "Failed to fetch data";
    console.error(err);
  }

  // Helper function to extract the first name
  const getFirstName = (fullName: string) => {
    const parts = fullName?.trim().split(" ");
    return parts?.length > 0 ? parts[0].toLowerCase() : "";
  };

  // Helper function to normalize first names using EQUIVALENT_NAMES
  const normalizeFirstName = (firstName: string) => {
    for (const [canonicalName, equivalents] of Object.entries(EQUIVALENT_NAMES)) {
      if (canonicalName.toLowerCase() === firstName || equivalents.map(name => name.toLowerCase()).includes(firstName)) {
        return canonicalName.toLowerCase();
      }
    }
    return firstName; // Return the original name if no match is found
  };

  // Helper function to extract the last name
  const getLastName = (fullName: string) => {
    const parts = fullName?.trim().split(" ");
    return parts?.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  };

  // Match logic
  const exactMatches = waiverPlayers.map((player) => {
    const match = venmoPayments.find((payment) =>
      payment?.name?.toLowerCase() === player.name.toLowerCase()
    );
    return match
      ? {
          name: player.name,
          email: player.email,
        }
      : null;
  }).filter(Boolean);

  const combinedMatches = waiverPlayers.map((player) => {
    const playerFirstName = normalizeFirstName(getFirstName(player.name));
    const playerLastName = getLastName(player.name);
    const match = venmoPayments.find((payment) => {
      const paymentFirstName = normalizeFirstName(getFirstName(payment.name));
      const paymentLastName = getLastName(payment.name);
      return playerLastName === paymentLastName && playerFirstName === paymentFirstName;
    });
    return match
      ? {
          waiverName: player.name,
          venmoName: match.name,
          type: "Matched Names", // Indicate this is a matched name
        }
      : null;
  })
    .filter(Boolean)
    .filter(
      (combinedMatch) =>
        !exactMatches.some(
          (exactMatch) =>
            exactMatch?.name?.toLowerCase() === combinedMatch?.waiverName?.toLowerCase()
        )
    );

  const justLastNameMatches = waiverPlayers.map((player) => {
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
      (lastNameMatch) =>
        !exactMatches.some(
          (exactMatch) =>
            exactMatch?.name?.toLowerCase() === lastNameMatch?.waiverName?.toLowerCase()
        ) &&
        !combinedMatches.some(
          (combinedMatch) =>
            combinedMatch?.waiverName?.toLowerCase() === lastNameMatch?.waiverName?.toLowerCase()
        )
    );

  return (
    <div className="p-6 bg-gray-100 font-sans text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900 border-b-2 border-gray-300 pb-2 mb-6">
        Match Players with Venmo Payments
      </h1>
      {error && <p className="text-red-600 font-semibold mb-4">{error}</p>}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Waiver Players</h2>
        <ul className="list-disc pl-5 space-y-2">
          {waiverPlayers.map((player, index) => (
            <li key={index} className="border-b border-gray-200 pb-2">
              {player.name} <span className="text-gray-500">({player.email})</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Venmo Payments</h2>
        <ul className="list-disc pl-5 space-y-2">
          {venmoPayments.map((payment, index) => (
            <li key={index} className="border-b border-gray-200 pb-2">{payment.name}</li>
          ))}
        </ul>
      </div>
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Exact Matches</h2>
        <ul className="list-disc pl-5 space-y-2">
          {exactMatches.map((match, index) =>
            match ? (
              <li key={index} className="border-b border-gray-200 pb-2">
                {match.name} <span className="text-gray-500">({match.email})</span>
              </li>
            ) : null
          )}
        </ul>
      </div>
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Matched Names (First Name Equivalents + Last Name Matches)
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          {combinedMatches.map((match, index) =>
            match ? (
              <li key={index} className="border-b border-gray-200 pb-2">
                Waiver: {match.waiverName} - Venmo: {match.venmoName}
              </li>
            ) : null
          )}
        </ul>
      </div>
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Just Last Name Matches</h2>
        <ul className="list-disc pl-5 space-y-2">
          {justLastNameMatches.map((match, index) =>
            match ? (
              <li key={index} className="border-b border-gray-200 pb-2">
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
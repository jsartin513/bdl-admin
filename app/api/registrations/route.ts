import { NextRequest, NextResponse } from "next/server";
import { authenticateWithGoogle, getRegistrations, getPayments, getPlayers } from "../googleUtils";
import { EQUIVALENT_NAMES } from "@/app/_lib/constants"; // Import the constants file

const PAYMENT_AMOUNT = "$50.00";
const PAYMENT_TYPE = "Payment";
const PAYMENT_TO = "Boston Dodgeball League";

// Define lists for BDL committee and comped players
const BDL_COMMITTEE = [
  "Abby Lee",
  "Jessica Sartin",
  "Claire Ousey",
  "Stephen Decker",
  "David Hollm",
  "Bo Tillmon",
];

const COMPED_PLAYERS = [
  "Marcos Berrios",
  "Danny Stein",
  "Emily Hotz",
  "Colin Roddy",
];

// Helper function to extract the first name
const getFirstName = (fullName: string) => {
  const parts = fullName?.trim().split(" ");
  return parts?.length > 0 ? parts[0].toLowerCase() : "";
};

// Helper function to normalize first names using EQUIVALENT_NAMES
const normalizeFirstName = (firstName: string) => {
  for (const [canonicalName, equivalents] of Object.entries(EQUIVALENT_NAMES)) {
    if (
      canonicalName.toLowerCase() === firstName ||
      equivalents.map((name) => name.toLowerCase()).includes(firstName)
    ) {
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

export async function GET(req: NextRequest) {
  try {
    const sessionHeader = req.headers.get("X-Session");
    const session = sessionHeader ? JSON.parse(sessionHeader) : null;

    const auth = await authenticateWithGoogle(session);

    // Extract query parameters
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get("sheetId");
    const sheetName = searchParams.get("sheetName");
    const paymentsSheetId = "1eD-x1T1tcjB4xG-4Jn69pzavPokYL2CVAbZqXZJ5esc"; // Payments sheet ID
    const paymentsSheetName = "LatestPayments";
    const playersSheetId = "1C16RppqLLagKF2vz-gYpdHCU0AszgvGibkC_lfZF4RQ"; // Players sheet ID
    const playersSheetName = "Form Responses 1";

    if (!sheetId || !sheetName) {
      throw new Error("Missing sheetId or sheetName");
    }

    // Fetch data from Google Sheets
    const registrations = await getRegistrations(auth, sheetId, sheetName);
    const { payments, latestPaymentTimestamp } = await getPayments(auth, paymentsSheetId, paymentsSheetName);
    const players = await getPlayers(auth, playersSheetId, playersSheetName);

    // Helper functions
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

    /**
     * Retrieves the waiver timestamp for a player based on their email or name.
     * 
     * @param {string} email - The email address of the player.
     * @param {string} name - The full name of the player.
     * @returns {string | null} - The waiver timestamp if found, or null if no match is found.
     * 
     * The function first attempts to find a player by their email. If no match is found,
     * it tries to match the player by their full name. As a last resort, it compares
     * normalized first and last names to find a match.
     */
    const getWaiverDetails = (email: string, name: string) => {
      let player = players.find((player) => player.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (player) {
        return player.waiverTimestamp;
      }
      // If no player found by email, try to match by name
      player = players.find((player) => player.fullName.trim().toLowerCase() === name.trim().toLowerCase());
      if (player) {
        return player.waiverTimestamp;
      }

      player = players.find((player) => {
        const playerFirstName = normalizeFirstName(getFirstName(player.fullName));
        const playerLastName = getLastName(player.fullName);
        const registrationFirstName = normalizeFirstName(getFirstName(name));
        const registrationLastName = getLastName(name);

        return (
          playerLastName === registrationLastName &&
          playerFirstName === registrationFirstName
        );
      });

      return player ? player.waiverTimestamp : null;
    };

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

    // Process registrations
    const processedRegistrations = registrations.map((registration) => {
      const paymentDetails = getPaymentDetails(registration.name);
      const waiverTimestamp = getWaiverDetails(registration.email, registration.name);
      const registeredAfter = isAfterLatestPayment(registration.registrationDate);

      // Determine payment status
      let paymentStatus = "";
      if (BDL_COMMITTEE.includes(registration.name)) {
        paymentStatus = "No Payment Needed (BDL Committee)";
      } else if (COMPED_PLAYERS.includes(registration.name)) {
        paymentStatus = "No Payment Needed (Comped)";
      } else if (paymentDetails) {
        paymentStatus = "Paid";
      } else if (registeredAfter) {
        paymentStatus = "Unpaid (Registered after latest venmo export)";
      } else {
        paymentStatus = "Unpaid (Registered within venmo export period)";
      }

      return {
        ...registration,
        gender: registration.gender?.trim().toLowerCase() || "unknown", // Include gender field
        paymentDetails,
        waiverTimestamp,
        registeredAfter,
        paymentStatus,
        waiverStatus: waiverTimestamp ? "Waiver Signed" : "Signed waiver not found",
      };
    });

    return NextResponse.json({
      registrations: processedRegistrations,
      latestPaymentTimestamp,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

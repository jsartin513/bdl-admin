import { NextRequest, NextResponse } from "next/server";
import { authenticateWithGoogle, getRegistrations, getPayments, getPlayers } from "../googleUtils";

const PAYMENT_AMOUNT = "$50.00";
const PAYMENT_TYPE = "Payment";
const PAYMENT_TO = "Boston Dodgeball League";

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

    const getWaiverDetails = (email: string) => {
      const player = players.find((player) => player.email === email);
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
      const waiverTimestamp = getWaiverDetails(registration.email);
      const registeredAfter = isAfterLatestPayment(registration.registrationDate);

      return {
        ...registration,
        paymentDetails,
        waiverTimestamp,
        registeredAfter,
        paymentStatus: paymentDetails
          ? "Paid"
          : registeredAfter
          ? "Unpaid (Registered after latest venmo export)"
          : "Unpaid (Registered within venmo export period)",
        waiverStatus: waiverTimestamp ? "Waiver Signed" : "Waiver Not Signed",
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

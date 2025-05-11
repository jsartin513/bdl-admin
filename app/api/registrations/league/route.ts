/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticateWithGoogle, getRegistrations, getPayments, getPlayers} from "../../googleUtils";

const PAYMENT_AMOUNT = '$65.00'; // Adjusted for Remix League
const PAYMENT_TYPE = "Payment";
const PAYMENT_TO = "Boston Dodgeball League";

export async function GET(req: NextRequest) {
  try {
    const sessionHeader = req.headers.get("X-Session");
    const session = sessionHeader ? JSON.parse(sessionHeader) : null;

    const auth = await authenticateWithGoogle(session);

    const sheetId = "1A-TL2ah68H388xT6294h8T0GxfE9yIqiRNYJq_tMf60"; // Remix League Google Sheet
    const sheetName = "Form Responses 1"; // Adjust if necessary
    const paymentsSheetId = "1eD-x1T1tcjB4xG-4Jn69pzavPokYL2CVAbZqXZJ5esc"; // Payments sheet ID
    const paymentsSheetName = "LatestPayments";
    const playersSheetId = "1C16RppqLLagKF2vz-gYpdHCU0AszgvGibkC_lfZF4RQ"; // Players sheet ID
    const playersSheetName = "Form Responses 1";

    // Fetch data from Google Sheets
    const registrations = await getRegistrations(auth, sheetId, sheetName);
    const { payments, latestPaymentTimestamp } = await getPayments(auth, paymentsSheetId, paymentsSheetName);
    const players = await getPlayers(auth, playersSheetId, playersSheetName);

    // Helper functions
    const getPaymentDetails = (name: string) => {
      const normalizedName = name?.trim().toLowerCase();
      console.log("Normalized Name:", normalizedName);
      const payment = payments.find((payment: any) => {
        console.log("Comparing with Payment:", {
          from: payment.from?.trim().toLowerCase(),
        });
        return (
          payment.from?.trim().toLowerCase() === normalizedName &&
          payment.amountTotal === PAYMENT_AMOUNT &&
          payment.to === PAYMENT_TO &&
          payment.type === PAYMENT_TYPE
        );
      });
      return payment ? { date: payment.date, transactionId: payment.id } : null;
    };

    const getWaiverDetails = (email: string) => {
      const normalizedEmail = email?.trim().toLowerCase();
      const player = players.find(
        (player: any) => player.email?.trim().toLowerCase() === normalizedEmail
      );
      return player ? player.waiverTimestamp : null;
    };

    const isAfterLatestPayment = (registrationDate: string) => {
      if (!latestPaymentTimestamp) return false;

      const latestPaymentDate = new Date(latestPaymentTimestamp);
      const registrationDateObj = new Date(registrationDate);

      if (isNaN(latestPaymentDate.getTime()) || isNaN(registrationDateObj.getTime())) {
        console.error("Invalid date value:", { latestPaymentTimestamp, registrationDate });
        return false;
      }

      return registrationDateObj.getTime() > latestPaymentDate.getTime();
    };

    // Process registrations
    const processedRegistrations = registrations.map((registration: any) => {
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
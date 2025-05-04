import { NextRequest, NextResponse } from "next/server";
import { authenticateWithGoogle, fetchSheetData } from "../../_lib/googleSheetsUtils";

const SHEET_ID = "1eD-x1T1tcjB4xG-4Jn69pzavPokYL2CVAbZqXZJ5esc";
const SHEET_NAME = "LatestPayments";

export async function GET(req: NextRequest) {
  try {
    const sessionHeader = req.headers.get("X-Session");
    const session = sessionHeader ? JSON.parse(sessionHeader) : null;

    const auth = await authenticateWithGoogle(session);

    const rows = await fetchSheetData(auth, SHEET_ID, SHEET_NAME);

    const payments = rows.slice(1).map((row) => ({
      id: `payment-${row[0]}`,
      date: row[1],
      time: row[2],
      type: row[3],
      status: row[4],
      note: row[5],
      from: row[6],
      to: row[7],
      amountTotal: row[8],
      amountTax: row[9],
      amountTip: row[10],
      amountNet: row[11],
      amountFee: row[12],
    }));

    const latestPaymentTimestamp = payments
      .map((payment) => {
        const dateTime = `${payment.date} ${payment.time}`;
        const timestamp = new Date(dateTime).getTime();
        return isNaN(timestamp) ? 0 : timestamp;
      })
      .reduce((max, current) => Math.max(max, current), 0);

    return NextResponse.json({
      payments,
      latestPaymentTimestamp: new Date(latestPaymentTimestamp).toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

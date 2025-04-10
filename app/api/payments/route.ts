import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = "1eD-x1T1tcjB4xG-4Jn69pzavPokYL2CVAbZqXZJ5esc";
const SHEET_NAME = "LatestPayments";

export async function GET(req: NextRequest) {
  try {
    // Extract the session from the custom header
    const sessionHeader = req.headers.get("X-Session");
    let session = null;

    if (sessionHeader) {
      try {
        session = JSON.parse(sessionHeader);
      } catch (err) {
        console.error("Failed to parse session from header:", err);
      }
    }

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching data from Google Sheets");
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME,
    });

    const rows = result.data.values;
    if (!rows) {
      throw new Error("No data found in the spreadsheet");
    }
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

    return NextResponse.json({ payments });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { google } from "googleapis";

const SHEET_ID = "1A-TL2ah68H388xT6294h8T0GxfE9yIqiRNYJq_tMf60";
const SHEET_NAME = "Form Responses 1";

export async function GET(req: NextRequest) {
  try {
    const AUTH_SECRET = process.env.AUTH_SECRET;
    const token = await getToken({ req, secret: AUTH_SECRET });
    if (!token || !token.accessToken ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching data from Google Sheets");
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token.accessToken });

    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME,
    });

    const rows = result.data.values;
    if (!rows) {
      throw new Error("No data found in the spreadsheet");
    }
    const registrations = rows.slice(1).map((row) => ({
      registrationDate: row[0],
      email: row[1],
      name: row[2],
      venmoHandle: row[7],
      markedPaidByDave: row[8],
    }));

    return NextResponse.json({ registrations });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

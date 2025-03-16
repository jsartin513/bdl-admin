import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

const SHEET_ID = "1A-TL2ah68H388xT6294h8T0GxfE9yIqiRNYJq_tMf60";
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const ENCODED_PRIVATE_KEY = process.env.BASE64_GOOGLE_PRIVATE_KEY;

const PRIVATE_KEY = ENCODED_PRIVATE_KEY
  ? Buffer.from(ENCODED_PRIVATE_KEY, "base64").toString("utf-8")
  : undefined;

if (!CLIENT_EMAIL || !PRIVATE_KEY) {
  throw new Error("Missing Google service account credentials");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = async (req: NextRequest) => {
  try {
    console.log("Fetching data from Google Sheets");
    const auth = new GoogleAuth({
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: PRIVATE_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive"],
      projectId: "gen-lang-client-0392038781",
      
    });
    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Form Responses 1",
    });

    const rows = result.data.values;
    if (!rows) {
      throw new Error("No data found in the spreadsheet");
    }
    const registrations = rows.slice(1).map((row) => ({
      name: row[0],
      email: row[1],
      registrationDate: row[2],
    }));

    return NextResponse.json({ registrations });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
};

export async function GET(req: NextRequest) {
  return handler(req);
}

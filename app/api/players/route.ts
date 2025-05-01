import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = "1C16RppqLLagKF2vz-gYpdHCU0AszgvGibkC_lfZF4RQ";
const SHEET_NAME = "Form Responses 1"; // Replace with the actual sheet name

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

    console.log("Fetching player data from Google Sheets");
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME,
    });

    const rows = result.data.values;
    if (!rows || rows.length < 2) {
      throw new Error("No data found in the spreadsheet");
    }

    // Map the rows to extract player information
    const players = rows.slice(1).map((row) => ({
      email: row[1], // Assuming email is in the second column
      fullName: row[2], // Assuming full name is in the third column
      waiverTimestamp: row[0], // Assuming timestamp is in the first column
    }));

    return NextResponse.json({ players });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
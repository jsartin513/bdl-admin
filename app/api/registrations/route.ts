import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Tournament 4 registration form
// const SHEET_ID = "19_KylHMmaft-a2FXXM9EWJTMRVo4hAOqV4VN5ASyBiY"; 

// Tester form for registration
const SHEET_ID = "1y_F-hwJ-qZnsNz-YnmUK0fyMo3hpA6Thr_UC6PYbR_k";
const SHEET_NAME = "Form Responses 1";

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

    if (!session || !session.accessToken || !session.refreshToken || !session.expiresAt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching data from Google Sheets");

    const googleOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Check if the access token is expired
    const isTokenExpired = Date.now() >= session.expiresAt;

    if (isTokenExpired) {
      console.log("Access token expired. Refreshing token...");
      googleOAuth2Client.setCredentials({ refresh_token: session.refreshToken });

      try {
        const { credentials } = await googleOAuth2Client.refreshAccessToken();
        session.accessToken = credentials.access_token;
        session.expiresAt = credentials.expiry_date;

        console.log("New access token:", session.accessToken);
        console.log("New expiry date:", session.expiresAt);
      } catch (err) {
        console.error("Failed to refresh access token:", err);
        return NextResponse.json({ error: "Failed to refresh access token" }, { status: 401 });
      }
    }

    // Set the credentials for the Google Sheets API
    googleOAuth2Client.setCredentials({ access_token: session.accessToken });

    const sheets = google.sheets({ version: "v4", auth: googleOAuth2Client });

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

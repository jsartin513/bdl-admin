import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import jwt from "jsonwebtoken"; // Install this package if not already installed

const SHEET_ID = "1A-TL2ah68H388xT6294h8T0GxfE9yIqiRNYJq_tMf60";
const SHEET_NAME = "Form Responses 1";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie =
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";

    const sessionToken = req.cookies.get(sessionCookie)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized: Session token not found" }, { status: 401 });
    }

    // Decode the session token (assuming it's a JWT)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let decodedToken: any;
    try {
      decodedToken = jwt.decode(sessionToken);
    } catch (err) {
      console.error("Failed to decode session token", err);
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }

    // Extract accessToken or other required data from the decoded token
    const accessToken = decodedToken?.accessToken;
    if (!accessToken) {
      console.log("Access token not found in session");
      console.log("Decoded token:", decodedToken);
      return NextResponse.json({ error: "Unauthorized: Access token not found in session" }, { status: 401 });
    }

    console.log("Fetching data from Google Sheets");
    const gAuth = new google.auth.OAuth2();
    gAuth.setCredentials({ access_token: accessToken });
    console.log("auth", gAuth);
    console.log("access_token", accessToken);

    const sheets = google.sheets({ version: "v4", auth: gAuth });

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

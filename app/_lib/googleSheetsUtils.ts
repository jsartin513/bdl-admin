import { google } from "googleapis";

import { OAuth2Client } from "google-auth-library";

interface GoogleSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function authenticateWithGoogle(session: GoogleSession) {
  if (!session || !session.accessToken || !session.refreshToken || !session.expiresAt) {
    throw new Error("Unauthorized");
  }

  const googleOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const isTokenExpired = Date.now() >= session.expiresAt;

  if (isTokenExpired) {
    console.log("Access token expired. Refreshing token...");
    googleOAuth2Client.setCredentials({ refresh_token: session.refreshToken });

    const { credentials } = await googleOAuth2Client.refreshAccessToken();
    session.accessToken = credentials.access_token ?? "";
    session.expiresAt = credentials.expiry_date ?? 0;

    console.log("New access token:", session.accessToken);
    console.log("New expiry date:", session.expiresAt);
  }

  googleOAuth2Client.setCredentials({ access_token: session.accessToken });
  return googleOAuth2Client;
}

export async function fetchSheetData(auth: OAuth2Client, sheetId: string, sheetName: string) {
  if (!sheetId || !sheetName) {
    throw new Error("Missing sheetId or sheetName");
  }

  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetName,
  });

  const rows = result.data.values;
  if (!rows) {
    throw new Error("No data found in the spreadsheet");
  }

  return rows;
}
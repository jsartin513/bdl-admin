import { google } from "googleapis";

import { OAuth2Client } from "google-auth-library";

interface GoogleSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function authenticateWithGoogle(session: GoogleSession) {
  if (!session || !session.accessToken || !session.refreshToken || !session.expiresAt) {
    throw new Error("Unauthorized: Missing required session data");
  }

  const googleOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Token refresh is now handled in the JWT callback in auth.ts
  // so we can directly use the access token from the session
  googleOAuth2Client.setCredentials({ 
    access_token: session.accessToken,
    refresh_token: session.refreshToken
  });
  
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
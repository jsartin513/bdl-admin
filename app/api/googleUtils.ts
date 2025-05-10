import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

interface GoogleSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function authenticateWithGoogle(session: GoogleSession) {
  if (!session || !session.accessToken || !session.refreshToken || !session.expiresAt) {
    throw new Error("Unauthorized: Missing session details");
  }

  const googleOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const isTokenExpired = Date.now() >= session.expiresAt;

  if (isTokenExpired) {
    console.log("Access token expired. Attempting to refresh...");
    googleOAuth2Client.setCredentials({ refresh_token: session.refreshToken });

    try {
      const { credentials } = await googleOAuth2Client.refreshAccessToken();
      session.accessToken = credentials.access_token || "";
      session.expiresAt = credentials.expiry_date || 0;

      console.log("Token refreshed successfully:");
      console.log("New access token:", session.accessToken);
      console.log("New expiry date:", session.expiresAt);
    } catch (error) {
      console.error("Failed to refresh access token:", error);
      throw new Error("Failed to refresh access token");
    }
  }

  googleOAuth2Client.setCredentials({ access_token: session.accessToken });

  // Verify the token to ensure it's valid
  try {
    await googleOAuth2Client.getAccessToken();
  } catch (error) {
    console.error("Access token verification failed:", error);
    throw new Error("Invalid or expired access token");
  }

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

export async function getRegistrations(auth: OAuth2Client, sheetId: string, sheetName: string) {
  const rows = await fetchSheetData(auth, sheetId, sheetName);

  return rows.slice(1).map((row) => ({
    registrationDate: row[0],
    email: row[1],
    name: row[2],
    venmoHandle: row[7],
    markedPaidByDave: row[8],
  }));
}

export async function getPlayers(auth: OAuth2Client, sheetId: string, sheetName: string) {
  const rows = await fetchSheetData(auth, sheetId, sheetName);

  return rows.slice(1).map((row) => ({
    email: row[1],
    fullName: row[2],
    waiverTimestamp: row[0],
  }));
}

export async function getPayments(auth: OAuth2Client, sheetId: string, sheetName: string) {
  const rows = await fetchSheetData(auth, sheetId, sheetName);

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

  return {
    payments,
    latestPaymentTimestamp: new Date(latestPaymentTimestamp).toISOString(),
  };
}
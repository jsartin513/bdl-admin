import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const SHEET_ID = '1eD-x1T1tcjB4xG-4Jn69pzavPokYL2CVAbZqXZJ5esc';
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!CLIENT_EMAIL || !PRIVATE_KEY) {
  throw new Error('Missing Google service account credentials');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = async (req: NextRequest) => {
  try {
    console.log('Fetching data from Google Sheets');
    const auth = new GoogleAuth({
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: PRIVATE_KEY,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1',
    });

    const rows = result.data.values;
    if (!rows) {
      throw new Error('No data found in the spreadsheet');
    }
    const payments = rows.slice(1).map((row) => ({
      id: `payment-${row[0]}`,
      // datetime: row[1],
      type: row[2],
      status: row[3],
      note: row[4],
      from: row[5],
      to: row[6],
      amountTotal: row[7],
      amountTip: row[8],
      amountTax: row[9],
      amountFee: row[10],
      taxRate: row[11],
      taxExempt: row[12],
      // fundingSource: row[13],
      // destination: row[14],
      // beginningBalance: row[15],
      // endingBalance: row[16],
      // statementPeriodVenmoFees: row[17],
      // terminalLocation: row[18],
      // yearToDateVenmoFees: row[19],
    }));

    return NextResponse.json({ payments });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
};

export async function GET(req: NextRequest) {
  return handler(req);
}
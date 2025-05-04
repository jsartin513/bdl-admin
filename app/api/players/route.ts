import { NextRequest, NextResponse } from "next/server";
import { authenticateWithGoogle, fetchSheetData } from "../../_lib/googleSheetsUtils";

const SHEET_ID = "1C16RppqLLagKF2vz-gYpdHCU0AszgvGibkC_lfZF4RQ";
const SHEET_NAME = "Form Responses 1";

export async function GET(req: NextRequest) {
  try {
    const sessionHeader = req.headers.get("X-Session");
    const session = sessionHeader ? JSON.parse(sessionHeader) : null;

    const auth = await authenticateWithGoogle(session);

    const rows = await fetchSheetData(auth, SHEET_ID, SHEET_NAME);

    const players = rows.slice(1).map((row) => ({
      email: row[1],
      fullName: row[2],
      waiverTimestamp: row[0],
    }));

    return NextResponse.json({ players });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
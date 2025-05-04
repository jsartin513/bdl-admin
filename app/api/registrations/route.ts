import { NextRequest, NextResponse } from "next/server";
import { authenticateWithGoogle, fetchSheetData } from "../../_lib/googleSheetsUtils";

export async function GET(req: NextRequest) {
  try {
    const sessionHeader = req.headers.get("X-Session");
    const session = sessionHeader ? JSON.parse(sessionHeader) : null;

    const auth = await authenticateWithGoogle(session);

    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get("sheetId");
    const sheetName = searchParams.get("sheetName");

    const rows = await fetchSheetData(auth, sheetId, sheetName);

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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

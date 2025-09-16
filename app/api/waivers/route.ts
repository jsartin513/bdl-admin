import { NextRequest, NextResponse } from "next/server";
import { authenticateWithGoogle, fetchSheetData } from "../../_lib/googleSheetsUtils";

const WAIVERS_SHEET_ID = "1C16RppqLLagKF2vz-gYpdHCU0AszgvGibkC_lfZF4RQ";
const WAIVERS_SHEET_NAME = "Form Responses 1";
const REGISTRATION_SHEET_NAME = "Form Responses 1";

function getFirstName(name: string) {
  return name?.trim().split(" ")[0]?.toLowerCase() || "";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get("sheetId");
    if (!sheetId) {
      return NextResponse.json({ error: "Missing sheetId parameter" }, { status: 400 });
    }

    const sessionHeader = req.headers.get("X-Session");
    const session = sessionHeader ? JSON.parse(sessionHeader) : null;
    const auth = await authenticateWithGoogle(session);

    // Fetch waivers
    const waiversRows = await fetchSheetData(auth, WAIVERS_SHEET_ID, WAIVERS_SHEET_NAME);
    const waivers = waiversRows.slice(1).map((row) => ({
      email: row[1]?.trim().toLowerCase(),
      fullName: row[2]?.trim(),
      waiverTimestamp: row[0],
      firstName: getFirstName(row[2]),
    }));

    // Fetch registrants
    const registrantRows = await fetchSheetData(auth, sheetId, REGISTRATION_SHEET_NAME);
    const registrants = registrantRows.slice(1).map((row) => ({
      registrationDate: row[0],
      email: row[1]?.trim().toLowerCase(),
      name: row[2]?.trim(),
      firstName: getFirstName(row[2]),
    }));

    // Match registrants to waivers
    const results = registrants.map((registrant) => {
      // Try to match by email
      let waiver = waivers.find(w => w.email && w.email === registrant.email);
      // If not found, try to match by first name
      if (!waiver && registrant.firstName) {
        waiver = waivers.find(w => w.firstName && w.firstName === registrant.firstName);
      }
      return {
        ...registrant,
        waiverTimestamp: waiver ? waiver.waiverTimestamp : null,
        waiverStatus: waiver ? "Waiver Signed" : "No waiver found",
      };
    });

    // Order: Waiver Signed first, then No waiver found
    results.sort((a, b) => {
      if (a.waiverStatus === b.waiverStatus) return 0;
      return a.waiverStatus === "Waiver Signed" ? -1 : 1;
    });

    return NextResponse.json({ registrants: results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
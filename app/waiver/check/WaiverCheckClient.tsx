"use client";
import React, { useState } from "react";

type Registrant = {
  registrationDate: string;
  email: string;
  name: string;
  waiverTimestamp: string | null;
  waiverStatus: string;
};

type Session = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
} | null;

function extractSheetId(url: string): string | null {
  // Handle various Google Sheets URL formats:
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
  // https://docs.google.com/spreadsheets/d/SHEET_ID
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

interface WaiverCheckClientProps {
  session: Session;
}

export default function WaiverCheckClient({ session }: WaiverCheckClientProps) {
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setRegistrants([]);

    try {
      const sheetId = extractSheetId(spreadsheetUrl);
      if (!sheetId) {
        throw new Error("Invalid Google Sheets URL. Please make sure you're using a valid Google Sheets link.");
      }

      const res = await fetch(`/api/waivers?sheetId=${sheetId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Session": JSON.stringify(session),
        },
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch data");
      }

      setRegistrants(data.registrants || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
    setLoading(false);
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Check Registration & Waiver Status</h1>
        <p className="text-gray-600 text-lg">Enter a Google Sheets URL to check which registrants have signed waivers.</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Sheets URL:
        </label>
        <input
          type="text"
          value={spreadsheetUrl}
          onChange={(e) => setSpreadsheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit..."
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <button 
          onClick={handleCheck} 
          disabled={loading || !spreadsheetUrl.trim()}
          className={`mt-4 px-6 py-3 rounded-md font-medium text-sm transition-colors ${
            loading || !spreadsheetUrl.trim()
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          }`}
        >
          {loading ? "Checking..." : "Check Waivers"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-8">
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      )}

      {registrants.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Results ({registrants.length} registrants)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waiver Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waiver Timestamp</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registrants.map((r, i) => (
                  <tr key={i} className={r.waiverStatus === "No waiver found" ? "bg-red-50" : "bg-green-50"}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.registrationDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        r.waiverStatus === "No waiver found" 
                          ? "bg-red-100 text-red-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        {r.waiverStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.waiverTimestamp || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

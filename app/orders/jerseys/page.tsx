import React from "react";

const SHEET_ID = "1E9kE244j1KcIMSaskSFSiOKNQEDZnJJ80cseotEkyuE";
const SHEET_NAME = "Form Responses 1";

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
  SHEET_NAME
)}`;

type Jersey = {
  timestamp: string;
  email: string;
  reviewedSizeChart: string;
  size: string;
  sleeveLength: string;
  preferredNameOnBack: string;
  number: string;
  jerseysWanted: string;
  venmo: string;
  notes: string;
};

function parseJerseysFromRow(row: string[]): Jersey[] {
  const [
    timestamp,
    email,
    reviewedSizeChart,
    size,
    sleeveLength,
    preferredNameOnBack,
    number,
    jerseysWanted,
    venmo,
    notes,
  ] = row;

  if (!jerseysWanted) {
    return [
      {
        timestamp,
        email,
        reviewedSizeChart,
        size,
        sleeveLength,
        preferredNameOnBack,
        number,
        jerseysWanted: "",
        venmo,
        notes,
      },
    ];
  }

  return jerseysWanted.split(";").map((entry) => {
    if (!entry.trim()) {
      return {
        timestamp,
        email,
        reviewedSizeChart,
        size,
        sleeveLength,
        preferredNameOnBack,
        number,
        jerseysWanted: "",
        venmo,
        notes,
      };
    }
    const [name, num, sz, sleeve] = entry.split(",").map((s) => s.trim());
    return {
      timestamp,
      email,
      reviewedSizeChart,
      size: sz || size,
      sleeveLength: sleeve || sleeveLength,
      preferredNameOnBack: preferredNameOnBack,
      number: num || number,
      jerseysWanted: entry,
      venmo,
      notes,
    };
  });
}

async function fetchJerseyOrders(): Promise<Jersey[]> {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  const csv = await res.text();
  const rows = csv
    .split("\n")
    .map((line) => line.split(","));
  const dataRows = rows.slice(1);
  return dataRows.flatMap(parseJerseysFromRow);
}

// Group jerseys by the "jerseysWanted" field (the original entry)
function groupByJerseyWanted(jerseys: Jersey[]) {
  const groups: Record<string, Jersey[]> = {};
  jerseys.forEach((jersey) => {
    const key = jersey.jerseysWanted || "Unspecified";
    if (!groups[key]) groups[key] = [];
    groups[key].push(jersey);
  });
  return groups;
}

export default async function JerseysPage() {
  const allJerseys = await fetchJerseyOrders();
  const grouped = groupByJerseyWanted(allJerseys);

  return (
    <main>
      <h1>Fourth Throwdown Jersey Orders</h1>
      {Object.entries(grouped).map(([jerseyType, jerseys]) => (
        <section key={jerseyType} style={{ marginBottom: 40 }}>
          <h2>Jersey: {jerseyType || "Unspecified"}</h2>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Size</th>
                <th>Sleeve Length</th>
                <th>Preferred Name on Back</th>
                <th>Number</th>
                <th>Venmo/Stripe</th>
                <th>Other Notes</th>
              </tr>
            </thead>
            <tbody>
              {jerseys.map((jersey, idx) => (
                <tr key={idx}>
                  <td>{jersey.email}</td>
                  <td>{jersey.size}</td>
                  <td>{jersey.sleeveLength}</td>
                  <td>{jersey.preferredNameOnBack}</td>
                  <td>{jersey.number}</td>
                  <td>{jersey.venmo}</td>
                  <td>{jersey.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
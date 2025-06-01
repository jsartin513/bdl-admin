/* eslint-disable @typescript-eslint/no-unused-vars */
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

export default async function JerseysPage() {
  const allJerseys = await fetchJerseyOrders();

  return (
    <main>
      <h1>Fourth Throwdown Jersey Orders</h1>
      <table>
        <thead>
          <tr>
            {/* <th>Timestamp</th> */}
            <th>Email</th>
            {/* <th>Reviewed Size Chart</th> */}
            <th>Size</th>
            <th>Sleeve Length</th>
            <th>Preferred Name on Back</th>
            <th>Number</th>
            <th>Jersey(s) Wanted</th>
            <th>Venmo/Stripe</th>
            <th>Other Notes</th>
          </tr>
        </thead>
        <tbody>
          {allJerseys.map((jersey, idx) => (
            <tr key={idx}>
              {/* <td>{jersey.timestamp}</td> */}
              <td>{jersey.email}</td>
              {/* <td>{jersey.reviewedSizeChart}</td> */}
              <td>{jersey.size}</td>
              <td>{jersey.sleeveLength}</td>
              <td>{jersey.preferredNameOnBack}</td>
              <td>{jersey.number}</td>
              <td>{jersey.jerseysWanted}</td>
              <td>{jersey.venmo}</td>
              <td>{jersey.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
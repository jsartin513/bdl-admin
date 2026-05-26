import { readFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

const SCHEDULE_FILE = 'throwdown_5_scheudle.csv';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), SCHEDULE_FILE);
    const csv = await readFile(filePath, 'utf-8');
    return NextResponse.json({ csv, filename: SCHEDULE_FILE });
  } catch (err) {
    console.error('tournament-schedule GET:', err);
    return NextResponse.json(
      { error: `Could not read ${SCHEDULE_FILE}. Place it in the project root.` },
      { status: 404 }
    );
  }
}

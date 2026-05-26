import { access, readFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

const SCHEDULE_FILE = 'throwdown_5_schedule.csv';

async function resolveSchedulePath(): Promise<{ filePath: string; filename: string }> {
  const filePath = path.join(process.cwd(), SCHEDULE_FILE);
  try {
    await access(filePath);
    return { filePath, filename: SCHEDULE_FILE };
  } catch {
    throw new Error(`Schedule file not found. Add ${SCHEDULE_FILE} to the project root.`);
  }
}

export async function GET() {
  try {
    const { filePath, filename } = await resolveSchedulePath();
    const csv = await readFile(filePath, 'utf-8');
    return NextResponse.json({ csv, filename });
  } catch (err) {
    console.error('tournament-schedule GET:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Could not read tournament schedule CSV from project root.',
      },
      { status: 404 }
    );
  }
}

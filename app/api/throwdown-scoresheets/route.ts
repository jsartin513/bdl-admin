import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { buildScoresheetsBuffer, buildScoresheetCards } from '@/app/lib/throwdownScoresheets';

const SCHEDULE_FILE = 'throwdown_5_schedule.csv';

async function resolveSchedulePath(): Promise<{ filePath: string; filename: string }> {
  const filePath = join(process.cwd(), SCHEDULE_FILE);
  try {
    const { access } = await import('fs/promises');
    await access(filePath);
    return { filePath, filename: SCHEDULE_FILE };
  } catch {
    throw new Error(`Schedule file not found. Add ${SCHEDULE_FILE} to the project root.`);
  }
}

function safeDownloadName(name: string | undefined): string {
  const fallback = 'Throw_Down_Scoresheets';
  const base = (name ?? fallback).trim() || fallback;
  const cleaned = base.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
  return cleaned.toLowerCase().endsWith('.xlsx') ? cleaned : `${cleaned}.xlsx`;
}

export async function GET() {
  try {
    const { filePath, filename } = await resolveSchedulePath();
    const csv = await readFile(filePath, 'utf-8');
    const cards = buildScoresheetCards(csv);
    return NextResponse.json({ csv, filename, cardCount: cards.length });
  } catch (err) {
    console.error('throwdown-scoresheets GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read schedule CSV.' },
      { status: 404 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { csv?: string; outputName?: string };
    const csv = body.csv?.trim();
    if (!csv) {
      return NextResponse.json({ error: 'CSV content is required.' }, { status: 400 });
    }

    const cards = buildScoresheetCards(csv);
    if (cards.length === 0) {
      return NextResponse.json(
        { error: 'No group-phase games found. Check that the CSV is a Throw Down schedule export.' },
        { status: 400 }
      );
    }

    const buffer = buildScoresheetsBuffer(csv);
    const filename = safeDownloadName(body.outputName);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('throwdown-scoresheets POST failed:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to build scoresheets workbook.' },
      { status: 500 }
    );
  }
}

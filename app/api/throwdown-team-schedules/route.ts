import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildTeamSchedulesBuffer,
  defaultTeamSchedulesFilename,
  groupPhaseTeams,
  parseThrowdownScheduleCsv,
} from '@/app/lib/buildTeamSchedules';

const SAMPLE_CSV = join(process.cwd(), 'schedule_data', 'schedule_may_27.csv');

function safeDownloadName(name: string | undefined): string {
  const base = (name ?? defaultTeamSchedulesFilename()).trim() || defaultTeamSchedulesFilename();
  const cleaned = base.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
  return cleaned.toLowerCase().endsWith('.xlsx') ? cleaned : `${cleaned}.xlsx`;
}

export async function GET() {
  try {
    const csv = await readFile(SAMPLE_CSV, 'utf-8');
    return NextResponse.json({
      csv,
      filename: 'schedule_may_27.csv',
    });
  } catch {
    return NextResponse.json({ error: 'Sample schedule CSV not found.' }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { csv?: string; outputName?: string };
    const csv = body.csv?.trim();
    if (!csv) {
      return NextResponse.json({ error: 'CSV content is required.' }, { status: 400 });
    }

    const games = parseThrowdownScheduleCsv(csv);
    const teams = groupPhaseTeams(games);
    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'No group-phase teams found. Check that the CSV is a Throw Down schedule export.' },
        { status: 400 }
      );
    }

    const buffer = buildTeamSchedulesBuffer(csv);
    const filename = safeDownloadName(body.outputName);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('throwdown-team-schedules failed:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to build team schedules.' },
      { status: 500 }
    );
  }
}

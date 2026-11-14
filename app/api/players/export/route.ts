import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  buildPlayersExportCsv,
  playersExportFilename,
  type PlayerExportRowInput,
} from '@/app/lib/players/export-csv'
import { parseListPlayersSearchParams } from '@/app/lib/players/list-params'
import { getLastLeagueEventByPlayerIds, listPlayers } from '@/app/lib/players/queries'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const opts = parseListPlayersSearchParams(request.nextUrl.searchParams)
    const players = await listPlayers(opts)
    const lastLeagueByPlayer = await getLastLeagueEventByPlayerIds(players.map((p) => p.id))

    const rows: PlayerExportRowInput[] = players.map((player) => ({
      player,
      lastLeagueEvent: lastLeagueByPlayer.get(player.id) ?? null,
    }))

    const generatedAt = new Date()
    const csv = buildPlayersExportCsv(rows)
    const filename = playersExportFilename(generatedAt)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export players'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { describe, expect, it } from 'vitest';
import { parseScheduleCSV } from '../scheduleParser';

function csvFromGames(
  rows: Array<{ game: string; home: string; away: string }>
): string {
  const lines = rows.map(
    (r) => `"${r.game}","${r.home}","","${r.away}","","","","","",""`
  );
  return lines.join('\n');
}

describe('parseScheduleCSV duplicate-orientation-same-night', () => {
  it('does not warn when a 3-game pairing uses a 2+1 home/away split', () => {
    const csv = csvFromGames([
      { game: 'Game 01', home: 'Team 1', away: 'Team 2' },
      { game: 'Game 02', home: 'Team 2', away: 'Team 1' },
      { game: 'Game 03', home: 'Team 1', away: 'Team 2' },
    ]);

    const { conflicts } = parseScheduleCSV(csv, { selectedWeek: '1' });
    const dup = conflicts.filter((c) => c.conflictType === 'duplicate-orientation-same-night');
    expect(dup).toHaveLength(0);
  });

  it('warns when all games in a pairing use the same home/away orientation', () => {
    const csv = csvFromGames([
      { game: 'Game 01', home: 'Team 1', away: 'Team 2' },
      { game: 'Game 02', home: 'Team 1', away: 'Team 2' },
    ]);

    const { conflicts } = parseScheduleCSV(csv, { selectedWeek: '1' });
    const dup = conflicts.filter((c) => c.conflictType === 'duplicate-orientation-same-night');
    expect(dup).toHaveLength(1);
    expect(dup[0].conflicts[0]).toContain('Same home/away matchup 2 times');
  });

  it('warns when a 3-game pairing uses the same orientation all 3 times', () => {
    const csv = csvFromGames([
      { game: 'Game 01', home: 'Team 1', away: 'Team 2' },
      { game: 'Game 02', home: 'Team 1', away: 'Team 2' },
      { game: 'Game 03', home: 'Team 1', away: 'Team 2' },
    ]);

    const { conflicts } = parseScheduleCSV(csv, { selectedWeek: '1' });
    const dup = conflicts.filter((c) => c.conflictType === 'duplicate-orientation-same-night');
    expect(dup).toHaveLength(1);
    expect(dup[0].conflicts[0]).toContain('expected at most 2');
  });
});

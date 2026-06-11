"""Shared schedule format helpers for league spreadsheet tooling."""

TEAM_REF = "team-ref"
DEDICATED_REF = "dedicated-ref"
VALID_FORMATS = (TEAM_REF, DEDICATED_REF)


def normalize_format(value=None) -> str:
    if not value:
        return TEAM_REF
    normalized = value.strip().lower().replace("_", "-")
    if normalized in VALID_FORMATS:
        return normalized
    return TEAM_REF


def read_format_from_teams_sheet(ws) -> str:
    """Read schedule format from Teams sheet row 2 (A=label, B=value)."""
    label = ws.cell(2, 1).value
    value = ws.cell(2, 2).value
    if label and isinstance(label, str) and "schedule format" in label.lower():
        return normalize_format(str(value) if value else None)
    return TEAM_REF


def write_format_to_teams_sheet(ws, schedule_format: str) -> None:
    ws.cell(2, 1).value = "Schedule format"
    ws.cell(2, 2).value = normalize_format(schedule_format)


def detect_format_from_week_sheet(ws) -> str:
    """Infer format from first game block: dedicated-ref if next row is another game."""
    for row in range(1, 40):
        cell_a = ws.cell(row, 1).value
        if cell_a and isinstance(cell_a, str) and cell_a.strip().startswith("Game "):
            next_b = ws.cell(row + 1, 2).value
            next_a = ws.cell(row + 1, 1).value
            if next_a and isinstance(next_a, str) and next_a.strip().startswith("Game "):
                return DEDICATED_REF
            if next_b and isinstance(next_b, str):
                lower = next_b.strip().lower()
                if lower in ("ref", "refs") or lower.startswith("refs:"):
                    return TEAM_REF
            return DEDICATED_REF
    return TEAM_REF


def count_games_on_week_sheet(ws) -> int:
    count = 0
    for row in range(1, 500):
        cell = ws.cell(row, 1).value
        if cell and isinstance(cell, str) and cell.strip().startswith("Game "):
            count += 1
    return count


def win_loss_start_row(num_games: int, schedule_format: str) -> int:
    """First row for 'Team Wins/Losses This Week' header."""
    first_game_row = 2
    rows_per_game = 1 if schedule_format == DEDICATED_REF else 2
    return first_game_row + num_games * rows_per_game + 1

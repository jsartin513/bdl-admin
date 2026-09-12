#!/usr/bin/env python3
"""
Create a complete 8-team / 2-court team-ref league spreadsheet.

Usage:
  python3 create_eight_team_league.py "Eight Team League.xlsx" \\
    "Team 1" "Team 2" "Team 3" "Team 4" "Team 5" "Team 6" "Team 7" "Team 8"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from scripts.generate_8team_teamref_schedule import (  # noqa: E402
    NUM_TEAMS,
    NUM_WEEKS_DEFAULT,
    build_season,
    setup_dual_court_standings,
    validate_season,
    write_workbook,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create an 8-team / 2-court team-ref league workbook with standings formulas"
    )
    parser.add_argument("output_path", help="Output .xlsx path")
    parser.add_argument(
        "teams",
        nargs=NUM_TEAMS,
        metavar="TEAM",
        help=f"Exactly {NUM_TEAMS} team names",
    )
    parser.add_argument("--weeks", type=int, default=NUM_WEEKS_DEFAULT)
    parser.add_argument(
        "--league-name",
        default="Eight Team Team-Ref League",
        help="League name stored on Teams sheet",
    )
    args = parser.parse_args()

    teams = list(args.teams)
    output_path = Path(args.output_path)
    if not output_path.is_absolute():
        output_path = ROOT / output_path

    weeks = build_season(teams, args.weeks)
    errors = validate_season(teams, weeks)
    if errors:
        print("Schedule validation failed:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"Creating workbook: {output_path}")
    write_workbook(output_path, teams, weeks, league_name=args.league_name)

    print("Setting up dual-court standings formulas...")
    setup_dual_court_standings(output_path, teams)

    print(f"Done: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

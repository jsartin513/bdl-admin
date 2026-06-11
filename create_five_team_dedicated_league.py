#!/usr/bin/env python3
"""
Create a complete 5-team dedicated-ref league spreadsheet.

Usage:
  python3 create_five_team_dedicated_league.py "Five Team Dedicated Ref League.xlsx" \\
    "Team 1" "Team 2" "Team 3" "Team 4" "Team 5"
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from scripts.generate_5team_dedicated_schedule import (  # noqa: E402
    NUM_WEEKS_DEFAULT,
    build_season,
    validate_season,
    write_workbook,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a 5-team dedicated-ref league workbook with standings formulas"
    )
    parser.add_argument("output_path", help="Output .xlsx path")
    parser.add_argument(
        "teams",
        nargs=5,
        metavar="TEAM",
        help="Exactly five team names",
    )
    parser.add_argument("--weeks", type=int, default=NUM_WEEKS_DEFAULT)
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
    write_workbook(output_path, teams, weeks)

    print("Setting up standings formulas...")
    result = subprocess.run(
        [sys.executable, str(ROOT / "setup_standings.py"), str(output_path)],
        cwd=str(ROOT),
        check=False,
    )
    if result.returncode != 0:
        print("setup_standings.py failed")
        return result.returncode

    print(f"Done: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

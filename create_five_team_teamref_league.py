#!/usr/bin/env python3
"""
Create a complete 5-team team-ref round-robin league spreadsheet.

Each team plays every other team once on 2 courts.
Default: Hyperdrive cannot dual-ref (7 players), so they get two single-court
ref rounds; other teams dual-ref once (counts as 2 refs).
Balance: 2 home, 2 away, 2 refs per team.

Usage:
  python3 create_five_team_teamref_league.py "Five Team Round Robin.xlsx" \\
    "Carbon Fiber" "Velocity Syndicate" "Hyperdrive" "High Octane" "Full Throttle"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from scripts.generate_5team_teamref_schedule import (  # noqa: E402
    build_rounds,
    format_schedule_text,
    validate_rounds,
    write_workbook,
)

DEFAULT_TEAMS = [
    "Carbon Fiber",
    "Velocity Syndicate",
    "Hyperdrive",
    "High Octane",
    "Full Throttle",
]
DEFAULT_NO_DUAL_REF = "Hyperdrive"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a 5-team 2-court team-ref round-robin workbook"
    )
    parser.add_argument(
        "output_path",
        nargs="?",
        default="public/league_schedules/Five Team Round Robin.xlsx",
        help="Output .xlsx path",
    )
    parser.add_argument(
        "teams",
        nargs="*",
        metavar="TEAM",
        help="Exactly five team names (defaults to Carbon Fiber … Full Throttle)",
    )
    parser.add_argument(
        "--league-name",
        default="Five Team Round Robin",
        help="League name stored on Teams sheet",
    )
    parser.add_argument(
        "--no-dual-ref",
        default=None,
        metavar="TEAM",
        help=(
            "Team that cannot ref both courts "
            f"(default for named teams: {DEFAULT_NO_DUAL_REF}; "
            "pass empty string to allow all dual-refs)"
        ),
    )
    args = parser.parse_args()

    teams = list(args.teams) if args.teams else list(DEFAULT_TEAMS)
    if len(teams) != 5:
        print(f"ERROR: need exactly 5 teams, got {len(teams)}")
        return 1

    if args.no_dual_ref is None:
        no_dual_ref = DEFAULT_NO_DUAL_REF if DEFAULT_NO_DUAL_REF in teams else None
    elif args.no_dual_ref == "":
        no_dual_ref = None
    else:
        no_dual_ref = args.no_dual_ref

    if no_dual_ref and no_dual_ref not in teams:
        print(f"ERROR: --no-dual-ref {no_dual_ref!r} is not in the team list")
        return 1

    output_path = Path(args.output_path)
    if not output_path.is_absolute():
        output_path = ROOT / output_path

    rounds = build_rounds(teams, no_dual_ref=no_dual_ref)
    errors = validate_rounds(teams, rounds, no_dual_ref=no_dual_ref)
    if errors:
        print("Schedule validation failed:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(format_schedule_text(teams, rounds, no_dual_ref=no_dual_ref))
    print()
    print(f"Creating workbook: {output_path}")
    write_workbook(
        output_path,
        teams,
        rounds,
        league_name=args.league_name,
        no_dual_ref=no_dual_ref,
    )
    print(f"Done: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

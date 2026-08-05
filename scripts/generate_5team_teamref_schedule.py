#!/usr/bin/env python3
"""
Generate a 5-team, 2-court team-ref round-robin schedule.

Each team plays every other team exactly once (10 games).
Balance targets per team:
  - 2 home games
  - 2 away games
  - 2 refs (reffing both courts in one round counts as 2)

If a team cannot cover both courts (e.g. only 7 players), pass
`--no-dual-ref Hyperdrive`. That team never dual-refs; instead they take
two single-court ref rounds. The other four teams each dual-ref once.
"""

from __future__ import annotations

import argparse
from collections import Counter
from itertools import combinations
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
import sys

sys.path.insert(0, str(ROOT))

from league_schedule_format import TEAM_REF, write_format_to_teams_sheet  # noqa: E402

NUM_TEAMS = 5
HOME_PER_TEAM = 2
AWAY_PER_TEAM = 2
REFS_PER_TEAM = 2


def _is_home(i: int, j: int) -> bool:
    """Regular tournament orientation: i is home vs j iff (j - i) mod 5 ∈ {1, 2}."""
    return ((j - i) % NUM_TEAMS) in (1, 2)


def _ordered(teams: list[str], i: int, j: int) -> tuple[str, str]:
    if _is_home(i, j):
        return teams[i], teams[j]
    return teams[j], teams[i]


def _circle_pairings(n: int = NUM_TEAMS) -> list[tuple[int, list[tuple[int, int]]]]:
    """Standard circle method for odd n: round k has bye when 2i ≡ k (mod n)."""
    out: list[tuple[int, list[tuple[int, int]]]] = []
    for k in range(n):
        bye = (k * ((n + 1) // 2)) % n
        pairs: list[tuple[int, int]] = []
        seen: set[int] = {bye}
        for i in range(n):
            if i in seen:
                continue
            j = (k - i) % n
            if j in seen or j == i:
                continue
            pairs.append((i, j))
            seen.add(i)
            seen.add(j)
        out.append((bye, pairs))
    return out


def build_rounds_all_dual(teams: list[str]) -> list[dict]:
    """5 dual-court rounds; each team byes once and refs both courts."""
    rounds: list[dict] = []
    for round_num, (bye_idx, pairs) in enumerate(_circle_pairings(), start=1):
        if len(pairs) != 2:
            raise RuntimeError(f"round {round_num}: expected 2 pairs, got {pairs}")
        (a, b), (c, d) = pairs
        home1, away1 = _ordered(teams, a, b)
        home2, away2 = _ordered(teams, c, d)
        ref = teams[bye_idx]
        rounds.append(
            {
                "round": round_num,
                "courts": 2,
                "court1": {"home": home1, "away": away1, "ref": ref},
                "court2": {"home": home2, "away": away2, "ref": ref},
                "refs_note": f"{ref} — both courts",
            }
        )
    return rounds


def build_rounds_with_single_ref_team(
    teams: list[str], no_dual_ref: str
) -> list[dict]:
    """
    4 dual-court rounds + 2 single-court rounds.

    `no_dual_ref` never dual-refs: they play all 4 dual-court rounds (vs each
    other team once) and ref the two single-court rounds (1 court each = 2 refs).
    The other four teams each dual-ref once.
    """
    if no_dual_ref not in teams:
        raise ValueError(f"no-dual-ref team {no_dual_ref!r} not in teams {teams}")

    c_idx = teams.index(no_dual_ref)
    others = [i for i in range(NUM_TEAMS) if i != c_idx]

    # Dual-court rounds: C plays each other team once; each other team byes once.
    # When C plays X and Y byes, other court is the remaining two.
    # Interleave the two leftover among-others matchups as single-court rounds.
    #
    # Fixed pattern (indices into `others` rotation):
    # Dual bye=others[0]: C vs others[1], others[2] vs others[3]
    # Dual bye=others[1]: C vs others[2], others[0] vs others[3]
    # Dual bye=others[2]: C vs others[3], others[0] vs others[1]
    # Dual bye=others[3]: C vs others[0], others[1] vs others[2]
    # Singles (remaining among-others edges): others[0] vs others[2], others[1] vs others[3]
    dual_specs = [
        (others[0], (c_idx, others[1]), (others[2], others[3])),
        (others[1], (c_idx, others[2]), (others[0], others[3])),
        (others[2], (c_idx, others[3]), (others[0], others[1])),
        (others[3], (c_idx, others[0]), (others[1], others[2])),
    ]
    single_specs = [
        (others[0], others[2]),
        (others[1], others[3]),
    ]

    # Interleave: D, S, D, D, S, D — spreads Hyperdrive's play/ref load
    sequence: list[tuple[str, object]] = [
        ("dual", dual_specs[0]),
        ("single", single_specs[0]),
        ("dual", dual_specs[1]),
        ("dual", dual_specs[2]),
        ("single", single_specs[1]),
        ("dual", dual_specs[3]),
    ]

    rounds: list[dict] = []
    for round_num, (kind, spec) in enumerate(sequence, start=1):
        if kind == "dual":
            bye_idx, pair1, pair2 = spec  # type: ignore[misc]
            h1, a1 = _ordered(teams, pair1[0], pair1[1])
            h2, a2 = _ordered(teams, pair2[0], pair2[1])
            ref = teams[bye_idx]
            rounds.append(
                {
                    "round": round_num,
                    "courts": 2,
                    "court1": {"home": h1, "away": a1, "ref": ref},
                    "court2": {"home": h2, "away": a2, "ref": ref},
                    "refs_note": f"{ref} — both courts",
                }
            )
        else:
            i, j = spec  # type: ignore[misc]
            h1, a1 = _ordered(teams, i, j)
            rounds.append(
                {
                    "round": round_num,
                    "courts": 1,
                    "court1": {"home": h1, "away": a1, "ref": no_dual_ref},
                    "court2": None,
                    "refs_note": f"{no_dual_ref} — Court 1 only (cannot cover both courts)",
                }
            )
    return rounds


def build_rounds(teams: list[str], no_dual_ref: str | None = None) -> list[dict]:
    if len(teams) != NUM_TEAMS:
        raise ValueError(f"Expected exactly {NUM_TEAMS} teams, got {len(teams)}")
    if no_dual_ref:
        return build_rounds_with_single_ref_team(teams, no_dual_ref)
    return build_rounds_all_dual(teams)


def _iter_court_games(rnd: dict):
    yield rnd["court1"]
    if rnd.get("court2"):
        yield rnd["court2"]


def validate_rounds(
    teams: list[str],
    rounds: list[dict],
    no_dual_ref: str | None = None,
) -> list[str]:
    errors: list[str] = []
    home: Counter[str] = Counter()
    away: Counter[str] = Counter()
    refs: Counter[str] = Counter()
    played_pairs: set[tuple[str, str]] = set()
    dual_ref_rounds: Counter[str] = Counter()

    for rnd in rounds:
        courts = list(_iter_court_games(rnd))
        if rnd["courts"] != len(courts):
            errors.append(f"round {rnd['round']}: courts flag mismatch")

        playing = {g["home"] for g in courts} | {g["away"] for g in courts}
        if len(playing) != 2 * len(courts):
            errors.append(
                f"round {rnd['round']}: expected {2 * len(courts)} distinct "
                f"playing teams, got {playing}"
            )

        sitting = set(teams) - playing
        for g in courts:
            if g["ref"] not in sitting and g["ref"] not in teams:
                errors.append(f"round {rnd['round']}: ref {g['ref']} invalid")
            if g["ref"] in playing:
                errors.append(f"round {rnd['round']}: ref {g['ref']} is also playing")
            home[g["home"]] += 1
            away[g["away"]] += 1
            refs[g["ref"]] += 1
            pair = tuple(sorted((g["home"], g["away"])))
            if pair in played_pairs:
                errors.append(f"duplicate matchup {pair}")
            played_pairs.add(pair)

        if rnd["courts"] == 2:
            ref_set = {g["ref"] for g in courts}
            if len(ref_set) != 1:
                errors.append(
                    f"round {rnd['round']}: dual-court round should have one ref team, "
                    f"got {ref_set}"
                )
            else:
                dual_ref_rounds[next(iter(ref_set))] += 1
            if sitting != ref_set:
                errors.append(
                    f"round {rnd['round']}: dual-court bye/ref mismatch "
                    f"(sitting={sitting}, refs={ref_set})"
                )
        else:
            if len(courts) != 1:
                errors.append(f"round {rnd['round']}: single-court expected 1 game")
            ref = courts[0]["ref"]
            if no_dual_ref and ref != no_dual_ref:
                errors.append(
                    f"round {rnd['round']}: single-court ref should be {no_dual_ref}, "
                    f"got {ref}"
                )

    expected_pairs = {tuple(sorted(p)) for p in combinations(teams, 2)}
    if played_pairs != expected_pairs:
        missing = expected_pairs - played_pairs
        extra = played_pairs - expected_pairs
        if missing:
            errors.append(f"missing matchups: {sorted(missing)}")
        if extra:
            errors.append(f"unexpected matchups: {sorted(extra)}")

    for team in teams:
        if home[team] != HOME_PER_TEAM:
            errors.append(f"{team}: home={home[team]} (want {HOME_PER_TEAM})")
        if away[team] != AWAY_PER_TEAM:
            errors.append(f"{team}: away={away[team]} (want {AWAY_PER_TEAM})")
        if refs[team] != REFS_PER_TEAM:
            errors.append(f"{team}: refs={refs[team]} (want {REFS_PER_TEAM})")

    if no_dual_ref:
        if dual_ref_rounds[no_dual_ref]:
            errors.append(
                f"{no_dual_ref} dual-ref'd {dual_ref_rounds[no_dual_ref]} time(s) "
                "(must be 0)"
            )
        for team in teams:
            if team == no_dual_ref:
                continue
            if dual_ref_rounds[team] != 1:
                errors.append(
                    f"{team}: expected 1 dual-ref round, got {dual_ref_rounds[team]}"
                )

    return errors


def _team_pattern(team: str) -> str:
    if " " in team or team.endswith("*"):
        return f'"{team}*"' if not team.endswith("*") else f'"{team}"'
    return f'"{team}"'


def write_workbook(
    path: str | Path,
    teams: list[str],
    rounds: list[dict] | None = None,
    league_name: str = "Five Team Round Robin",
    week_name: str = "Week 1",
    no_dual_ref: str | None = None,
) -> None:
    path = Path(path)
    rounds = rounds or build_rounds(teams, no_dual_ref=no_dual_ref)
    errors = validate_rounds(teams, rounds, no_dual_ref=no_dual_ref)
    if errors:
        raise ValueError("Invalid schedule:\n  - " + "\n  - ".join(errors))

    wb = openpyxl.Workbook()
    if "Sheet" in wb.sheetnames:
        wb.remove(wb["Sheet"])

    ws_teams = wb.create_sheet("Teams")
    ws_teams.cell(1, 1).value = "Team Names"
    for col, team in enumerate(teams, start=3):
        ws_teams.cell(1, col).value = team
    write_format_to_teams_sheet(ws_teams, TEAM_REF)
    ws_teams.cell(3, 1).value = "League"
    ws_teams.cell(3, 2).value = league_name
    if no_dual_ref:
        ws_teams.cell(4, 1).value = "Cannot dual-ref"
        ws_teams.cell(4, 2).value = no_dual_ref
        ws_teams.cell(5, 1).value = "Note"
        ws_teams.cell(5, 2).value = (
            f"{no_dual_ref} has fewer than 8 players and refs one court at a time only"
        )

    ws_gen = wb.create_sheet("Schedule Generator")
    for col, team in enumerate(teams, start=2):
        ws_gen.cell(2, col).value = team
    for row_idx, team in enumerate(teams, start=3):
        ws_gen.cell(row_idx, 1).value = team
        for col_idx, opponent in enumerate(teams, start=2):
            if team == opponent:
                ws_gen.cell(row_idx, col_idx).value = "-"
            else:
                ws_gen.cell(row_idx, col_idx).value = 1

    ws_standings = wb.create_sheet("League Standings")
    ws_standings.cell(1, 1).value = "LEAGUE STANDINGS"
    ws_standings.cell(2, 1).value = "Team Name"
    ws_standings.cell(2, 2).value = "Points For"
    ws_standings.cell(2, 3).value = "Points Against"
    ws_standings.cell(2, 4).value = "Point Differential"
    ws_standings.cell(11, 1).value = "Week #"
    ws_standings.cell(11, 2).value = 0
    ws_standings.cell(16, 1).value = "Teams"
    ws_standings.cell(16, 2).value = "Wins"
    ws_standings.cell(16, 5).value = "Losses"

    ws = wb.create_sheet(week_name)
    ws.cell(1, 2).value = "Court 1"
    ws.cell(1, 7).value = "Court 2"

    row = 2
    for rnd in rounds:
        c1 = rnd["court1"]
        c2 = rnd.get("court2")
        ws.cell(row, 1).value = f"Game {rnd['round']:02d}"
        ws.cell(row, 2).value = c1["home"]
        ws.cell(row, 4).value = c1["away"]
        if c2:
            ws.cell(row, 7).value = c2["home"]
            ws.cell(row, 9).value = c2["away"]
        else:
            ws.cell(row, 7).value = "(no game — single court)"
        row += 1
        ws.cell(row, 2).value = f"Refs: {c1['ref']}"
        if c2:
            ws.cell(row, 7).value = f"Refs: {c2['ref']}"
        else:
            ws.cell(row, 7).value = rnd["refs_note"]
        row += 1

    # Balance summary
    row += 1
    ws.cell(row, 1).value = "Balance check (home / away / refs)"
    row += 1
    ws.cell(row, 1).value = "Team"
    ws.cell(row, 2).value = "Home"
    ws.cell(row, 3).value = "Away"
    ws.cell(row, 4).value = "Refs"
    row += 1

    home: Counter[str] = Counter()
    away: Counter[str] = Counter()
    refs: Counter[str] = Counter()
    for rnd in rounds:
        for g in _iter_court_games(rnd):
            home[g["home"]] += 1
            away[g["away"]] += 1
            refs[g["ref"]] += 1
    for team in teams:
        ws.cell(row, 1).value = team
        ws.cell(row, 2).value = home[team]
        ws.cell(row, 3).value = away[team]
        ws.cell(row, 4).value = refs[team]
        row += 1

    if no_dual_ref:
        row += 1
        ws.cell(row, 1).value = (
            f"Note: {no_dual_ref} cannot ref both courts (7 players); "
            "they ref Court 1 only in the two single-court rounds."
        )
        row += 1

    # Dual-court win/loss formulas (BYOT-style)
    row += 1
    wl_header = row
    ws.cell(wl_header, 1).value = "Team Wins/Losses This Week"
    ws.cell(wl_header + 1, 1).value = "Team Name"
    ws.cell(wl_header + 1, 2).value = "Wins"
    ws.cell(wl_header + 1, 3).value = "Losses"
    first_data = wl_header + 2
    for i, team in enumerate(teams):
        r = first_data + i
        pat = _team_pattern(team)
        ws.cell(r, 1).value = team
        ws.cell(r, 2).value = (
            f"=SUMIFS(C:C,B:B,{pat})+SUMIFS(E:E,D:D,{pat})+"
            f"SUMIFS(H:H,G:G,{pat})+SUMIFS(J:J,I:I,{pat})"
        )
        ws.cell(r, 3).value = (
            f"=SUMIFS(E:E,B:B,{pat})+SUMIFS(C:C,D:D,{pat})+"
            f"SUMIFS(J:J,G:G,{pat})+SUMIFS(H:H,I:I,{pat})"
        )

    for i, team in enumerate(teams):
        r = 17 + i
        data_row = first_data + i
        ws_standings.cell(r, 1).value = team
        ws_standings.cell(r, 2).value = f"='{week_name}'!B{data_row}"
        ws_standings.cell(r, 3).value = f"=ROUND(B{r}+{r}/10000,8)"
        ws_standings.cell(r, 5).value = f"='{week_name}'!C{data_row}"

    c_lo, c_hi = 17, 16 + len(teams)
    c_rng = f"C{c_lo}:C{c_hi}"
    for rank in range(1, len(teams) + 1):
        display_row = 2 + rank
        large_k = f"ROUND(LARGE({c_rng},{rank}),8)"
        ws_standings.cell(display_row, 1).value = (
            f"=INDEX(A{c_lo}:A{c_hi},MATCH({large_k},{c_rng},0))"
        )
        ws_standings.cell(display_row, 2).value = (
            f"=INDEX(B{c_lo}:B{c_hi},MATCH({large_k},{c_rng},0))"
        )
        ws_standings.cell(display_row, 3).value = (
            f"=INDEX(E{c_lo}:E{c_hi},MATCH({large_k},{c_rng},0))"
        )
        ws_standings.cell(display_row, 4).value = f"=B{display_row}-C{display_row}"

    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def format_schedule_text(
    teams: list[str],
    rounds: list[dict],
    no_dual_ref: str | None = None,
) -> str:
    lines = [
        "5-Team Round Robin (each plays each other once)",
    ]
    if no_dual_ref:
        lines.append(
            f"2 courts — {no_dual_ref} cannot dual-ref (7 players); "
            "they ref two single-court rounds instead"
        )
    else:
        lines.append("2 courts — bye team refs both courts (counts as 2 refs)")
    lines.append("")

    for rnd in rounds:
        c1 = rnd["court1"]
        c2 = rnd.get("court2")
        lines.append(f"Round {rnd['round']}  (Refs: {rnd['refs_note']})")
        lines.append(f"  Court 1: {c1['home']} (H) vs {c1['away']} (A)")
        if c2:
            lines.append(f"  Court 2: {c2['home']} (H) vs {c2['away']} (A)")
        else:
            lines.append("  Court 2: —")
        lines.append("")

    home: Counter[str] = Counter()
    away: Counter[str] = Counter()
    refs: Counter[str] = Counter()
    for rnd in rounds:
        for g in _iter_court_games(rnd):
            home[g["home"]] += 1
            away[g["away"]] += 1
            refs[g["ref"]] += 1

    lines.append("Per-team balance:")
    lines.append(f"{'Team':<22} {'Home':>4} {'Away':>4} {'Refs':>4}")
    for team in teams:
        lines.append(f"{team:<22} {home[team]:>4} {away[team]:>4} {refs[team]:>4}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate 5-team 2-court team-ref round-robin schedule"
    )
    parser.add_argument(
        "teams",
        nargs="*",
        help="Exactly five team names (default: Team 1 … Team 5)",
    )
    parser.add_argument("--output", "-o", type=str, help="Write .xlsx workbook")
    parser.add_argument("--league-name", default="Five Team Round Robin")
    parser.add_argument(
        "--no-dual-ref",
        metavar="TEAM",
        help="Team that cannot ref both courts (gets two single-court ref rounds)",
    )
    parser.add_argument("--print", action="store_true", dest="do_print", help="Print schedule")
    parser.add_argument("--validate", action="store_true", help="Validate only")
    args = parser.parse_args()

    teams = list(args.teams) if args.teams else [f"Team {i}" for i in range(1, 6)]
    if len(teams) != NUM_TEAMS:
        print(f"ERROR: need exactly {NUM_TEAMS} teams, got {len(teams)}")
        return 1
    if args.no_dual_ref and args.no_dual_ref not in teams:
        print(f"ERROR: --no-dual-ref {args.no_dual_ref!r} is not in the team list")
        return 1

    rounds = build_rounds(teams, no_dual_ref=args.no_dual_ref)
    errors = validate_rounds(teams, rounds, no_dual_ref=args.no_dual_ref)
    if errors:
        print("Validation FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("Validation passed.")
    if args.do_print or not args.output:
        print()
        print(format_schedule_text(teams, rounds, no_dual_ref=args.no_dual_ref))

    if args.output:
        out = Path(args.output)
        if not out.is_absolute():
            out = ROOT / out
        write_workbook(
            out,
            teams,
            rounds,
            league_name=args.league_name,
            no_dual_ref=args.no_dual_ref,
        )
        print(f"Wrote: {out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Reorder seven-team league weeks using **full round swaps only among Games 1–17**, so Game 18
(single matchup on court 1) never moves — matches spreadsheet layout rules.

Goals (-score_schedule from suggest_idle_swaps — mirrors scheduleParser conflicts):
  1) Minimize idle-streak warnings per week (fewer swaps = better Score).
  2) Prefer spreading which teams trigger warnings across the season.

Optional follow-up (does not change Game 18 row labels; only exchanges one court’s
matchup+ref with another round’s court): run

  python3 suggest_idle_swaps.py --file public/league_templates/Seven Team League.xlsx \\
    --sheet \"Week N Schedule\" --deep-partial

Apply listed ``--apply-partial Ga Ca Gb Cb --write`` moves that keep the last round as a
single matchup. After the round-swap pass, Week 2 in this template improved with two
partials in order: ``4 2 8 1`` then ``4 2 13 1`` — re-run ``--deep-partial`` if the
workbook changes.

  python3 scripts/seven_team_balance_idle_reserve_g18.py
  python3 scripts/seven_team_balance_idle_reserve_g18.py --write
"""

from __future__ import annotations

import argparse
import copy
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from suggest_idle_swaps import (  # noqa: E402
    Score,
    apply_round_swap_to_sheet,
    find_idle_streak_issues,
    score_schedule,
    teams_in_week,
)
from suggest_ref_swaps_week4 import games_after_round_swap, parse_week_schedule  # noqa: E402

DEFAULT_FILE = ROOT / "public/league_templates/Seven Team League.xlsx"

# Game 18 stays fixed (0-based index 17). Only swap rounds 01–17 indices 0..16.
IDX_MAX_SWAP = 16


def simulate_swaps(base: list, moves: list[tuple[int, int]]):
    g = copy.deepcopy(base)
    for i, j in moves:
        g = games_after_round_swap(g, i, j)
    return g


def fairness_sort_key(warned_teams: list[str], prior: defaultdict[str, int]):
    """Lower is better: cap load, then spread (sum of squares), then lexicographic tie-breaks."""
    hypo = defaultdict(int)
    hypo.update(prior)
    for t in warned_teams:
        hypo[t] += 1
    mx = max(hypo.values()) if hypo else 0
    spread = sum(v * v for v in hypo.values())
    return (mx, spread, tuple(sorted(warned_teams)), tuple(sorted(hypo.items())))


def all_single_swaps():
    pairs = []
    for i in range(0, IDX_MAX_SWAP + 1):
        for j in range(i + 1, IDX_MAX_SWAP + 1):
            pairs.append((i, j))
    return pairs


SINGLES = all_single_swaps()


def touch_swap_pool(base: list) -> set[int]:
    """0-based indices 0..16 likely relevant to idle streaks (+/-2 neighboring rounds)."""
    teams = teams_in_week(base)
    issues = find_idle_streak_issues(base, teams)
    pit: set[int] = set()
    for ix in issues:
        for s in ix["slot_indices"]:
            if s > IDX_MAX_SWAP:
                continue
            for d in (-2, -1, 0, 1, 2):
                ss = s + d
                if 0 <= ss <= IDX_MAX_SWAP:
                    pit.add(ss)
    if not pit:
        pit.update(range(0, IDX_MAX_SWAP + 1))
    return pit


def narrow_single_swaps(pool: set[int]) -> list[tuple[int, int]]:
    """Swaps that touch at least one index in pool; else full SINGLES if pool too small."""
    cand = [(i, j) for (i, j) in SINGLES if i in pool or j in pool]
    if len(cand) < 36:
        return SINGLES
    return cand


def _sig_moves(mvs: list[tuple[int, int]]) -> tuple[tuple[int, int], ...]:
    return tuple(mvs)


def best_sequence_search(
    base,
    *,
    max_depth: int,
    wide_depth2: bool = False,
) -> tuple[list[list[tuple[int, int]]], Score]:
    baseline = score_schedule(base)

    best_sc: Score | None = None
    keep: list[list[tuple[int, int]]] = []
    seen_sig: set[tuple[tuple[int, int], ...]] = set()

    def consider(moves: list[tuple[int, int]]) -> None:
        nonlocal best_sc, keep
        sig = _sig_moves(moves)
        if sig in seen_sig:
            return
        seen_sig.add(sig)
        g = simulate_swaps(base, moves)
        sc = score_schedule(g)
        if not (sc < baseline):
            return
        if best_sc is None or sc < best_sc:
            best_sc = sc
            keep = [moves[:]]
        elif best_sc is not None and sc == best_sc:
            keep.append(moves[:])

    for ij in SINGLES:
        consider([ij])

    if max_depth >= 2:
        pool2 = touch_swap_pool(base)
        s2 = SINGLES if wide_depth2 else narrow_single_swaps(pool2)
        for ij in s2:
            for kl in s2:
                consider([ij, kl])

    if max_depth >= 3 and best_sc is None:
        pool = touch_swap_pool(base)
        ns = narrow_single_swaps(pool)
        for ij in ns:
            for kl in ns:
                for mn in ns:
                    consider([ij, kl, mn])

    if not keep or best_sc is None:
        return [], baseline

    min_len = min(len(s) for s in keep)
    keep_fin: dict[tuple[tuple[int, int], ...], list[tuple[int, int]]] = {}
    for s in keep:
        if len(s) != min_len:
            continue
        ts = tuple(s)
        if ts not in keep_fin:
            keep_fin[ts] = s
    keep_arr = list(keep_fin.values())

    def fingerprint(gams: list) -> tuple:
        return tuple(
            (
                tuple(gams[k]["court1_playing"]),
                tuple(gams[k]["court2_playing"]),
                gams[k]["court1Ref"],
                gams[k]["court2Ref"],
            )
            for k in range(len(gams))
        )

    uniq: dict[tuple, list[tuple[int, int]]] = {}
    for moves in keep_arr:
        fp = fingerprint(simulate_swaps(base, moves))
        if fp not in uniq:
            uniq[fp] = moves

    return list(uniq.values()), best_sc


def choose_sequence(
    sequences: list[list[tuple[int, int]]], base, prior_counts: defaultdict[str, int]
):
    teams = teams_in_week(base)
    best_seq = None
    best_cand = None

    def norm_moves(mvs):
        return tuple(tuple(x) for x in mvs)

    seen_repr = set()

    for mvs in sequences:
        rr = norm_moves(mvs)
        if rr in seen_repr:
            continue
        seen_repr.add(rr)
        g = simulate_swaps(base, mvs)
        sc2 = score_schedule(g)
        issues = find_idle_streak_issues(g, teams)
        warned = [x["team"] for x in issues]
        fk = fairness_sort_key(warned, prior_counts)

        rk = "".join(str((i + 1, j + 1)) for i, j in mvs)

        cand = (sc2, fk, rk)
        if best_cand is None or cand < best_cand:
            best_cand = cand
            best_seq = mvs


    return best_seq


def validate_g18_unchanged(before_game18, after_games):
    b = before_game18
    a = after_games[17]

    def tri(g):
        return (
            tuple(g["court1_playing"]),
            tuple(g["court2_playing"]),
            g["court1Ref"],
            g["court2Ref"],
        )

    if tri(a) != tri(b):
        raise RuntimeError(f"Game 18 block changed unexpectedly: {tri(a)} vs {tri(b)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=Path, default=DEFAULT_FILE)
    parser.add_argument(
        "--write",
        action="store_true",
        help="Mutate workbook in place (loads data_only=False for writes)",
    )
    args = parser.parse_args()

    if not args.file.is_file():
        raise SystemExit(f"Missing file: {args.file}")

    prior_team: defaultdict[str, int] = defaultdict(int)
    picks: dict[str, tuple] = {}

    # Pass 1: choose moves from pristine parse (fresh parse each outer loop from disk if --write simulated)
    # We need stable base per week reads from INITIAL file only:

    baseline_parse: dict[str, list] = {}
    baseline_g18: dict[str, object] = {}

    wb0 = openpyxl.load_workbook(args.file, data_only=True)
    for wi in range(1, 7):
        name = f"Week {wi} Schedule"
        baseline_parse[name] = parse_week_schedule(wb0[name], max_games=None)
        baseline_g18[name] = copy.deepcopy(baseline_parse[name][17])
    wb0.close()

    for wi in range(1, 7):
        sheet = f"Week {wi} Schedule"
        base = copy.deepcopy(baseline_parse[sheet])
        b0 = score_schedule(base)
        seq_list: list[list[tuple[int, int]]] = []
        score_result = b0

        if b0.idle_count == 0:
            pass  # optimal
        elif b0.idle_count == 1:
            seq_list, score_result = best_sequence_search(base, max_depth=2, wide_depth2=False)
        else:
            seq_list, score_result = best_sequence_search(base, max_depth=2, wide_depth2=True)
            if not seq_list:
                seq_list, score_result = best_sequence_search(base, max_depth=3, wide_depth2=False)

        if not seq_list:
            chosen = []
            g_final = base
            print(f"{sheet}: no strict improvement vs baseline without touching Game 18. {score_result}")
        else:
            chosen = choose_sequence(seq_list, base, prior_team) or []
            g_final = simulate_swaps(base, chosen)
            idle_is = find_idle_streak_issues(g_final, teams_in_week(g_final))
            teams_warned = ", ".join(x["team"] for x in idle_is)
            mv_str = (
                "; ".join(f"{a + 1}↔{b + 1}" for (a, b) in chosen) if chosen else "(none)"
            )
            print(
                f"{sheet}: {score_result} swaps=[{mv_str}] "
                f"idle_issues={score_result.idle_count} warns: {teams_warned or '-'}"
            )

        idle_is_final = find_idle_streak_issues(g_final, teams_in_week(g_final))
        for x in idle_is_final:
            prior_team[x["team"]] += 1

        validate_g18_unchanged(baseline_g18[sheet], simulate_swaps(baseline_parse[sheet], chosen or []))

        picks[sheet] = (chosen or [], score_schedule(g_final))

    total_idle = sum(picks[s][1].idle_count for s in picks)
    print("\nTotals: idle_issues sum =", total_idle, " fair_counter:", dict(sorted(prior_team.items())))

    if not args.write:
        print("\n(dry-run) no file written — pass --write to save")
        return

    wb = openpyxl.load_workbook(args.file, data_only=False)

    for wi in range(1, 7):
        sheet = f"Week {wi} Schedule"
        ws = wb[sheet]

        chosen, _ = picks[sheet]
        for ia, jb in chosen:
            games_live = parse_week_schedule(ws, max_games=None)
            apply_round_swap_to_sheet(ws, games_live, ia + 1, jb + 1)

        after = parse_week_schedule(ws, max_games=None)
        validate_g18_unchanged(baseline_g18[sheet], after)
        score_after = score_schedule(after)
        idle_n = score_after.idle_count
        if idle_n != picks[sheet][1].idle_count:
            raise RuntimeError(f"{sheet} score mismatch after apply {idle_n=} expected {picks[sheet][1]}")
        print(f"wrote {sheet} verified idle={idle_n}")

    wb.save(args.file)
    print(f"\nSaved: {args.file}")


if __name__ == "__main__":
    main()

# Timed-block league nights — design notes

Board-facing paste doc: [`timed-block-league-nights.md`](../timed-block-league-nights.md) (repo root). Interactive week sheets live as Cursor canvases on this machine, not in git — the markdown is the durable copy.

This is a **sheet experiment**, not a create-league / parser change, until the board says otherwise. Today’s generators and `/schedules` parser assume ~3-min dual-court rounds, weekly 2-game RR, and will flag consecutive rematches.

## Gym clock (2 hours, 2 courts)

- **10 min setup + 10 min pack-up.** Remaining **100 min** = games + transitions.
- Transitions **5–10 min** (5–6 with 5–6 teams; 8–10 with 7–8 teams moving).
- `block_min = floor((100 − (blocks−1)×rotate) / blocks)`.
- **3 blocks:** 6-team → **30 min games / 5 min rotates**. 7–8 teams → **28 min / 8 min**.
- **4 blocks:** 7-team → **20 min / 6 min**. 8-team → **19 min / 8 min**.
- **4 × 24 min does not fit** once setup/pack are real.

A **block** is a timed window (same opponent the whole time), not a game count. Both courts share one clock unless noted. Still score games inside the window if standings need them.

## What to run

| Teams | Best night | Do not |
| --- | --- | --- |
| **6** | **Pilot.** 3 dual-court blocks. Even: 2 play / 1 ref. Cover RR in 3 weeks. | |
| **7, 2–3 rounds** | **Week bye:** 1 sits, 6 play the 6-team 3-block sheet. Even for who shows. Even for all in 7 weeks. | 2 rounds (8 slots ÷ 7: one plays twice). Packed 3-block (5 play 2, 2 play 1) unless nobody can sit. |
| **7, 4 slots** | Everyone plays 2: one single-court opener then 3 dual-court. Even tonight. Cover in 3 weeks (7-cycle × 3 = K7). | Packing 4 dual-court slots unless you want 2 extras (5 play 2, 2 play 3; best extras overlap, one Gold-style 1+4 gap). |
| **8** | **4 blocks, two waves:** early 4 play 1–2, late 4 play 3–4. Even tonight (2 play / 1 ref / 1 off). Rotate waves so groups meet; cover in 4 weeks. Or week bye (2 sit, 6 play even). | 3-block waves unless you accept singles vs doubles the same night. Never play 1 and 3 with a hole. |
| **5** | Keep today’s dedicated-ref short games (full RR in one night), or **week bye** + 4-team 3-block RR if going long. | 2–3 long blocks with a bye each round (uneven, loses nightly RR). 5 long blocks overshoot 2 hours. |

Odd × odd play counts are impossible (handshake lemma): all 7 cannot play exactly 3 in one night.

## Parser / product

Do not auto-generate these from Drive templates. Hand a one-off week. Idle-swap and weekly RR checks will conflict. Option C (same ~3-min games, court-sticky order) is the low-risk fallback if the board will not change the night.
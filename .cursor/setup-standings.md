# Setting Up Standings Formulas for League Spreadsheets

## Overview

This document describes how to automatically set up win/loss tracking and standings formulas for a league schedule spreadsheet. The process detects teams and weeks, then applies all necessary formulas.

## Quick Start

Use the automated script:

```bash
python3 setup_standings.py [path/to/spreadsheet.xlsx]
```

If no path is provided, it defaults to `public/league_schedules/2026 Winter She_They League.xlsx`

## What the Script Does

### 1. Team Detection
The script automatically detects teams from multiple sources:
- **Teams Sheet**: Row 1, columns C-I contain team names
- **League Standings Sheet**: Rows 17-30 in column A
- **Week Sheets**: Columns B and D (where teams are listed in games)

### 2. Week Sheet Detection
Finds all sheets matching the pattern "Week X" (e.g., "Week 1 (1.4)", "Week 2 (1.11)")

### 3. Formula Setup

#### Week Sheets
For each week sheet, adds a "Team Wins/Losses This Week" section (typically starting at row 30):

- **Row 30**: Header "Team Wins/Losses This Week"
- **Row 31**: Headers "Team Name" | "Wins" | "Losses"
- **Rows 32+**: For each team:
  - **Column A**: Team name
  - **Column B (Wins)**: `=COUNTIFS(B:B,"TeamName",C:C,"<>")+COUNTIFS(D:D,"TeamName",E:E,"<>")`
    - Counts when team is in column B and column C is filled (Team 1 wins)
    - Counts when team is in column D and column E is filled (Team 2 wins)
  - **Column C (Losses)**: `=COUNTIFS(B:B,"TeamName",E:E,"<>")+COUNTIFS(D:D,"TeamName",C:C,"<>")`
    - Counts when team is in column B and column E is filled (Team 2 wins)
    - Counts when team is in column D and column C is filled (Team 1 wins)

#### League Standings Sheet
Sets up the standings display:

- **Rows 17-20** (or based on number of teams):
  - **Column A**: Team names
  - **Column B (Wins)**: Aggregates wins from all week sheets
    - Formula: `='Week 1 (1.4)'!B32+'Week 2 (1.11)'!B32+...`
  - **Column C (Magic Number)**: `=B17+ROW(B17)/10000`
    - Adds small tie-breaking value based on row number
  - **Column E (Losses)**: Aggregates losses from all week sheets
    - Formula: `='Week 1 (1.4)'!C32+'Week 2 (1.11)'!C32+...`

- **Rows 3-6** (or based on number of teams): Sorted standings display
  - **Column A (Team Name)**: `=INDEX(A17:A20,MATCH(LARGE(C17:C20,1),C17:C20,0))`
    - Gets team name sorted by magic number (wins with tie-breaker)
  - **Column B (Points For/Wins)**: `=INDEX(B17:B20,MATCH(LARGE(C17:C20,1),C17:C20,0))`
    - Gets wins for the team at this rank
  - **Column C (Points Against/Losses)**: `=INDEX(E17:E20,MATCH(LARGE(C17:C20,1),C17:C20,0))`
    - Gets losses for the team at this rank
  - **Column D (Point Differential)**: `=B3-C3`
    - Wins minus losses

### 4. Iterative Calculation
Automatically enables iterative calculation in Excel:
- Max iterations: 100
- Max change: 0.001

## Spreadsheet Structure Requirements

### Teams Sheet
- Row 1, columns C-I: Team names
- Example:
  ```
  Row 1: Team Names | (empty) | Persephone | Artemis | Dionysus | Athena
  ```

### Week Sheets
- Columns A-E contain game schedule:
  - **Column A**: Game number (e.g., "Game 01")
  - **Column B**: Team 1 (first team)
  - **Column C**: Filled when Team 1 wins
  - **Column D**: Team 2 (second team)
  - **Column E**: Filled when Team 2 wins

Example game row:
```
Row 2: Game 01 | Persephone | (filled if Persephone wins) | Artemis | (filled if Artemis wins)
```

### League Standings Sheet
- Will be automatically configured by the script
- Row 11, column B: Week number (manually set, starts at 0)

## Manual Setup (If Not Using Script)

If you need to set up formulas manually:

### 1. On Each Week Sheet (around row 30):

**Header Row (Row 31):**
- A31: "Team Name"
- B31: "Wins"
- C31: "Losses"

**For each team (starting row 32):**
- Column A: Team name
- Column B: `=COUNTIFS(B:B,"TeamName",C:C,"<>")+COUNTIFS(D:D,"TeamName",E:E,"<>")`
- Column C: `=COUNTIFS(B:B,"TeamName",E:E,"<>")+COUNTIFS(D:D,"TeamName",C:C,"<>")`

### 2. On League Standings Sheet:

**Team Data (Rows 17-20):**
- Column A: Team names
- Column B: Sum of wins from all week sheets
- Column C: Magic number `=B17+ROW(B17)/10000`
- Column E: Sum of losses from all week sheets

**Standings Display (Rows 3-6):**
- Column A: `=INDEX(A17:A20,MATCH(LARGE(C17:C20,1),C17:C20,0))`
- Column B: `=INDEX(B17:B20,MATCH(LARGE(C17:C20,1),C17:C20,0))`
- Column C: `=INDEX(E17:E20,MATCH(LARGE(C17:C20,1),C17:C20,0))`
- Column D: `=B3-C3`

(Repeat for ranks 2, 3, 4 by changing the rank number in LARGE)

## Troubleshooting

### Teams Not Detected
- Ensure team names are in Teams sheet (row 1, columns C-I)
- Or ensure teams appear in week sheets (columns B and D)
- Check for typos or extra spaces in team names

### Week Sheets Not Detected
- Ensure week sheets are named with pattern "Week X" (e.g., "Week 1 (1.4)")
- The script uses regex: `r'Week\s+\d+'`

### Formulas Not Working
- Check that game results are filled in columns C or E on week sheets
- Verify iterative calculation is enabled:
  - Excel: File → Options → Formulas → Enable iterative calculation
  - Google Sheets: File → Settings → Calculation → Enable iterative calculation

### Circular Dependency Warnings
- The formulas are structured to avoid circular dependencies
- If warnings appear, they may be false positives
- Ensure Points Against (column C in standings) uses INDEX to get losses directly, not by referencing column B

## Notes

- The script will overwrite existing formulas in the win/loss sections
- Always backup your file before running the script if you have custom formulas
- Team names with trailing spaces (like "Athena ") are handled with wildcard matching
- The magic number formula ensures unique values for tie-breaking even when teams have the same number of wins

## Related Files

- `setup_standings.py`: Main automation script
- `STANDINGS_FORMULAS.md`: Detailed formula reference
- `SETUP_STANDINGS_README.md`: User-facing documentation




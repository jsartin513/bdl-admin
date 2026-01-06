# Standings Setup Script

## Overview

The `setup_standings.py` script automatically detects teams and weeks in a league schedule spreadsheet and applies all necessary formulas for tracking wins, losses, and standings.

## Features

- **Automatic Team Detection**: Finds teams from:
  - Teams sheet (row 1, columns C-I)
  - League Standings sheet (rows 17-30)
  - Week sheets (columns B and D)
  
- **Automatic Week Detection**: Finds all sheets matching "Week X" pattern

- **Automatic Formula Application**:
  - Win/loss formulas on each week sheet
  - Aggregate formulas on League Standings sheet
  - Magic numbers for tie-breaking
  - Sorted standings display
  - Points Against using actual losses

- **Iterative Calculation**: Automatically enabled for Excel

## Usage

### Basic Usage

```bash
python3 setup_standings.py
```

This will use the default file: `public/league_schedules/2026 Winter She_They League.xlsx`

### Custom File Path

```bash
python3 setup_standings.py path/to/your/file.xlsx
```

## Requirements

- Python 3
- openpyxl library: `pip install openpyxl`

## What the Script Does

1. **Detects Teams**: Scans the spreadsheet for team names
2. **Detects Weeks**: Finds all week sheets (e.g., "Week 1 (1.4)", "Week 2 (1.11)")
3. **Sets Up Week Sheets**: 
   - Adds "Team Wins/Losses This Week" section (around row 30)
   - Adds win formulas (counts when team wins)
   - Adds loss formulas (counts when team loses)
4. **Sets Up League Standings**:
   - Adds team names and aggregate win/loss formulas
   - Adds magic numbers for tie-breaking
   - Sets up sorted standings display (rows 3-6)
   - Configures Points Against to use actual losses
5. **Enables Iterative Calculation**: For Excel compatibility

## Expected Spreadsheet Structure

### Teams Sheet
- Row 1, columns C-I: Team names

### Week Sheets
- Columns A-E: Game schedule
  - Column A: Game number
  - Column B: Team 1
  - Column C: Filled when Team 1 wins
  - Column D: Team 2
  - Column E: Filled when Team 2 wins

### League Standings Sheet
- Will be automatically configured by the script

## Output

The script will:
- Print detected teams and weeks
- Show progress as it processes each week sheet
- Display a summary at the end

Example output:
```
=== Detecting Teams ===
Found 4 teams: Artemis, Athena, Dionysus, Persephone

=== Detecting Week Sheets ===
Found 6 week sheets:
  - Week 1 (1.4)
  - Week 2 (1.11)
  ...

✅ Setup complete!
```

## Notes

- The script will overwrite existing formulas in the win/loss sections
- Make sure to backup your file before running if you have custom formulas
- The script works with both Excel (.xlsx) and can be used before uploading to Google Sheets
- Google Sheets may need iterative calculation enabled manually: File → Settings → Calculation

## Troubleshooting

**No teams detected:**
- Check that team names are in the Teams sheet (row 1, columns C-I)
- Or ensure teams appear in week sheets (columns B and D)

**No week sheets detected:**
- Ensure week sheets are named with pattern "Week X" (e.g., "Week 1 (1.4)")

**Formulas not working:**
- Check that game results are filled in columns C or E on week sheets
- Verify iterative calculation is enabled in Excel/Google Sheets




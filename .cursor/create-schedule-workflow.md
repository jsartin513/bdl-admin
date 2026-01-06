# Creating Future League Schedules - Workflow Guide

## Overview

This guide explains the streamlined process for creating new league schedules. The workflow uses automated scripts to minimize manual work.

## Quick Start Workflow

### Option 1: Create from Scratch (New League)

```bash
# 1. Create a template with your teams
python3 create_league_template.py "2027 Spring League.xlsx" "Team A" "Team B" "Team C" "Team D"

# 2. (Optional) Adjust matchups in Schedule Generator sheet

# 3. Generate week sheets from Schedule Generator
python3 create_schedule_from_generator.py "2027 Spring League.xlsx" 6

# 4. Set up standings formulas
python3 setup_standings.py "2027 Spring League.xlsx"
```

### Option 2: Update Existing League

```bash
# 1. Update Schedule Generator sheet manually (adjust matchups if needed)

# 2. Regenerate week sheets
python3 create_schedule_from_generator.py "existing_league.xlsx" 6

# 3. Re-run standings setup (if teams changed)
python3 setup_standings.py "existing_league.xlsx"
```

## Detailed Steps

### Step 1: Create League Template

The template generator creates a new spreadsheet with:
- **Teams Sheet**: Lists all teams
- **Schedule Generator Sheet**: Matchup matrix (how many times each team plays each other)
- **League Standings Sheet**: Empty standings structure
- **Week Sheets**: Empty week sheets with proper naming

**Command:**
```bash
python3 create_league_template.py <output_file> <team1> <team2> [team3] ...
```

**Example:**
```bash
python3 create_league_template.py "2027 Spring League.xlsx" "Athena" "Persephone" "Artemis" "Dionysus"
```

### Step 2: Adjust Schedule Generator (Optional)

The Schedule Generator sheet shows a matrix:
- Rows and columns represent teams
- Numbers indicate how many times each team plays each other
- Default is 2 games per matchup

**To customize:**
1. Open the spreadsheet
2. Edit the Schedule Generator sheet
3. Change numbers to adjust how many times teams face each other
4. Use `-` for teams that don't play each other

### Step 3: Generate Week Sheets

This script reads the Schedule Generator and creates game schedules for each week.

**Command:**
```bash
python3 create_schedule_from_generator.py <file_path> <num_weeks>
```

**Example:**
```bash
python3 create_schedule_from_generator.py "2027 Spring League.xlsx" 6
```

**What it does:**
- Reads matchup matrix from Schedule Generator
- Generates all required games
- Distributes games evenly across weeks
- Creates/updates week sheets with game schedules
- Preserves existing win/loss formulas if present

### Step 4: Set Up Standings Formulas

This script adds all the win/loss tracking formulas.

**Command:**
```bash
python3 setup_standings.py <file_path>
```

**What it does:**
- Detects teams automatically
- Detects week sheets automatically
- Adds win/loss formulas to each week sheet
- Sets up League Standings aggregation
- Configures sorted standings display
- Enables iterative calculation

## Manual Adjustments

After running the scripts, you may want to:

1. **Reorder games within weeks** - Move games around for better flow
2. **Adjust dates** - Update week sheet names with actual dates
3. **Add referees** - Fill in ref assignments
4. **Customize matchups** - Manually adjust specific games if needed

## Schedule Generator Matrix Explained

The Schedule Generator uses a matrix format:

```
        | Team A | Team B | Team C | Team D
--------|--------|--------|--------|--------
Team A  |   -    |   2    |   2    |   2
Team B  |   2    |   -    |   2    |   2
Team C  |   2    |   2    |   -    |   2
Team D  |   2    |   2    |   2    |   -
```

- **Numbers**: How many times each team plays each other
- **Dash (-)**: Same team (no game)
- **0**: Teams don't play each other

## Week Sheet Structure

Each week sheet follows this format:

```
Row 1:  [empty] | Court 1
Row 2:  Game 01 | Team A | [empty] | Team B
Row 3:  [empty] | Ref
Row 4:  Game 02 | Team C | [empty] | Team D
Row 5:  [empty] | Ref
...
Row 30: Team Wins/Losses This Week
Row 31: Team Name | Wins | Losses
Row 32: Team A    | [formula] | [formula]
...
```

**Game Results:**
- **Column C**: Fill with score when Team 1 (column B) wins
- **Column E**: Fill with score when Team 2 (column D) wins

## Tips for Easier Schedule Creation

### 1. Use Consistent Naming
- Keep team names consistent across all sheets
- Use the same format for week sheet names: `Week X (M.D)`

### 2. Start with Template
- Always use `create_league_template.py` for new leagues
- It ensures proper structure from the start

### 3. Batch Operations
- Run all scripts in sequence for a complete setup
- Scripts are idempotent (safe to run multiple times)

### 4. Version Control
- Save templates for different league types
- Keep a "master template" for your standard league format

### 5. Automation Script
Create a master script that does everything:

```bash
#!/bin/bash
# create_new_league.sh

LEAGUE_NAME=$1
shift
TEAMS="$@"

# Create template
python3 create_league_template.py "${LEAGUE_NAME}.xlsx" $TEAMS

# Generate schedule
python3 create_schedule_from_generator.py "${LEAGUE_NAME}.xlsx" 6

# Setup standings
python3 setup_standings.py "${LEAGUE_NAME}.xlsx"

echo "✅ League created: ${LEAGUE_NAME}.xlsx"
```

## Troubleshooting

### Teams Not Detected
- Ensure teams are in Teams sheet (row 1, columns C-I)
- Or ensure teams appear in week sheets
- Check for typos or extra spaces

### Week Sheets Not Generated
- Verify Schedule Generator sheet exists
- Check that matchup matrix has numbers (not just dashes)
- Ensure team names match exactly

### Formulas Not Working
- Re-run `setup_standings.py`
- Check that game results are filled in columns C or E
- Verify iterative calculation is enabled

## Related Files

- `create_league_template.py`: Creates new league spreadsheet template
- `create_schedule_from_generator.py`: Generates week sheets from Schedule Generator
- `setup_standings.py`: Sets up win/loss tracking formulas
- `.cursor/setup-standings.md`: Detailed standings formula documentation

## Example: Complete Workflow

```bash
# 1. Create template for 4-team league
python3 create_league_template.py "2027 Spring.xlsx" "Alpha" "Beta" "Gamma" "Delta"

# 2. (Optional) Open spreadsheet and adjust Schedule Generator

# 3. Generate 6 weeks of games
python3 create_schedule_from_generator.py "2027 Spring.xlsx" 6

# 4. Add standings formulas
python3 setup_standings.py "2027 Spring.xlsx"

# 5. Open in Google Sheets, upload, and start tracking games!
```

The spreadsheet is now ready to use! Just fill in game results (scores in columns C or E) and the standings will update automatically.



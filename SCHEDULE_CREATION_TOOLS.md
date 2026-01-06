# Schedule Creation Tools - Quick Reference

## 🚀 Quick Start

### Create a Complete New League (Easiest - Interactive)

```bash
python3 create_league_interactive.py
```

Or use the shell script:
```bash
./create_new_league.sh "2027 Spring League" "Team A" "Team B" "Team C" "Team D"
```

Both approaches:
1. Create the spreadsheet template
2. Generate all week sheets
3. Set up standings formulas
4. Ready to use!

**Interactive mode** guides you through each step with prompts - perfect if you're not comfortable with command-line arguments!

## 📚 Available Tools

### 1. `create_new_league.sh` - Master Script
**One command to create everything**

```bash
./create_new_league.sh <league_name> <team1> <team2> [team3] ...
```

**Example:**
```bash
./create_new_league.sh "2027 Spring" "Athena" "Persephone" "Artemis" "Dionysus"
```

### 2. `create_league_template.py` - Template Generator
**Creates a blank league spreadsheet with proper structure**

```bash
python3 create_league_template.py <output_file> <team1> <team2> [team3] ...
```

**What it creates:**
- Teams sheet
- Schedule Generator sheet (with matchup matrix)
- League Standings sheet (empty structure)
- Week sheets (empty, properly named)

### 3. `create_schedule_from_generator.py` - Schedule Generator
**Reads Schedule Generator and creates game schedules**

```bash
python3 create_schedule_from_generator.py <file_path> <num_weeks>
```

**What it does:**
- Reads matchup matrix from Schedule Generator
- Generates all required games
- Distributes games across weeks
- Creates/updates week sheets with game schedules

### 4. `setup_standings.py` - Standings Setup
**Adds all win/loss tracking formulas**

```bash
python3 setup_standings.py <file_path>
```

**What it does:**
- Detects teams and weeks automatically
- Adds win/loss formulas to week sheets
- Sets up League Standings aggregation
- Configures sorted standings display

## 📋 Typical Workflows

### Workflow 1: Brand New League (Recommended)
```bash
# One command does everything
./create_new_league.sh "League Name" "Team1" "Team2" "Team3" "Team4"
```

### Workflow 2: Custom Schedule
```bash
# 1. Create template
python3 create_league_template.py "league.xlsx" "Team1" "Team2" "Team3" "Team4"

# 2. Manually edit Schedule Generator (adjust matchups)

# 3. Generate schedule
python3 create_schedule_from_generator.py "league.xlsx" 6

# 4. Setup standings
python3 setup_standings.py "league.xlsx"
```

### Workflow 3: Update Existing League
```bash
# 1. Update Schedule Generator manually

# 2. Regenerate week sheets
python3 create_schedule_from_generator.py "existing_league.xlsx" 6

# 3. Re-run standings (if teams changed)
python3 setup_standings.py "existing_league.xlsx"
```

## 🎯 What Each Tool Does

| Tool | Input | Output | When to Use |
|------|-------|--------|-------------|
| `create_new_league.sh` | League name + teams | Complete ready-to-use spreadsheet | Starting a new league |
| `create_league_template.py` | Teams list | Blank template spreadsheet | Need custom structure |
| `create_schedule_from_generator.py` | Spreadsheet + weeks | Week sheets with games | After editing Schedule Generator |
| `setup_standings.py` | Spreadsheet | Formulas for tracking | After schedule is created |

## 💡 Tips

1. **Start with the master script** - It's the easiest way
2. **Customize after generation** - Generate first, then adjust
3. **Keep team names consistent** - Use exact same names everywhere
4. **Run scripts in order** - Template → Schedule → Standings
5. **Scripts are safe to re-run** - They won't break existing data

## 📖 Full Documentation

- **`.cursor/create-schedule-workflow.md`** - Detailed workflow guide
- **`.cursor/setup-standings.md`** - Standings formulas documentation
- **`SETUP_STANDINGS_README.md`** - Standings setup user guide

## 🔧 Requirements

- Python 3
- openpyxl: `pip install openpyxl` (or use the venv)

## ❓ Common Questions

**Q: Can I customize the schedule after generation?**  
A: Yes! The scripts generate a starting point. You can manually adjust games, dates, etc.

**Q: What if I want different numbers of games per matchup?**  
A: Edit the Schedule Generator sheet before running `create_schedule_from_generator.py`

**Q: Can I add more teams later?**  
A: Yes, add them to the Teams sheet and re-run `setup_standings.py`

**Q: Do I need to run all scripts every time?**  
A: No, only run what you need. The master script runs everything for convenience.


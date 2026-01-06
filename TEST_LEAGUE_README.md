# Test League Creation Script

## Quick Start

Run the test script to create a sample league spreadsheet locally:

```bash
npm run test:league
```

Or directly:

```bash
node test-create-league.js
```

## What It Does

1. **Creates a test league** with:
   - League name: "Test League 2027"
   - 6 teams: Team Alpha, Team Beta, Team Gamma, Team Delta, Team Epsilon, Team Zeta
   - 6 weeks

2. **Validates the structure**:
   - Checks all sheets exist
   - Verifies 30 games per week
   - Checks home/away alternation
   - Verifies ref assignments (5 per team per week)

3. **Saves output** to `test-league-output.xlsx` in the project root

## Output

The script will:
- Create a complete Excel file with all sheets
- Display validation results
- Show a summary of the league structure
- Save the file for manual inspection

## Customizing the Test

Edit `test-create-league.js` and modify the `testData` object:

```javascript
const testData = {
  leagueName: 'Your League Name',
  teams: ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6'],
  numWeeks: 6
}
```

**Note:** Currently only supports exactly 6 teams and 6 weeks.

## What Gets Tested

- ✅ All sheets created (Teams, Schedule Generator, League Standings, Week 1-6)
- ✅ 30 games per week (each team plays each opponent twice)
- ✅ Home/away alternation for each pair
- ✅ Even game distribution (teams don't sit out too long)
- ✅ Ref assignments (each team refs 5 games per week)
- ✅ Win/loss formulas on week sheets
- ✅ Standings formulas on League Standings sheet

## File Location

Output file: `test-league-output.xlsx` (added to .gitignore)


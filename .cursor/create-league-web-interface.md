# Create League Web Interface

## Overview

A web-based interface for creating league spreadsheets directly in the admin tool, eliminating the need to run Python scripts manually.

## How It Works

### Frontend (`/app/create-league/page.tsx`)
- **Client-side React component** with a form
- Collects:
  - League name
  - Team names (dynamic list, add/remove teams)
  - Number of weeks
- Validates input (minimum 2 teams, required fields)
- Submits to API endpoint
- Downloads the generated Excel file

### Backend (`/app/api/create-league/route.ts`)
- **Next.js API route** (server-side)
- Receives form data as JSON
- Creates Excel workbook using `xlsx` library
- Generates all sheets:
  - Teams sheet
  - Schedule Generator sheet (matchup matrix)
  - League Standings sheet (with formulas)
  - Week sheets (with game schedules and win/loss formulas)
- Returns Excel file as downloadable blob

## Features

### What Gets Created
1. **Teams Sheet**: Lists all team names
2. **Schedule Generator Sheet**: Matchup matrix showing how many times each team plays each other
3. **League Standings Sheet**: 
   - Sorted standings display (rows 3-6)
   - Team data with aggregate formulas (rows 17+)
   - Magic numbers for tie-breaking
4. **Week Sheets**: 
   - Game schedules distributed across weeks
   - Win/loss tracking formulas
   - Round-robin schedule (each team plays each other twice)

### Formula Generation
- **Wins**: `=SUMIFS(C:C,B:B,"TeamName")+SUMIFS(E:E,D:D,"TeamName")`
- **Losses**: `=SUMIFS(E:E,B:B,"TeamName")+SUMIFS(C:C,D:D,"TeamName")`
- **Aggregate Wins**: Sums wins from all week sheets
- **Standings Display**: Uses INDEX/MATCH/LARGE to sort by wins

## Usage

1. Navigate to `/create-league` in the admin tool
2. Fill in the form:
   - Enter league name
   - Add team names (minimum 2)
   - Set number of weeks (default: 6)
3. Click "Create League"
4. Download the generated Excel file
5. Open in Excel or upload to Google Sheets

## Technical Details

### Dependencies
- `xlsx` library (already installed) for Excel file creation
- Next.js API routes for server-side processing
- React hooks for form state management

### File Structure
```
app/
  create-league/
    page.tsx          # Frontend form component
  api/
    create-league/
      route.ts        # Backend API endpoint
```

### Data Flow
1. User fills form → Client-side validation
2. Form submission → POST to `/api/create-league`
3. API route → Creates workbook in memory
4. Workbook → Converted to buffer
5. Buffer → Returned as downloadable file
6. Browser → Downloads Excel file

## Advantages Over Python Scripts

1. **No command-line needed**: Accessible through web interface
2. **No Python environment**: Runs entirely in Node.js/Next.js
3. **Immediate download**: File ready instantly
4. **User-friendly**: Form-based input with validation
5. **Integrated**: Part of the admin tool, no separate tools needed

## Future Enhancements

Possible improvements:
- Save to Google Drive directly
- Preview schedule before downloading
- Customize matchup matrix (how many times teams play)
- Edit existing leagues
- Upload and modify existing spreadsheets
- Generate multiple leagues at once

## Comparison with Python Scripts

| Feature | Web Interface | Python Scripts |
|---------|--------------|----------------|
| Accessibility | Web browser | Command line |
| Setup | None (built-in) | Python + dependencies |
| User-friendly | Form-based | Command arguments |
| Integration | Part of admin tool | Separate tool |
| Customization | Basic | Advanced (editable scripts) |

Both approaches are available - use the web interface for quick creation, Python scripts for advanced customization.



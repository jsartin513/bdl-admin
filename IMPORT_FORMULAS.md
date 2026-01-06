# Importing League Standings Data from Google Sheets

## Spreadsheet Information
- **Spreadsheet ID**: `1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0`
- **Sheet Name**: League Standings
- **Sheet ID (gid)**: `926860541`

## IMPORTANT: First-Time Setup

Before using IMPORTRANGE, you need to grant access. Use this formula once to authorize:

```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A1")
```

Click "Allow access" when prompted. After that, all IMPORTRANGE formulas will work.

## Import Formulas

### Option 1: Import Sorted Standings Display (Rows 3-6)

This imports the sorted standings table with team names, wins, losses, and point differential:

```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A3:D6")
```

**What this imports:**
- Column A: Team Name (sorted by wins)
- Column B: Points For (Wins)
- Column C: Points Against (Losses)
- Column D: Point Differential

### Option 2: Import Team Data (Rows 17-20)

This imports the raw team data with all formulas:

```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A17:E20")
```

**What this imports:**
- Column A: Team Names
- Column B: Total Wins (aggregated)
- Column C: Magic Numbers (for tie-breaking)
- Column D: (empty)
- Column E: Total Losses (aggregated)

### Option 3: Import Headers + Standings

If you want the headers too:

```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A2:D6")
```

This includes:
- Row 2: Headers (Team Name, Points For, Points Against, Point Differential)
- Rows 3-6: Standings data

### Option 4: Import Specific Columns Only

**Just team names and wins:**
```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A3:B6")
```

**Just team names and losses:**
```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A3:C3:C6")
```

Actually, for losses you'd need:
```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A3:A6")
```
and separately:
```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!C3:C6")
```

## Using Sheet Name Instead of Sheet ID

You can also reference by sheet name:

```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "'League Standings'!A3:D6")
```

## Alternative: Using QUERY for Filtered/Sorted Data

If you want to manipulate the data, use QUERY with IMPORTRANGE:

**Get teams sorted by wins (descending):**
```
=QUERY(IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A3:D6"), "SELECT * ORDER BY Col2 DESC")
```

**Get only teams with wins > 0:**
```
=QUERY(IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A3:D6"), "SELECT * WHERE Col2 > 0")
```

## Recommended Setup

For most use cases, I recommend importing the sorted standings display:

**In cell A1 of your destination sheet:**
```
=IMPORTRANGE("1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0", "League Standings!A2:D6")
```

This will give you:
- Row 1: Headers
- Rows 2-5: Standings (sorted by wins)

## Notes

- **First use**: You'll need to authorize access when you first use IMPORTRANGE
- **Updates**: Data updates automatically when the source sheet changes
- **Performance**: IMPORTRANGE can be slower than direct references within the same spreadsheet
- **Permissions**: Make sure the source spreadsheet is shared with anyone who needs to view the destination sheet
- **Range changes**: If you add/remove teams, update the range (e.g., A3:D6 might become A3:D7)

## Troubleshooting

**#REF! Error**: 
- You need to authorize access (run the first-time setup formula)
- Or the source sheet isn't shared with you

**#N/A Error**:
- The range might be incorrect
- The sheet name might have changed

**Data not updating**:
- Check that the source spreadsheet is accessible
- Try refreshing the page




# Google Sheets Iframe Embed Options for League Standings

## Spreadsheet Information
- **Spreadsheet ID**: `1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0`
- **Sheet ID (gid)**: `926860541`
- **Sheet Name**: League Standings

## Base URL Format
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/d/export?format=html&gid=SHEET_ID&range=RANGE&widget=WIDGET&headers=HEADERS&chrome=CHROME
```

## Recommended Options

### Option 1: Clean Standings Table (Recommended)
Shows just the standings table with headers, no title or footer.

**Range**: `A2:D6` (Headers + 4 teams)  
**URL**:
```
https://docs.google.com/spreadsheets/d/1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0/d/export?format=html&gid=926860541&range=A2:D6&widget=false&headers=true&chrome=false
```

**What it shows:**
- Row 2: Headers (Team Name, Points For, Points Against, Point Differential)
- Rows 3-6: Standings data (sorted by wins)

### Option 2: With Title
Includes the "LEAGUE STANDINGS" title at the top.

**Range**: `A1:D6`  
**URL**:
```
https://docs.google.com/spreadsheets/d/1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0/d/export?format=html&gid=926860541&range=A1:D6&widget=false&headers=true&chrome=false
```

**What it shows:**
- Row 1: "LEAGUE STANDINGS" title
- Row 2: Headers
- Rows 3-6: Standings data

### Option 3: Just Data (No Headers)
Shows only the standings data without column headers.

**Range**: `A3:D6`  
**URL**:
```
https://docs.google.com/spreadsheets/d/1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0/d/export?format=html&gid=926860541&range=A3:D6&widget=false&headers=false&chrome=false
```

### Option 4: With Week Number
Includes the week number at the bottom.

**Range**: `A2:D11`  
**URL**:
```
https://docs.google.com/spreadsheets/d/1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0/d/export?format=html&gid=926860541&range=A2:D11&widget=false&headers=true&chrome=false
```

## HTML Iframe Code

### Recommended (Option 1):
```html
<iframe 
  src="https://docs.google.com/spreadsheets/d/1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0/d/export?format=html&gid=926860541&range=A2:D6&widget=false&headers=true&chrome=false"
  width="100%"
  height="200"
  frameborder="0"
  style="border: 1px solid #ddd;">
</iframe>
```

### With Custom Styling:
```html
<iframe 
  src="https://docs.google.com/spreadsheets/d/1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0/d/export?format=html&gid=926860541&range=A2:D6&widget=false&headers=true&chrome=false"
  width="100%"
  height="250"
  frameborder="0"
  style="border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
</iframe>
```

## Parameter Explanations

- **gid=926860541**: The sheet ID (required)
- **range=A2:D6**: The cells to display
  - A2:D6 = Headers + 4 teams
  - A1:D6 = Title + Headers + 4 teams
  - A3:D6 = Just the 4 teams (no headers)
- **widget=false**: Don't show sheet tabs (recommended for clean embed)
- **headers=true**: Show row numbers and column letters (recommended for clarity)
- **chrome=false**: Don't show Google Sheets title/footer (recommended for clean embed)

## Responsive Iframe

For a responsive design:

```html
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe 
    src="https://docs.google.com/spreadsheets/d/1RgU1kg1mUAiN1lXG6liwZ_W0qoL2e5d7nACCeIw8Ts0/d/export?format=html&gid=926860541&range=A2:D6&widget=false&headers=true&chrome=false"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 1px solid #ddd;"
    frameborder="0">
  </iframe>
</div>
```

## Notes

- **Updates**: The iframe will automatically update when the source spreadsheet changes
- **Permissions**: The spreadsheet must be published to the web or shared publicly
- **Styling**: You can add custom CSS to style the iframe container
- **Height**: Adjust the height based on how many rows you're showing (approximately 40-50px per row)

## Publishing the Spreadsheet

For the iframe to work, the spreadsheet needs to be published:
1. Go to File → Share → Publish to web
2. Select the "League Standings" sheet
3. Choose "Web page" format
4. Click "Publish"

Or ensure it's shared with "Anyone with the link can view" permissions.




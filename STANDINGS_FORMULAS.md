# Standings Formulas - Copy-Paste Ready

## PART 1: Week Sheet Formulas (Do this on EACH of the 6 week sheets)

### Step 1: Add Header Section (around row 30)

**Cell A30:**
```
Team Wins This Week
```

**Cell A31:**
```
Team Name
```

**Cell B31:**
```
Wins
```

### Step 2: Add Team Names (Column A)

**Cell A32:**
```
Persephone
```

**Cell A33:**
```
Artemis
```

**Cell A34:**
```
Dionysus
```

**Cell A35:**
```
Athena
```

### Step 3: Add Win Formulas (Column B)

**Cell B32 (Persephone):**
```
=COUNTIFS(B:B,"Persephone",C:C,"<>")+COUNTIFS(D:D,"Persephone",E:E,"<>")
```

**Cell B33 (Artemis):**
```
=COUNTIFS(B:B,"Artemis",C:C,"<>")+COUNTIFS(D:D,"Artemis",E:E,"<>")
```

**Cell B34 (Dionysus):**
```
=COUNTIFS(B:B,"Dionysus",C:C,"<>")+COUNTIFS(D:D,"Dionysus",E:E,"<>")
```

**Cell B35 (Athena):**
```
=COUNTIFS(B:B,"Athena*",C:C,"<>")+COUNTIFS(D:D,"Athena*",E:E,"<>")
```

**Note:** Athena uses wildcard (*) to handle trailing spaces. If your Athena doesn't have trailing spaces, use:
```
=COUNTIFS(B:B,"Athena",C:C,"<>")+COUNTIFS(D:D,"Athena",E:E,"<>")
```

---

## PART 2: League Standings Sheet Formulas

### Update Win Totals (Column B)

**Cell B17 (Persephone - adjust row if needed):**
```
='Week 1 (1.4)'!B32+'Week 2 (1.11)'!B32+'Week 3 (1.25)'!B32+'Week 4 (2.1)'!B32+'Week 5 (2.8)'!B32+'Week 6 (2.15)'!B32
```

**Cell B18 (Artemis - adjust row if needed):**
```
='Week 1 (1.4)'!B33+'Week 2 (1.11)'!B33+'Week 3 (1.25)'!B33+'Week 4 (2.1)'!B33+'Week 5 (2.8)'!B33+'Week 6 (2.15)'!B33
```

**Cell B19 (Dionysus - adjust row if needed):**
```
='Week 1 (1.4)'!B34+'Week 2 (1.11)'!B34+'Week 3 (1.25)'!B34+'Week 4 (2.1)'!B34+'Week 5 (2.8)'!B34+'Week 6 (2.15)'!B34
```

**Cell B20 (Athena - adjust row if needed):**
```
='Week 1 (1.4)'!B35+'Week 2 (1.11)'!B35+'Week 3 (1.25)'!B35+'Week 4 (2.1)'!B35+'Week 5 (2.8)'!B35+'Week 6 (2.15)'!B35
```

---

## Quick Reference: All Formulas in One Place

### Week Sheet - Column B Formulas (rows 32-35):

```
=COUNTIFS(B:B,"Persephone",C:C,"<>")+COUNTIFS(D:D,"Persephone",E:E,"<>")
=COUNTIFS(B:B,"Artemis",C:C,"<>")+COUNTIFS(D:D,"Artemis",E:E,"<>")
=COUNTIFS(B:B,"Dionysus",C:C,"<>")+COUNTIFS(D:D,"Dionysus",E:E,"<>")
=COUNTIFS(B:B,"Athena*",C:C,"<>")+COUNTIFS(D:D,"Athena*",E:E,"<>")
```

### League Standings - Column B Formulas (rows 17-20):

```
='Week 1 (1.4)'!B32+'Week 2 (1.11)'!B32+'Week 3 (1.25)'!B32+'Week 4 (2.1)'!B32+'Week 5 (2.8)'!B32+'Week 6 (2.15)'!B32
='Week 1 (1.4)'!B33+'Week 2 (1.11)'!B33+'Week 3 (1.25)'!B33+'Week 4 (2.1)'!B33+'Week 5 (2.8)'!B33+'Week 6 (2.15)'!B33
='Week 1 (1.4)'!B34+'Week 2 (1.11)'!B34+'Week 3 (1.25)'!B34+'Week 4 (2.1)'!B34+'Week 5 (2.8)'!B34+'Week 6 (2.15)'!B34
='Week 1 (1.4)'!B35+'Week 2 (1.11)'!B35+'Week 3 (1.25)'!B35+'Week 4 (2.1)'!B35+'Week 5 (2.8)'!B35+'Week 6 (2.15)'!B35
```

---

## Implementation Checklist

- [ ] **Week 1 (1.4)**: Add team names (A32-A35) and formulas (B32-B35)
- [ ] **Week 2 (1.11)**: Add team names (A32-A35) and formulas (B32-B35)
- [ ] **Week 3 (1.25)**: Add team names (A32-A35) and formulas (B32-B35)
- [ ] **Week 4 (2.1)**: Add team names (A32-A35) and formulas (B32-B35)
- [ ] **Week 5 (2.8)**: Add team names (A32-A35) and formulas (B32-B35)
- [ ] **Week 6 (2.15)**: Add team names (A32-A35) and formulas (B32-B35)
- [ ] **League Standings**: Update win formulas in column B (rows 17-20)

---

## How It Works

1. **On Week Sheets**: When you fill in column C (Team 1 wins) or column E (Team 2 wins), the formulas automatically count wins for that team.

2. **On League Standings**: The formulas sum up wins from all 6 week sheets to show total wins for each team.

3. **Testing**: Fill in a winner in column C or E on any week sheet, and you should see:
   - The win count update on that week sheet (column B, rows 32-35)
   - The total wins update on the League Standings sheet (column B, rows 17-20)

---

## Troubleshooting

**If formulas show errors:**
- Make sure team names match exactly (check for trailing spaces)
- Verify sheet names match exactly: `'Week 1 (1.4)'`, `'Week 2 (1.11)'`, etc.
- Check that you're using the correct row numbers (B32, B33, B34, B35 on week sheets)

**If Athena formula doesn't work:**
- Try without the wildcard: `=COUNTIFS(B:B,"Athena",C:C,"<>")+COUNTIFS(D:D,"Athena",E:E,"<>")`
- Or check if there are trailing spaces in your data

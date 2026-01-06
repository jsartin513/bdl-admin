# Refactoring Opportunities

> **Note**: This document was created to identify refactoring opportunities. The schedule pages refactoring described below has been **completed** in PR #55.

## 1. Schedule Pages - ✅ COMPLETED

**Issue**: Three nearly identical schedule pages with duplicated CSV parsing logic (~200+ lines each)

**Files**:
- `app/schedules/page.tsx` (432 lines)
- `app/schedules-static/page.tsx` (268 lines)  
- `app/schedules-live/page.tsx` (390 lines)

**Duplication**:
- `parseScheduleCSV` function duplicated with minor variations
- Identical state management (games, teamStats, conflicts, loading, error)
- Similar UI rendering logic
- Only difference: API endpoint (`/api/schedules` vs `/api/schedules-static`)

**Refactoring Solution**:
```typescript
// Create: app/components/schedule/useScheduleData.ts (custom hook)
// Create: app/lib/scheduleParser.ts (shared CSV parsing logic)
// Refactor pages to use shared hook and parser
```

**Benefits**:
- Reduce ~600+ lines of duplicate code
- Single source of truth for CSV parsing
- Easier to maintain and fix bugs
- Consistent behavior across all schedule pages

---

## 2. CSV Parsing Logic - High Priority ⚠️

**Issue**: CSV parsing logic duplicated across 3 schedule pages with slight variations

**Duplication**:
- `parseScheduleCSV` function in each page
- `initializeTeamStats` helper duplicated
- `recordMatchup` logic duplicated (with different implementations)
- Conflict detection logic duplicated

**Refactoring Solution**:
```typescript
// Create: app/lib/scheduleParser.ts
export function parseScheduleCSV(csvData: string, options?: {
  includeMatchups?: boolean;
  includeHomeAway?: boolean;
}): { games: Game[], teamStats: TeamStats, conflicts: Conflict[] }
```

**Benefits**:
- Single implementation to maintain
- Consistent parsing across all pages
- Easier to test
- Can add features once, works everywhere

---

## 3. API Route Error Handling - Medium Priority

**Issue**: Similar error handling patterns across multiple API routes

**Files**:
- `app/api/schedules/route.ts`
- `app/api/players/route.ts`
- `app/api/payments/route.ts`
- `app/api/registrations/route.ts`

**Duplication**:
- Try-catch blocks with similar structure
- Error response formatting
- Authentication error handling

**Refactoring Solution**:
```typescript
// Create: app/api/utils/errorHandler.ts
export function handleApiError(error: unknown): NextResponse
export function requireAuth(session: Session): void | NextResponse
```

**Benefits**:
- Consistent error responses
- Centralized error logging
- Easier to add error tracking/monitoring

---

## 4. Authentication Checks - Medium Priority

**Issue**: Similar authentication checks in multiple API routes

**Duplication**:
- Session validation
- Token checking
- 401 error responses

**Refactoring Solution**:
```typescript
// Create: app/api/middleware/auth.ts
export async function requireAuth(request: NextRequest): Promise<Session | NextResponse>
```

**Benefits**:
- DRY principle
- Consistent auth behavior
- Easier to update auth logic

---

## 5. Google Sheets Authentication - Low Priority

**Issue**: Similar Google Sheets auth patterns

**Files**:
- `app/api/schedules/route.ts`
- `app/api/players/route.ts`
- `app/api/payments/route.ts`

**Note**: Already partially abstracted in `app/_lib/googleSheetsUtils.ts`, but could be improved

---

## Recommended Refactoring Order

1. **First**: Extract CSV parsing logic (affects all 3 schedule pages)
2. **Second**: Create shared schedule data hook (unifies the 3 pages)
3. **Third**: Standardize API error handling
4. **Fourth**: Extract authentication middleware

---

## Estimated Impact

- **Code Reduction**: ~800-1000 lines of duplicate code
- **Maintainability**: Significantly improved (fix bugs once, not 3 times)
- **Testing**: Easier to test shared utilities
- **Consistency**: Guaranteed consistent behavior across pages


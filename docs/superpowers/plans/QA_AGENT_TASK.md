# QA Review Agent Task: Security Test Coverage Audit

**Role:** Read-only QA review. Do NOT modify any files.

**Goal:** Audit all tRPC router security tests for coverage completeness and pattern compliance. Report gaps.

---

## What to Review

Security test files are in `apps/web/server/routers/__tests__/`. Each `*.security.test.ts` covers one router.

For EACH test file, verify:

### Coverage Checklist

1. **Unauthenticated access (UNAUTHORIZED)**
   - Every procedure (query + mutation) has a test with `anonCaller`
   - Expects `{ code: 'UNAUTHORIZED' }`

2. **Non-member access (FORBIDDEN)**
   - Every procedure that accepts `org_id` has a test where the caller is authenticated but NOT a member of that org
   - Expects `{ code: 'FORBIDDEN' }`

3. **Role enforcement (FORBIDDEN)**
   - For coordinator-only procedures: test that caregiver and supporter both get FORBIDDEN
   - For coordinator+caregiver procedures: test that supporter gets FORBIDDEN
   - For any-member procedures: test that all active roles succeed

4. **IDOR prevention**
   - Any procedure accepting `org_id` + `recipient_id` should verify `recipient_id` belongs to `org_id`
   - If the router does this check, there should be a test for it

5. **Happy paths**
   - At least one success test per procedure

6. **Error handling**
   - PGRST116 (no rows) should return null, not throw — verify tests exist where routers handle this

---

## Routers to Review

| Router file | Test file | Notes |
|-------------|-----------|-------|
| `careEvents.ts` | `careEventsRouter.security.test.ts` | |
| `memberships.ts` | `membershipsRouter.security.test.ts` | invite flow |
| `shifts.ts` | `shiftsRouter.security.test.ts` | canonical pattern |
| `coverageWindows.ts` | `coverageWindowsRouter.security.test.ts` | coordinator-only create/delete |
| `organizations.ts` | `organizationsRouter.security.test.ts` | |
| `medications.ts` | `medicationsRouter.security.test.ts` | |
| `symptoms.ts` | `symptomsRouter.security.test.ts` | |
| `burnout.ts` | `burnoutRouter.security.test.ts` | |
| `outerCircle.ts` | `outerCircleRouter.security.test.ts` | |
| `expenses.ts` | `expensesRouter.security.test.ts` | NEW — added this session |
| `benefits.ts` | `benefitsRouter.security.test.ts` | NEW — added this session |
| `documents.ts` | `documentsRouter.security.test.ts` | NEW — added this session |
| `eolPlan.ts` | `eolPlanRouter.security.test.ts` | NEW — added this session |

---

## How to run the tests

```bash
cd /Users/bradygrapentine/Documents/projects/carelog/apps/web
npx vitest run --reporter=verbose 2>&1 | grep -E "security|PASS|FAIL"
```

---

## Output Format

Report using this structure:

```
## Router: [name]

### ✅ Covered
- [list what is covered]

### ❌ Missing
- [list what is missing with exact test name suggestions]

### ⚠️ Pattern issues
- [any deviations from the standard pattern that could mask bugs]
```

At the end, produce a **Summary Table**:

| Router | Auth tests | IDOR tests | Role tests | Happy paths | Status |
|--------|------------|------------|------------|-------------|--------|
| ...    | ✅/❌       | ✅/❌       | ✅/❌       | ✅/❌        | OK/GAPS |

---

## Do NOT

- Do not edit any files
- Do not run `git` commands
- Do not propose code changes — only report findings

# Code Quality Review — UX-06 Sidebar Tooltips
**Branch:** `feat/ux-06-sidebar-tooltips`  
**Files:** `SidebarNav.tsx`, `SidebarNav.test.tsx`  
**Date:** 2026-04-15

---

## Summary
UX-06 implements sidebar tooltips using shadcn's `<Tooltip>` primitive from `@base-ui/react`. The feature correctly shows labels on hover when `showLabels={false}` (icon-only mode) and hides tooltips when in expanded mode. Implementation is solid, but **one critical accessibility issue** and **one test reliability concern** require fixes.

---

## Strengths

1. **Conditional rendering correct** — Tooltips only wrap buttons when `showLabels={false}`. Expanded mode returns button directly without wrapper. Clean pattern.

2. **aria-label preserved** — All buttons retain `aria-label={label}` in both collapsed and expanded modes. Tests verify this explicitly.

3. **Import hygiene** — All imported Tooltip components are used. No dead imports.

4. **Test structure sound** — Tests cover:
   - Icon-only mode wrapping (aria-label intact)
   - Expanded mode visible text
   - Hover visibility
   - Updated to 7 nav items (Messages added)

5. **Styling unchanged** — No breaking changes to button classes; tooltip positioning (`side="right"`) is appropriate for left sidebar.

---

## Issues

### **CRITICAL — Broken Radix Accessibility Contract**

**Location:** `SidebarNav.tsx`, line ~52  
**Issue:** `<TooltipTrigger render={button} />`

The `@base-ui/react` Tooltip expects `asChild` pattern, not a `render` prop. Current code breaks the trigger's keyboard/focus behavior.

**What should happen:**
```tsx
<TooltipTrigger asChild>
  {button}
</TooltipTrigger>
```

**Current (broken):**
```tsx
<TooltipTrigger render={button} />  // ❌ Invalid prop
```

**Impact:** Keyboard navigation (Tab, Enter) may not work. Screen readers may lose focus management. Button's `aria-label` may not reach assistive tech through the trigger wrapper.

**Verdict:** ❌ **DO NOT MERGE** until fixed. This violates the Carelog a11y contract (WCAG 2.2 AA).

---

### **IMPORTANT — Test Reliability Concern**

**Location:** `SidebarNav.test.tsx`, lines 91–103  
**Issue:** `fireEvent.mouseEnter()` + `waitFor()` for hover testing

The test simulates hover correctly *for Vitest unit tests*, but the comment mentions "Playwright browser" — which is wrong. This is a Vitest RTL test, not an E2E test. `fireEvent.mouseEnter()` works here, but the relationship between the trigger and content depends on **fixing the Radix contract first** (critical issue above).

**Current pattern (acceptable for Vitest):**
```tsx
fireEvent.mouseEnter(journalBtn);
await waitFor(() => {
  const tooltipContent = screen.getByText("Journal");
  expect(tooltipContent).toBeVisible();
});
```

**What the comment suggests (E2E Playwright):**
```tsx
// E2E tests need userEvent.hover() or await page.hover()
// This is unit test, not E2E
```

**Verdict:** ⚠️ **IMPORTANT** — Update test comment or verify TooltipContent actually renders in DOM when trigger is hovered. After Radix fix, re-run tests to confirm hover shows the tooltip. Current test may pass falsely if `screen.getByText("Journal")` finds the aria-label instead of the TooltipContent.

---

### **MINOR — Tooltip Delay / UX Polish**

**Location:** `SidebarNav.tsx`, line 37  
**Issue:** No explicit delay on hover

`<TooltipProvider>` uses default `delay={0}` (from shadcn defaults). For a sidebar nav with 7 items, instant-open tooltips may cause jitter when users quickly scan buttons. Consider a small delay (e.g., 200ms) to prevent tooltip spam.

**Suggested:**
```tsx
<TooltipProvider delay={200}>
```

**Verdict:** 🟡 **Optional** — Ship as-is or add delay for polish. Not a blocker.

---

## Test Coverage Assessment

| Scenario | Covered? | Notes |
|----------|----------|-------|
| Icon-only mode wraps in Tooltip | ✅ Yes | aria-label retention tested |
| Expanded mode skips Tooltip | ✅ Yes | Visible text tested |
| Hover shows tooltip | ⚠️ Conditional | Depends on Radix fix |
| Button click still works | ✅ Yes | Existing tests pass |
| All 7 nav items render | ✅ Yes | Updated from 6 → 7 |

---

## Verdict

**❌ CHANGES REQUIRED — DO NOT MERGE**

1. **Fix Radix contract:** Change `render={button}` to `asChild` with children.
2. **Verify hover test:** After fix #1, re-run tests and confirm TooltipContent renders on `fireEvent.mouseEnter()`.
3. **Optional:** Add 200ms delay to `<TooltipProvider>` for UX polish.

**Estimated fix time:** <5 min (Radix syntax correction + re-test).

---

## Reference Files

- **Tooltip component API:** `/apps/web/components/ui/tooltip.tsx` — uses `TooltipPrimitive.Trigger`, expects `asChild` or children
- **WCAG a11y rules:** `.claude/rules/ui-standards.md` §2 — keyboard + focus ring requirements
- **Sidebar tests:** `/apps/web/components/sidebar/__tests__/SidebarNav.test.tsx` — line 91+

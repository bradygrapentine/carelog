# Carelog — TODO/FIXME Audit

Audit date: 2026-04-14. Source: `grep -rn "TODO|FIXME|XXX|HACK" apps/ packages/ supabase/ --include="*.ts" --include="*.tsx" --include="*.sql" | grep -v node_modules | grep -v ".next"`.

---

## Summary

| Category | Count |
|---|---|
| Resolve (fixed inline) | 0 |
| Convert (new backlog rows) | 2 groups |
| Delete (removed) | 6 |
| Keep (accurate/informational) | 1 |

---

## Classification table

| File | Line(s) | Comment | Classification | Action |
|---|---|---|---|---|
| `e2e/medications.spec.ts` | 35, 37, 152, 177, 188, 194 | Missing `data-testid` attributes on medication components | **Convert** | ON-47: add data-testid attrs to MedicationChecklist + inputs |
| `apps/web/app/brief/[shareToken]/page.tsx` | 35, 119, 145, 164, 172, 182, 224, 233, 252, 254, 290, 299, 315, 325, 327, 349, 359, 378, 385 | Missing neutral design tokens (`gray-50`, `gray-100`, `gray-200`, `gray-400`, `gray-700`, `#fff`) | **Convert** | ON-48: add `--color-neutral-{50,100,200,400}` and `--color-white` tokens to `globals.css`; update brief page |
| `apps/web/app/api/export/ExportDocument.tsx` | 5–10 | Header block listing token gaps for react-pdf | **Delete** | NOTE comment on line 4 already explains why raw hex is required; remove lines 5–10 |
| `apps/web/app/api/export/ExportDocument.tsx` | 157 | Inline `/* TODO: no CSS var support ... */` | **Keep** | Informational — explains intentional raw hex; leave as-is |

---

## Details

### e2e/medications.spec.ts — Convert → ON-47

Six TODOs in the E2E spec reference missing `data-testid` attributes that would make the tests more reliable:

- `data-testid="medication-name-input"`
- `data-testid="medication-dosage-input"`
- `data-testid="add-medication-btn"`
- `data-testid="medication-checklist"`
- `data-testid="dose-given-indicator"`

These require component changes in `apps/web/app/(app)/`. Converted to backlog row ON-47.

### apps/web/app/brief/[shareToken]/page.tsx — Convert → ON-48

19 TODOs flag missing neutral gray tokens. The `brief` page was built before the neutral gray scale was added to the design token system. The existing workaround (using `--color-surface` and `--color-muted` for gray shades) is functional but imprecise. A proper fix requires adding tokens to `globals.css` and updating the brief page. Converted to backlog row ON-48.

### apps/web/app/api/export/ExportDocument.tsx lines 5–10 — Delete

The six header TODO lines are redundant — the NOTE comment on line 4 already states `@react-pdf/renderer` does not support CSS variables and that raw hex is intentional. These TODOs do not track actionable work. Deleted.

---

## Inline fixes applied

- Deleted `ExportDocument.tsx` lines 5–10 (redundant token-gap comments)

---

## New backlog rows added

- **ON-47** — Add `data-testid` attributes to medication components (enables E2E selectors)
- **ON-48** — Add neutral design tokens to `globals.css` and update `brief` page

---
title: Harness Enhancements — UI Redesign Support
date: 2026-04-10
status: proposed
---

# Harness Enhancements — UI Redesign Support

Targeted Claude Code automation additions to support the UI redesign. These are additive — they do not modify existing hooks.

---

## 1. shadcn Component Install Hook (PreToolUse guard)

**Problem:** During reskinning, it's easy to forget to install a shadcn component before importing it. The error only surfaces at build time, not at edit time.

**Enhancement:** Add a `PreToolUse` guard that detects imports of `@/components/ui/<name>` in edited files and checks whether that file exists. If it doesn't, emit a warning with the install command.

**Implementation:**

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "python3 -c \"\nimport sys, json, re, os\ndata = json.load(sys.stdin)\ncontent = data.get('tool_input', {}).get('new_string', '') or data.get('tool_input', {}).get('content', '')\nmatches = re.findall(r'from [\\\"\\']@/components/ui/([^\\\"\\'\\.]+)', content)\nfor name in matches:\n    path = 'apps/web/components/ui/' + name + '.tsx'\n    if not os.path.exists(path):\n        print(f'WARNING: {path} does not exist. Run: pnpm dlx shadcn@latest add {name}')\n\""
    }
  ]
}
```

**Notes:**
- Read-only check, never blocks
- Fires only on Edit/Write to `*.tsx` files
- Complement with a project-level `.claude/skills/add-component` skill (see §4)

---

## 2. Raw Card Pattern Lint Warning (PostToolUse)

**Problem:** After shadcn `Card` is available, developers (and Claude) may still write `<div className="bg-white border border-gray-100 rounded-xl shadow-sm ...">` out of habit. This creates inconsistency.

**Enhancement:** After Edit/Write, scan the file for the legacy card div pattern and warn if found.

**Implementation:**

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "python3 -c \"\nimport sys, json, re\ndata = json.load(sys.stdin)\nfp = data.get('tool_input', {}).get('file_path', '')\nif not fp.endswith('.tsx'): sys.exit(0)\ntry:\n    content = open(fp).read()\nexcept: sys.exit(0)\nif re.search(r'className=.*bg-white.*border.*rounded-xl.*shadow', content):\n    print('HINT: Raw card div detected. Prefer <Card> from @/components/ui/card for consistency.')\n\""
    }
  ]
}
```

**Notes:**
- Hint only — does not block
- Can be removed once the reskinning phase is complete

---

## 3. Responsive Breakpoint Reminder (PostToolUse)

**Problem:** When implementing sidebar or layout components, it's easy to ship desktop-only markup without adding the `md:` breakpoint variants.

**Enhancement:** After editing files in `sidebar/` or `JournalClient.tsx`, check whether `md:` appears in the file. If not, emit a reminder.

**Implementation:**

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "python3 -c \"\nimport sys, json\ndata = json.load(sys.stdin)\nfp = data.get('tool_input', {}).get('file_path', '')\nif not any(x in fp for x in ['sidebar', 'SidebarRail', 'SidebarSheet', 'JournalClient']): sys.exit(0)\ntry:\n    content = open(fp).read()\nexcept: sys.exit(0)\nif 'md:' not in content:\n    print('REMINDER: This file is layout-critical. Verify md: breakpoint variants are present for responsive behavior.')\n\""
    }
  ]
}
```

---

## 4. `/add-component` Skill

**Purpose:** Shorthand for adding a shadcn component and immediately verifying it installed correctly.

**File:** `.claude/skills/add-component/`

**Behavior:**
1. Run `pnpm dlx shadcn@latest add <component-name>`
2. Verify `apps/web/components/ui/<component-name>.tsx` exists
3. Report success or failure

**Trigger:** `/add-component button`, `/add-component sheet`, etc.

**Skill file content:**

```
Add a shadcn/ui component to the project.

Steps:
1. Run: pnpm dlx shadcn@latest add {args}
2. Verify the file exists: apps/web/components/ui/{args}.tsx
3. Report: "✓ {args} installed at apps/web/components/ui/{args}.tsx" or the error output.
```

---

## 5. Visual Regression Checkpoint (Manual, not automated)

**Problem:** No automated visual regression testing in scope for Phase 1. But reskinning 15+ panels creates real regression risk for functional behavior.

**Enhancement:** Add a Playwright smoke test that visits `/journal/[recipientId]` after login and asserts:
- Sidebar rail is present (`data-testid="sidebar-rail"`)
- At least one journal entry card renders
- No `console.error` output

This is a functional smoke test, not a pixel comparison. It gives CI a signal without requiring Percy/Chromatic.

**File:** `e2e/ui-smoke.spec.ts`

**Note:** This is a backlog item for the test suite — not a hook. Include as a task in the implementation plan.

---

## Activation

Add hooks §1–3 to `.claude/settings.json` under the existing `hooks` array. Skill §4 can be added immediately. Smoke test §5 is part of the implementation plan.

All hooks are additive and read-only — they warn but never block or modify files.

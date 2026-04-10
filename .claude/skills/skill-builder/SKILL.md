---
name: skill-builder
description: Use when creating new skills, optimizing existing skills, or auditing skill quality. Guides skill development following Claude Code official best practices.
---

## What This Skill Does

Guides the creation and optimization of Claude Code skills using official best practices from the Claude Code documentation. Use this whenever:

- Building a new skill from scratch
- Optimizing or auditing an existing skill
- Deciding on advanced features (subagent execution, hooks, dynamic context, etc.)
- Troubleshooting a skill that isn't working correctly

For the complete technical reference on all frontmatter fields, advanced patterns, and troubleshooting, see [reference.md](reference.md).

## Mode 1: Build a New Skill

When building a new skill, run the **Discovery Interview** first. Do NOT start writing files until discovery is complete.

### Discovery Interview

Ask questions using AskUserQuestion, one round at a time. Each round covers one topic. Move to the next round only after the user answers. Keep going until you're 95% confident you understand the skill well enough to build it without further clarification.

**Round 1: Goal & Name**
- What does this skill do? What problem does it solve or what workflow does it automate?
- What should we call it? (Suggest a name based on their answer -- lowercase, hyphens, max 64 chars)

**Round 2: Trigger**
- What would someone say to trigger this? (Get 2-3 natural language phrases)
- Should it be user-only (`/slash-command`), Claude-auto-invocable, or both?
- Does it accept arguments? If so, what? (e.g., a topic, a URL, a file path)

**Round 3: Step-by-Step Process**
- Walk me through exactly what should happen from trigger to output. What's step 1? Step 2? Keep going.
- For each step: Does Claude do it directly, or delegate to a subagent/script?
- Does this need to be conversational (back-and-forth with the user) or is it a fire-and-forget task?

**Round 4: Inputs, Outputs & Dependencies**
- What inputs does the skill need? (Files, API responses, user arguments, live data)
- What does it produce? (Files, text output, structured data) Where do outputs go?
- Does it need external APIs, scripts, or tools? Which ones?
- Does it need reference files, style guides, templates, or examples?

**Round 5: Guardrails & Edge Cases**
- What could go wrong? What are the common failure modes?
- What should this skill NOT do? Any hard boundaries?
- Are there cost concerns? (API calls, AI image generation, etc.)
- Any ordering or dependency constraints? (e.g., "must check X before doing Y")

**Round 6: Confirmation**
After all rounds, summarize your understanding back to the user in this format:

```
## Skill Summary: [name]

**Goal:** [one sentence]
**Trigger:** `/name` + [natural language phrases]
**Arguments:** [what it accepts, or "none"]

**Process:**
1. [step]
2. [step]
...

**Inputs:** [what it reads/needs]
**Outputs:** [what it produces + where]
**Dependencies:** [APIs, scripts, agents, reference files]
**Guardrails:** [what can go wrong, what to avoid]
```

Ask: "Does this capture it? Anything to add or change?" Only proceed to building once the user confirms.

**Skipping rounds:** If the user provides enough context upfront (e.g., they describe the full workflow in their first message), skip rounds that are already answered. Don't re-ask what you already know.

### Build Phase

Once discovery is complete, build the skill following these steps:

**Step 1: Choose the skill type**

- **Task skills** (most of ours) give step-by-step instructions for a specific action. Invoked with `/name` or natural language.
- **Reference skills** add knowledge Claude applies to current work. Conventions, patterns, style guides.

**Step 2: Configure frontmatter**

Set these fields based on what you learned in discovery:

- `name` -- Matches the directory name.
- `description` -- Written as: "Use when someone asks to [action], [action], or [action]." Include natural keywords from the trigger phrases.
- `disable-model-invocation: true` -- Set if the skill has side effects (file generation, API calls, costs money).
- `argument-hint` -- Set if the skill accepts arguments.
- `context: fork` + `agent` -- Set if the skill is self-contained and doesn't need conversation history.
- `model` -- Set if a specific model capability is needed.
- `allowed-tools` -- Set if the skill should have restricted tool access.

For the full field reference and invocation control matrix, see [reference.md](reference.md).

**Step 3: Write the skill content**

Structure task skills as:
1. **Context** -- Files to read, APIs, brand assets, agent prompts
2. **Step-by-step workflow** -- Numbered steps. Each step tells Claude exactly what to do.
3. **Output format** -- What the result looks like. Include templates, file paths, structured formats.
4. **Notes** -- Edge cases, constraints, what to delegate, what NOT to do.

Content rules:
- Keep SKILL.md under 500 lines. Move detailed reference to supporting files.
- Use `$ARGUMENTS` / `$N` for dynamic input from arguments.
- Use `!`command`` for dynamic context injection (preprocessing).
- Be specific about agent delegation -- include exact prompt text.
- Specify all file paths (inputs, outputs, scripts, references).

**Step 4: Add supporting files (if needed)**

```
my-skill/
 SKILL.md           # Main instructions (required, <500 lines)
 reference.md       # Detailed docs (loaded when needed)
 examples/
   sample.md        # Example output
 scripts/
   helper.py        # Utility script
```

Reference these from SKILL.md so Claude knows they exist and when to load them.

**Step 5: Register in CLAUDE.md**

1. Add to **Active Skills** section with: name, trigger command, trigger phrases, description, agents used, output location.
2. Log the decision in `decisions/log.md`.

**Step 6: Test**

1. **Natural language** -- Say something matching the description. Check if Claude loads it.
2. **Direct invocation** -- Run `/skill-name` with test arguments.

If issues arise, see Troubleshooting in [reference.md](reference.md).

---

## Mode 2: Audit an Existing Skill

Use this checklist to audit any existing skill. Fix issues before marking the audit complete.

### Frontmatter Audit

- [ ] `name` matches the directory name
- [ ] `description` uses natural keywords someone would actually say when they need this skill
- [ ] `description` is specific enough to avoid false triggers but broad enough to catch real requests
- [ ] `disable-model-invocation: true` is set if the skill has side effects (generates files, calls APIs, sends messages, costs money)
- [ ] `argument-hint` is set if the skill accepts arguments via `/name`
- [ ] `allowed-tools` is set if the skill should NOT have access to all tools
- [ ] `context: fork` is used if the skill is self-contained and produces verbose output
- [ ] `model` is set if a specific model capability is needed
- [ ] No unnecessary fields are set (don't add frontmatter just because you can)

### Content Audit

- [ ] Total SKILL.md is under 500 lines (detailed reference in supporting files)
- [ ] Clear step-by-step workflow with numbered steps (for task skills)
- [ ] Output format is specified with templates or examples
- [ ] All file paths and locations are documented
- [ ] Agent delegation instructions include the actual prompt text to send
- [ ] Notes section covers edge cases, constraints, and what NOT to do
- [ ] No vague instructions -- every step tells Claude exactly what to do
- [ ] String substitutions (`$ARGUMENTS`, `$N`) are used where the skill takes input

### Integration Audit

- [ ] Skill is registered in CLAUDE.md under Active Skills
- [ ] Creation was logged in `decisions/log.md`
- [ ] Supporting files (if any) are referenced from SKILL.md, not orphaned
- [ ] Scripts (if any) have correct file paths and are executable
- [ ] API keys (if any) are read from `.env` with placeholders documented

### Quality Audit

- [ ] A complete beginner (to Claude Code, not necessarily to the topic) could follow the instructions
- [ ] Instructions are actionable, not abstract
- [ ] Delegates to subagents when appropriate to keep main context clean
- [ ] Doesn't duplicate information that lives elsewhere (CLAUDE.md, other skills)
- [ ] Output paths follow project conventions (`projects/[skill-name]/`)

### Optimization Opportunities

After running the audit, evaluate whether the skill would benefit from:

- **`context: fork`** -- If it produces verbose output or is fully self-contained
- **`allowed-tools`** -- If it only needs read access or specific tools
- **Supporting files** -- If SKILL.md is over 300 lines, move reference material out
- **Dynamic context injection** -- If the skill needs live data (git status, API responses, file listings) injected before Claude sees the content
- **Hooks** -- If the skill needs pre/post validation on tool usage
- **`argument-hint`** -- If users would benefit from autocomplete guidance

---

## Our Project Conventions

Skills in this project follow these conventions:

- Skills live in `.claude/skills/[skill-name]/SKILL.md`
- Agents live in `.claude/agents/[agent-name].md`
- Output files go in `projects/[skill-name]/`
- API keys are read from `.env` (never ask Nate for keys)
- Scripts go in `scripts/[skill-name]/`
- Brand assets are in `brand-assets/`
- Reference material is in `references/`
- All skills are registered in CLAUDE.md under Active Skills
- All creation decisions are logged in `decisions/log.md`
- Frontmatter `description` field is written as: "Use when someone asks to [action], [action], or [action]."

## Important Notes

- Always read the existing skill before optimizing it. Never propose changes to code you haven't read.
- When building a new skill, check if a similar skill already exists that could be extended instead.
- Skills and agents work together in two directions: skills can run inside agents (`context: fork` + `agent`), and agents can preload skills (`skills` field in agent frontmatter). Choose the right direction based on who controls the system prompt.
- Skill descriptions are loaded into context. If there are many skills, they may exceed the character budget (2% of context window, fallback 16,000 chars). Keep descriptions concise.
- The `/` menu only shows skills where `user-invocable` is not `false`. Use `user-invocable: false` for background knowledge skills.
- `disable-model-invocation: true` is the strongest restriction -- it removes the skill from Claude's context entirely and prevents programmatic invocation via the Skill tool.
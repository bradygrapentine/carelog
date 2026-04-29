# Product

## Register

product

## Users

The whole care team — primary caregiver, siblings, paid aides, occasional clinicians — with a strong emphasis on the **exhausted primary caregiver**. They are time-poor, emotionally loaded, and have low patience for friction. The recipient is usually an aging parent or chronically ill family member.

Context of use is the worst part of someone's day, not the best: late-evening triage on a phone, one-handed, after a hospital call. The product is opened in five-minute slivers, not 45-minute sessions. Adults skewing 35-65; many are not power users.

The job to be done is **coordinate care without dropping anything** — log what happened, see what's coming, hand off to the next person, keep a record a doctor would respect.

## Product Purpose

CareSync replaces the fragmented stack a family caregiver currently uses to coordinate care: a group chat for updates, a shared note for medications, an inbox for appointments, a memory for everything else. It collapses those into one place where the family operates as a small team and a clinician can read a credible record.

Success looks like: families stop dropping things, the primary caregiver feels less alone, and a doctor's appointment starts with a real summary instead of "remind me when this started?"

## Brand Personality

**Warm · candid · companion.** CareSync sits beside the caregiver, not above them. Plainspoken, never sentimental. It acknowledges that the situation is hard without performing empathy at the user. Voice is closer to a thoughtful friend who has been through it than a wellness app or a clinical tool.

It should feel like the product knows what an exhausted Tuesday at 11pm looks like.

## Anti-references

CareSync must not look or feel like any of these. They are the four big tonal failures in this category:

- **Clinical / EHR** — Epic MyChart, Athenahealth, Cerner. Cold, dense, bureaucratic, color-by-status. Reads as a system that exists to bill insurance, not to help a family.
- **Sentimental wellness** — soft pastels, hand-lettered fonts, butterfly-and-sunset imagery, "self-care ✨" tone, pet-name encouragement. Infantilizes someone whose parent is dying. Worst-fit register.
- **Generic SaaS** — Stripe-clone gradients, hero-metric cards, "AI-powered" badges, illustration-heavy landing pages, indistinguishable from any B2B tool. Strips warmth in pursuit of a category-default look.
- **Maximalist consumer app** — loud animations, bouncy emoji, gamified streaks, social-network energy. Wrong tonal register for caregiving. Confetti is never appropriate here.

If a screenshot could be mistaken for any of the four, redo it.

## Design Principles

1. **One thing at a time.** Every screen has a single primary action; everything else hides until it's needed. Caregivers operate in five-minute slivers — surfaces must not negotiate for attention.
2. **Calm beats clever.** When in doubt, pick the quieter option. The user is already overloaded; the UI subtracts load, never adds personality. No micro-interactions for their own sake.
3. **Warm, never sentimental.** Plainspoken, candid, beside-the-user. Acknowledges hard situations by not performing them. No emotional copy where a date and a name will do.
4. **The recipient is a person, not a chart.** Lead with names, faces, and voices before metrics, badges, or status pills. The family member being cared for is the subject of the product, not its data.
5. **Accessibility is the floor, not a feature.** Practice what we preach — caregivers skew older, use the app under stress, often one-handed. Designs that fail keyboard, contrast, motion, or 320px reflow are not done.

## Accessibility & Inclusion

**WCAG 2.2 AA, enforced.** AA contrast on body and large text; visible focus rings on every interactive; full keyboard parity; semantic HTML by default; labels (or aria-label) on every control. Touch targets ≥40×40px on mobile. No horizontal scroll at 320px.

`prefers-reduced-motion` respected on every animation. Reflow tested at 200% zoom. Color is never the only signal of state — pair every mood/severity/status color with text or icon.

Hard rules already codified in `.claude/rules/ui-standards.md` — that file is load-bearing and should be loaded before any UI work.

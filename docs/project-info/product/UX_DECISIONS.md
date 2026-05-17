# Carelog — UX & Language Decisions

> **Canonical surface for product language, tone, and UX decisions** (audience: engineers writing copy + product folk). Architecture and system-design decisions belong in [`docs/adr/`](../../adr/README.md).

These decisions are as important as the technical ones.
The language and emotional framing of this product are deliberate.
Do not change them without understanding the reasoning.

## The core UX philosophy

Caregiving is invisible, exhausting, and isolating. The primary caregiver
often feels unseen. The platform should make them feel seen — not just
productive. Every interaction is designed with that in mind.

The product is for people in a hard situation. The tone is warm, direct,
and human. Never clinical. Never corporate.

## Language choices

### "Share" not "log"
"Log how today went" sounds like a task.
"Share how today went" sounds like talking to family.

The journal entry placeholder is: "Share how today went..."
Not: "Log today's care events"
Not: "Record today's activities"

This distinction matters because the target user is a caregiver who is
emotionally exhausted. Language that feels like paperwork creates friction.
Language that feels like sharing with people who care reduces friction.

### "Care team" not "users" or "members"
The people on this platform have a human relationship to each other.
They are a care team, not a user group.

### "Caring for" not "patient" or "care recipient"
The UI says "Who are you caring for?" not "Patient name" or "Care recipient name."
The person receiving care is someone's parent, spouse, or child.
Never reduce them to a clinical term in the UI.

(Note: internally in code and database, we use `care_recipient` because it's
precise and professional. The distinction is UI-facing vs internal.)

### "Flagged for doctor" not "medical alert"
The flag feature marks journal entries for inclusion in the doctor export.
"Flag for doctor" is concrete and actionable.
"Medical alert" sounds alarming.

### Role names in the UI
- Coordinator (not "Admin" or "Owner")
- Caregiver (not "User" or "Member")
- Supporter (not "Viewer" or "Reader")
- Aide (not "Professional" or "Worker")

### Invite language
"You have been invited to join a care team"
Not: "You have been added as a user"
Not: "Account invitation"

### Error messages
Write error messages as if a helpful person is explaining what happened.
Never: "Error 400: invalid_payload"
Better: "Something went wrong. Please try again."
Best: "This invite has already been used. Ask the coordinator to send a new one."

## Emotional framing decisions

### The journal is for the caregiver, not a record system
The journal exists to help caregivers feel heard and to give supporters
visibility into how hard things actually are. It is not primarily a
medical record (that's a side benefit, not the purpose).

Write UI copy that reflects this:
- "Share how today went" — caregiver-facing
- "No entries yet. Share how today is going above." — gentle, not a checklist

### Supporter reactions are acknowledgment, not engagement metrics
The reaction types (heart, thinking of you, strong, grateful) are designed
to feel like a hand on the shoulder from someone far away.
They are NOT likes, upvotes, or engagement signals.
This distinction must be maintained in how they're presented in the UI.

### The weekly digest is for supporters, not managers
The weekly digest goes to supporters and coordinators.
It is not a performance report.
It is not a status update for a boss.
It is a window into how the family is doing for people who care but
aren't on the ground.

The tone of the digest should feel like a letter from the primary caregiver,
not a dashboard report.

## Design principles

### Calm, not urgent
Everything in the UI should feel calm. This is a stressful situation —
the platform should be a refuge from that stress, not add to it.

No red alerts unless something is actually wrong.
No notification badges trying to pull attention.
No dark patterns that create urgency.

### Compact system events, prominent human entries
The timeline shows both system events (medication logged, shift completed)
and human-written journal entries. System events are compact and muted.
Human entries are prominent and warm.

The `entry_kind: 'human' | 'system'` distinction exists specifically for this.
Do not visually equate a medication log entry with a journal entry.

### Information architecture: organize by recipient, not by feature
The primary navigation is by care recipient (care team), not by feature
(medications, journal, schedule). A user cares about one person — they
should see that person's full picture, not navigate between feature silos.

This is why the journal page shows the team panel, not a separate "team" section.
Everything about one recipient is in one place.

### Progressive disclosure
Show the minimum necessary at first. Expand when needed.
The journal entry form starts as a single text area.
It expands when focused to show mood tags and submit button.
This reduces the blank-page feeling for a tired caregiver.

### Mobile-first
The primary use case is a caregiver logging from their phone while the
care recipient is asleep or during a handoff. The web app should work on
mobile. The Expo app is the target for daily use.

## What we borrowed from competitors (and improved)

### From CaringBridge — supporter reactions
CaringBridge has "hearts" on posts. We adapted this to four specific reactions
(heart, thinking_of_you, strong, grateful) that reflect what caregivers
actually want to hear from supporters. Generic likes feel hollow.
The reactions here are intentionally limited to keep them meaningful.

### From CaringBridge — emotional journal framing
CaringBridge encourages writing updates addressed to the community.
We took the emotional framing but made it private to the care team.
"Share how today went" implies writing for people who care, not for an audience.

### From ianacare — the outer circle insight
ianacare's research found that helpers don't know how to help.
They want to help but don't know what's needed. The outer circle volunteer
board solves this: coordinators post specific, time-bound requests.
Helpers claim slots. No awkward "let me know if you need anything."

### What we deliberately did NOT copy
CaringBridge's public posts and comment threads — caregiving is private.
Lotsa Helping Hands' consumer-grade UI — our users are stressed adults, not casual users.
Caring Village's feature sprawl — they built everything shallowly.

## Things that must not change without team discussion

1. The journal placeholder text — "Share how today went..."
2. The reaction set — heart, thinking_of_you, strong, grateful (not expandable without research)
3. The role names — coordinator, caregiver, supporter, aide
4. The emotional tone of error messages
5. The fact that supporter reactions are NOT likes/upvotes
6. The information architecture organized by recipient not by feature

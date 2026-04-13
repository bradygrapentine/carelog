# Mobile OCR Scan Review — Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Overview

Mobile users can scan documents (lab results, appointment summaries, bills, pharmacy receipts) using the camera or photo library. OCR runs server-side via the existing Inngest pipeline. The user reviews and corrects extracted fields in-app before saving.

## Architecture

### Data Flow

1. User captures or selects an image in-app
2. App uploads image to Supabase Storage and enqueues an Inngest OCR job
3. Inngest pipeline:
   - Classifies document type (lab result, bill, appointment summary, pharmacy receipt)
   - Extracts fields as typed key-value pairs: `{ label: string, value: string, type: "text" | "number" | "date" | "currency", confidence: number }`
   - Writes a `scanned_document` row with `status: "pending_review"`
   - Sends push notification: "Your scan is ready to review"
4. User opens review screen (via notification or in-app banner)
5. User edits any misread fields, taps Save
6. Row updates to `status: "saved"`

### Shared Pipeline

The Inngest OCR pipeline is shared between web and mobile — no mobile-specific pipeline code. The `scanned_document` table is the source of truth for both. A scan started on mobile can be viewed or re-edited on web.

### Field Schema

Fields are generic key-value pairs with a type hint. Document type classification happens server-side; mobile does not need per-type schemas.

Low-confidence fields (`confidence < 0.8`) are flagged so users know to verify them.

## Screens

### 1. Capture

- Camera viewfinder with tap-to-capture
- "Choose from library" option below viewfinder
- Preview step after capture (user confirms before uploading)
- Upload enqueues Inngest job and dismisses with toast: "Scan processing…"

### 2. Notification → Review

- Push notification: "Your scan is ready to review" → deep-links to review screen for that document
- If user is already in-app: in-app banner with same action

### 3. Review Screen

- **Header:** document type badge + date scanned
- **Field list:** scrollable, one editable row per extracted field
  - Label (read-only) + value input
  - Input type matches field type (text, number picker, date picker, currency input)
  - Low-confidence fields show a yellow indicator
- **Save button:** fixed at bottom, confirms and writes `status: "saved"` to DB
- **Discard option:** top-right, deletes the pending document after confirmation

### 4. Saved Confirmation

- Brief success animation
- Routes to document detail view

## Error Handling

- Upload fails: show retry option, do not dismiss capture screen
- OCR fails / pipeline errors: notification says "Scan failed — try again"; pending row is marked `status: "error"`
- Notification not received: pending scans surface in a "Pending Reviews" section on the home screen (badge count)

## Out of Scope

- Mobile-specific OCR pipeline (reuses web pipeline)
- Per-document-type structured schemas on mobile
- Bulk scan (one document per session)
- Web review panel changes (already exists, no changes needed)

# Doctor Dashboard

The clinician-facing dashboard for the Care Loop heart-failure remote-monitoring
use case - a UI wrapper over OpenEMR where a doctor reviews the cases the front
desk escalates to them. Next.js (App Router) on Bun, styled entirely with
shadcn/ui (port 3003).

## What it does

The front desk escalates flagged heart-failure alert tasks to a clinician; this
dashboard is where the doctor works those cases - vitals decompensation trend,
symptom questionnaire responses, labs, medications - and closes the loop
(telehealth / EHR review).

- `/` - dashboard: stat cards, today's telehealth/review schedule, review queue.
- `/schedule` - the day's review slots for escalated patients.
- `/patients` and `/patients/[id]` - escalated-case worklist and per-patient
  clinical detail (overview, vitals trend, medications, labs, notes).
- `/reviews` - labs / questionnaires / refills / notes-to-sign queue.
- `/messages` - patient messages.

## Data

Currently renders **empty** - stat cards show 0 and tables/lists are empty -
until a data source is connected. Pages read from a typed data layer
(`useData`) that returns empty datasets, so a real OpenEMR FHIR integration can
replace it without touching the UI. That FHIR integration is planned
separately.

Run: `docker compose up -d --build doctor-dashboard`, then http://localhost:3003.

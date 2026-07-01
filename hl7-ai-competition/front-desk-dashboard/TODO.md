# TODO

- [ ] Integrate OpenEMR FHIR into Front Desk Dashboard

  Replace the stubbed `EMPTY_API` provider in `src/lib/store.tsx` with a real
  OpenEMR FHIR (R4) data source, mapping FHIR resources onto `src/lib/types.ts`.
  Notes from scoping:
  - Extend the OAuth2 scopes in `scripts/bootstrap-fhir.sh` to cover Task,
    Appointment, and Practitioner (the current token only grants
    Patient/Observation/Encounter/Condition), then re-mint the token.
  - Seed FHIR Task/Appointment data in OpenEMR; the queue renders empty without it.
  - Fetch server-side so the bearer token stays off the browser (architecture TBD).

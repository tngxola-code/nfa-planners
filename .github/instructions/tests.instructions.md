# Testing Instructions

Every production change should consider:

- happy path
- failure path
- boundary conditions
- regression risk
- deterministic behaviour
- date and timezone behaviour where applicable

## Opportunity Intelligence

Test:

- duplicate source records
- changed source records
- expired opportunities
- closing-date boundaries
- compulsory briefing dates
- failed notifications
- retry behaviour
- source traceability
- idempotent ingestion

## Console

Test:

- route rendering
- navigation
- loading states
- empty states
- error states
- deep links
- authentication redirects
- returnTo behaviour
- keyboard accessibility

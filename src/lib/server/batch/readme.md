# Batch writes (sprint 038-CL)

The engine behind `POST /api/notes/batch` (200 items) and `POST /api/time-entries/batch` (500 items),
used by `chronolog import`.

- `run-batch.ts`: `readBatchBody` checks `{ items, atomic? }` and the item limit (400 `too_many_items`);
  `runBatch` runs a route's item processor over the items and builds
  `{ results: [{ index, ok, id?, updatedAt?, error?, code? }], created, updated, failed }`.
  Without `atomic` each item stands alone and calls the usual query functions. With `atomic` every
  item runs in one transaction; the first `BatchItemError` rolls it back and the other items report
  `batch_rolled_back`. Work for after the commit (the wiki-link index) is returned as `afterCommit`.
- `batch-test-fixture.ts`: `qa-038-*` users, contracts, a deliverable and work type, and a direct
  handler caller for the unit tests.

Item rules live next to the routes (`src/routes/api/notes/batch/note-batch-item.ts`,
`src/routes/api/time-entries/batch/entry-batch-item.ts`) and repeat the single routes' checks and
error codes. The transaction-bound writes are `queries/notes-batch.ts` and
`queries/time-entries-batch.ts`.

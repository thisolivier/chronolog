# Sprint 058-DR (API) — Shared search matcher, server side

**Status:** ready for review
**Branch:** `design-r1-search-api` (from `design-r1`) · **Worktree:** `.claude/worktrees/design-r1-search-api`
**Sources:** design r1 spec 07 SR-03 / SR-04, open items O08 / O09, source map
`docs/design/r1/source-map/06-07-notes-search-picker.md`. Groundwork for the 058-DR UI sprint: no
`.svelte` file changed, no schema change, no new dependency, CLI unchanged.

## What changed

- **One matcher** in `src/lib/server/search/` (README there): `record-matcher.ts` (pure),
  `search-candidates.ts` (load and decrypt once per request), `search-excerpts.ts`.
  `searchEverythingForUser` (`GET /api/search`) and `searchNotesForUser` (`GET /api/notes/search`,
  the editor `[[` picker and `WikiLinkInput`) both call it; `rankNoteMatch` is gone.
- **Query:** trim, NFC, lower-case, split on whitespace; every word must match some field (AND
  across words, OR across fields). No syntax, no implicit scope.
- **Fields:** notes: ID, display title, markdown body, client name, short code, contract name.
  Entries: description, deliverable name, work type name, client name, short code, contract name.
  Deliverable and work type count as identity (context) for entries.
- **Ranks** (one scale, lower first; ties newest first, then ID):

  | Rank | Notes | Time entries |
  | --- | --- | --- |
  | 0 | phrase = note ID | — |
  | 1 | note ID starts with phrase | — |
  | 2 | every word in title | — |
  | 3 | note ID contains phrase | — |
  | 4 | own text plus client/contract | description plus identity |
  | 5 | every word in own text (body) | every word in description |
  | 6 | client/contract only | identity only |

- **Hit fields added** (nothing renamed or removed): every hit gets `clientColorIndex`, `rank`,
  `matchedContext` (identity fields that held words the text lacked). Note hits: `matchedIn` gains
  `'context'`. Entry hits: `matchedIn` (`description` | `context`), `deliverableName`,
  `workTypeName`. Picker results additionally get `matchedIn`, `titleMatches`, `snippet`
  (`rank`/`matchedIn` null on the empty-query recent list). Client type `NoteSearchResult` gains
  them as optional fields (the offline cache builds results without them).
- **Excerpts:** highlights cover every matched word (phrase merged into one range;
  `findMatchRanges`/`buildSearchSnippet` accept several needles). A context-only hit has no
  ranges: its snippet is the unhighlighted start of the body/description, not an invented excerpt.
- **Ordering:** each `/api/search` group was already in server order; notes now in shared rank,
  entries in shared rank (were newest first). `/search` (`search-interleave.ts`, not a component)
  now merges the two groups by `rank`, then recency, instead of re-sorting by date.
- **Limits:** `/api/search` `limit` per group, default 20, max raised 50 → 100 (at most 200 hits
  per response); `/search` still asks for 50. Picker default 10 → 8 (the editor already sent 8;
  `WikiLinkInput` sends none, so it now gets 8), max 50.
- **Recent notes (SR-04):** `GET /api/notes/search?q=&recent=1` already listed the newest notes
  across every contract (no scoping); kept and now covered by e2e. `WikiLinkInput` not fetching on
  an empty query is a UI gap for the UI sprint.

## Review fixes (2026-11-07, second pass)

1. **Performance.** The pure matcher moved to `src/lib/search/record-matcher.ts` (re-exported from
   `src/lib/server/search/`). ID, title, body and context are lower-cased once per candidate.
   Like the old code, the ID and title are checked first. The body sits behind a memoised
   `readContent()` and is only decrypted when a word is not in the ID or title, or for the
   returned excerpts. The picker's recent list (`[[` with an empty query) decrypts no body; its
   `snippet` is empty there (`firstLine`/`secondLine` still come from `content_json`, as before).
2. **Offline parity.** `searchCachedNotes` (read cache) and the queued outbox notes in
   `OfflineDataService.searchNotes` now use `parseSearchQuery`/`matchNote`/`rankCandidates`.
   Queued notes merge with the server or cache results by rank, then recency, instead of always
   going first; the limit applies after the merge.
3. **Highlight offsets.** `findMatchRanges` matches with an escaped, case-insensitive regex on
   the original text, so "İstanbul roles review" highlights "roles", not "oles ". Unit test added.
4. **Tests.** Realistic note IDs in the short-code test. Short-code queries hit `ID_PREFIX`
   (rank 1) for every note created under that client; this is documented in the module README.
   Tests added for lazy body reads and identity-over-content ordering. The e2e creates nine notes
   and asserts exactly 8 for the default picker limit (recent and query), and 9 with `limit=20`.
5. **Design decision: ranks 4 and 5 swapped.** Identity plus content (now 4) ranks above content
   alone (now 5). Naming the client is a deliberate signal: for "Hungryroot roles", Hungryroot's
   own roles notes beat a Rank Group note whose body mentions Hungryroot and roles. A one-word
   query cannot produce rank 4, so single-word ordering (ID, prefix, title, ID substring, body,
   identity only) is exactly as before.

## Compatibility

- CLI (`cli/commands/search.mjs`) reads `notes.hits[].id/clientShortCode/contractName/updatedAt/
  title/snippet`, `timeEntries.hits[].date/durationMinutes/clientShortCode/contractName/snippet/id`
  and the `total`s: all unchanged. A context-only note prints its body start without `»«`; entries
  may now appear in rank order rather than date order. `search-cli.e2e.test.ts` passes unchanged.
- Behaviour change: a multi-word query is no longer one substring ("Hungryroot roles" matches
  words anywhere); queries naming a client or contract now return that client's records.

## Tests (2026-11-07)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: `eslint .` with no output (clean)
- `npm test`: `Test Files 117 passed (117)` / `Tests 1130 passed (1130)` (first pass: 1127)
- `npm run test:e2e` (dev server from this worktree, `ALLOW_REGISTRATION=true`): `Test Files 23
  passed (23)` / `Tests 137 passed (137)` (baseline before the change: 22 files, 130 tests)
- New: `src/lib/server/search/record-matcher.test.ts` (15: SR-03 examples, AND semantics, ranks,
  tie-break, entries, excerpts), a multi-needle case in `search-snippet.test.ts`, the
  rank test ported in `notes.test.ts`, a rank-merge case in `search-interleave.test.ts`, and
  `src/e2e/search-shared-matcher.e2e.test.ts` (7: Amplitude, Hungryroot roles, note ID on both
  surfaces, identical order from both endpoints, CLI fields, recent notes global, empty query).
  `authPatch` added to `src/e2e/helpers.ts`; the new e2e archives its two clients afterwards so it
  does not use up the active client colours `clients.e2e.test.ts` counts.
- Playwright not run (no UI change).

## Follow-ups

- UI sprint: render `matchedContext` as the reason on context hits, use `clientColorIndex` instead
  of the extra `/api/clients` fetch, show picker identity rows, recent notes in `WikiLinkInput`,
  stale-response guard.
- Caching: every picker keystroke still decrypts every note's title and `content_json` (as before
  058), plus bodies when a word is not in an ID or title. A per-user, short-TTL decrypted
  candidate cache (invalidated on note/client/contract writes) would cut this; not needed at a
  few thousand records.
- Still open from O08: ambiguous short words (one word matching many contracts), weights within a
  rank (e.g. title phrase above title words), and whether deliverable/work type should rank as
  content for entries.
- Highlights use the regex's simple case folding while matching uses `toLowerCase`. A query that
  grows when lower-cased (e.g. "İstanbul") can match without being highlighted; it no longer
  shifts the highlight.
- `OfflineDataService.searchNotes` queued-note merge has no unit test (the service needs heavy
  setup); `searchCachedNotes` is covered.
- CLI changelog/readme could mention the new matching when the CLI next ships.

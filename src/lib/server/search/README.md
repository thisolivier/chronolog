# Search matcher (sprint 058-DR)

One query interpretation, one matching rule and one rank scale for every search surface
(design r1 SR-03, open item O08):

- `GET /api/search` (`db/queries/global-search.ts`): notes and time entries, `/search` and
  `chronolog search`.
- `GET /api/notes/search` (`db/queries/note-search.ts`): the `[[` wiki-link picker in the editor
  and the time entry description's link input. Notes only: notes are the only link target (O09).

Every searched column is encrypted at rest, so candidates are loaded and decrypted once per
request and matched in memory. Never filter them with SQL `ILIKE`; it would only see ciphertext.

## Files

- **record-matcher.ts** — pure. `parseSearchQuery`, `matchNote`, `matchTimeEntry`,
  `rankCandidates`, `SEARCH_RANK`, `highlightNeedles`.
- **search-candidates.ts** — `loadNoteCandidates(userId)` (non-trashed notes) and
  `loadTimeEntryCandidates(userId)` (with deliverable and work type names), decrypted, each with its
  client/contract identity and `clientColorIndex`; recency keys; `hitContextOf`.
- **search-excerpts.ts** — `noteExcerpt` (title highlights, body snippet) and `timeEntryExcerpt`,
  built on `$lib/utils/search-snippet.ts`.

## Algorithm

1. **Query.** Trim, NFC-normalise, lower-case, collapse whitespace into the *phrase*; split it on
   spaces into distinct *words*. No filter syntax, no implicit scope (no current note, sidebar or
   timer contract restriction).
2. **Fields.** Content (the record's own text): a note's ID, display title and markdown body; an
   entry's description. Context (identity): client name, client short code, contract name; for an
   entry also deliverable and work type names.
3. **Match.** Every word must be a case-insensitive substring of at least one field (AND across
   words, OR across fields). Otherwise the record is not a hit.
4. **Rank** (lower first; one scale, so notes and entries can be merged):

   | Rank | Name | Notes | Time entries |
   | --- | --- | --- | --- |
   | 0 | `ID_EXACT` | the phrase is the note ID | — |
   | 1 | `ID_PREFIX` | the note ID starts with the phrase | — |
   | 2 | `TITLE` | every word in the title | — |
   | 3 | `ID_CONTAINS` | the note ID contains the phrase | — |
   | 4 | `CONTENT` | every word in ID, title or body (in practice: body) | every word in the description |
   | 5 | `CONTENT_AND_CONTEXT` | some words only in identity, the rest in content | same |
   | 6 | `CONTEXT_ONLY` | no word in the note's own text | no word in the description |

   Ranks 0 to 4 are the pre-058 note order (exact ID, ID prefix, title, ID substring, body).
5. **Ties.** Newest first (a note by `updatedAt`; an entry by date, start time — none is the start
   of the day — then creation), then ID ascending, so the order is total and identical on every
   surface for the same candidate type and query.

## Hit fields

Every hit carries `clientId`, `clientName`, `clientShortCode`, `clientColorIndex`, `contractId`,
`contractName`, plus:

- `rank` (above), `matchedIn` (`id` | `title` | `body` for notes, `description` for entries, or
  `context`), and `matchedContext`: the identity fields that held words the record's own text did
  not (empty for ranks 0 to 4). That is the "reason" for a metadata match.
- `titleMatches` (notes) and `snippet: { text, matches }`: the excerpt around the first matched
  word, with every matched word's range (the whole phrase merges into one range). A
  context-only hit has no ranges anywhere: its snippet is the unhighlighted start of the body or
  description, never an invented excerpt.

## Limits

- `/api/search`: `limit` per group, default 20, at most 100; `total` counts every match; queries
  under 2 characters return nothing.
- `/api/notes/search`: `limit` default 8, at most 50; an empty `q` with `recent=1` lists the most
  recently edited notes across every contract (`rank` and `matchedIn` are null there).

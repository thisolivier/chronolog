# Notes API Routes

API routes for CRUD operations on notes. All routes require authentication.

## Trash (sprint 037-CL)

`DELETE` moves a note to a server-side trash (`notes.deleted_at`). The row keeps its ID, its
`note_links` in both directions and its `note_time_entries`, so `POST …/restore` brings everything
back with one `deleted_at = null`. Every read that lists, searches, titles, previews or resolves notes
skips trashed rows (`notInTrash` in `queries/notes.ts`; `includeDeleted` where a caller needs them).
Each delete also hard-deletes the caller's notes trashed more than 30 days ago, in the same
transaction (`queries/note-trash.ts`; the foreign keys cascade to links, time-entry links and
attachments). There is no scheduler; `scripts/purge-note-trash.mjs` purges every user's expired
trash by hand. A trashed note cannot be changed (`PUT`/`PATCH` 404) until it is restored.

## Note ID Format

Notes use human-readable IDs in the format: `CLIENT_SHORT_CODE.YYYYMMDD.SEQ`

Example: `BIGCH.20260207.001`

- `CLIENT_SHORT_CODE`: The parent client's short code
- `YYYYMMDD`: Creation date in the creator's timezone (`X-Timezone` header or `?tz=`, the same source as `GET /api/me`; the browser and the CLI both send the header; default the server's zone)
- `SEQ`: Zero-padded sequence number (001, 002, etc.)

The ID is auto-generated when creating a note. It is allocated and inserted in one transaction holding `pg_advisory_xact_lock` on the `SHORTCODE.YYYYMMDD.` prefix, so parallel creates queue briefly and never collide (sprint 029-CL). Sequences above 999 keep counting (`.1000`).

## Routes

### `GET /api/notes[?contractId=X | ?clientId=X][&updatedSince=ISO-8601]`

Lists the user's notes. At least one filter is required (400 `bad_request` otherwise).

**Query Parameters:**
- `contractId` (optional): only this contract's notes. Must be a UUID (400 `invalid_contract`).
- `clientId` (optional, sprint 039-CL): the notes of every contract of this client, archived contracts included (the app's client view). Must be a UUID (400 `invalid_client`); another user's client lists nothing.
- `updatedSince` (optional): only notes changed after this ISO 8601 date or date-time (400 `invalid_date` if unparseable). Used for incremental sync; the CLI's `chronolog notes --since` sends it.

**Response:** each note has `id`, `contractId`, `title`, `displayTitle`, `firstLine`, `secondLine`, `isPinned`, `pinnedAt`, `createdAt` and `updatedAt`. No body content is returned.

- `displayTitle` is the stored title, else the first line of the body, else `null`.
- `firstLine` and `secondLine` are preview lines. Notes created over the API have no TipTap JSON, so their preview is taken from the markdown `content`.

```json
{
  "notes": [
    {
      "id": "BIGCH.20260207.001",
      "contractId": "uuid",
      "title": "Meeting Notes",
      "displayTitle": "Meeting Notes",
      "isPinned": false,
      "createdAt": "2026-02-07T10:00:00Z",
      "updatedAt": "2026-02-07T10:00:00Z",
      "firstLine": "Agenda",
      "secondLine": "Budget review"
    }
  ]
}
```

Pinned notes come first, most recently pinned on top (`pinnedAt` descending), then the rest by `updatedAt` (descending).

### `POST /api/notes`

Creates a new note with an auto-generated ID.

**Request Body:**
```json
{
  "contractId": "uuid",
  "title": "Meeting Notes",
  "content": "# Markdown content here",
  "contentJson": "{\"type\":\"doc\",\"content\":[...]}"
}
```

- `contractId` (required): The contract this note belongs to. A contract that is not the caller's is `403 contract_forbidden`; a body that is not a JSON object is `400 invalid_json`.
- `title` (optional): Note title
- `content` (optional): Markdown content
- `contentJson` (optional): TipTap JSON for rich text rendering
- `createdAt` (optional, sprint 034-CL): `YYYY-MM-DD` to backdate the note. The ID carries that date and `created_at` is noon of that day in the caller's timezone (`X-Timezone` / `?tz=`); `updatedAt` is now. Today is the same as leaving it out; a future day or a non-calendar value is `400 invalid_date`. The creation date cannot be changed later (the ID would have to change).
- `clientRequestId` (optional, sprint 045-CL): the caller's own ID for the note (1-100 of `A-Z a-z 0-9 . _ : -`, else `400 invalid_client_request_id`). A second create with the same `clientRequestId` answers `200` with the note the first one made, unchanged, instead of a new note (`201`). The browser's offline outbox sends its temp ID; without it (the CLI) every POST creates. Stored in `notes.client_request_id`, unique per user (migration 0011), and returned on the note and in `GET /api/notes` rows when set. `POST /api/time-entries` takes the same field (also returned on week entries).
- `wordCount` is counted from `contentJson` when given, else from the markdown `content` (sprint 037-CL; before, a markdown-only note stored 0). The markdown's `[[id]]` wiki-links are indexed for backlinks, as on `PUT`.

**Response:**
```json
{
  "note": {
    "id": "BIGCH.20260207.001",
    "title": "Meeting Notes",
    "contractId": "uuid",
    "content": "# Markdown content here",
    "contentJson": "{...}",
    "wordCount": 150,
    "isPinned": false,
    "createdAt": "2026-02-07T10:00:00Z",
    "updatedAt": "2026-02-07T10:00:00Z"
  }
}
```

### `GET /api/notes/[noteId]`

Retrieves a single note with full content. The caller's note in the trash is 404 `note_in_trash` (the CLI points at `note restore`); anything else not found is a plain 404.

**Response:**
```json
{
  "note": {
    "id": "BIGCH.20260207.001",
    "title": "Meeting Notes",
    "contractId": "uuid",
    "content": "# Markdown content here",
    "contentJson": "{...}",
    "wordCount": 150,
    "isPinned": false,
    "createdAt": "2026-02-07T10:00:00Z",
    "updatedAt": "2026-02-07T10:00:00Z"
  }
}
```

### `GET /api/notes/search?q=&exclude=&limit=&recent=1`

Ranked search across all of the user's notes, used by the note list search and the wiki-link autocomplete. Matches are ranked: exact ID, ID prefix, title, ID substring, then body. Results are decrypted in memory (`src/lib/server/db/queries/note-search.ts`); encrypted columns are never matched with SQL `ILIKE`.

- `q`: search text. An empty `q` returns no results unless `recent=1`, which returns the most recently edited notes
- `exclude`: a note ID to leave out (the note being edited)
- `limit`: default 10, max 50

**Response:** `{ "notes": [{ id, title, displayTitle, contractId, contractName, clientId, clientName, clientShortCode, firstLine, secondLine, updatedAt }] }`

### `GET /api/notes/titles?ids=A,B,C`

Display titles for wiki-link rendering. IDs the user does not own are omitted; at most 100 IDs are read. Trashed notes are omitted unless `includeDeleted=1`, which adds `deletedAt` (null for a live note) to every entry; the browser's title cache always asks for it, so a link to a trashed note renders as "deleted" and offers a restore.

**Response:** `{ "titles": [{ "id", "displayTitle", "contractId", "clientId", "deletedAt"? }] }`

### `GET /api/notes/[noteId]/backlinks`

The caller's notes that link to this note; trashed sources are hidden (their link rows stay for a restore).

**Response:** `{ "backlinks": [{ "sourceNoteId", "headingAnchor", "noteTitle", "noteContractId", "noteClientId" }] }`. `noteTitle` is the display title (stored title, else first content line).

### `PUT /api/notes/[noteId]`

Updates a note's title and/or content.

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "# Updated markdown",
  "contentJson": "{...}",
  "contractId": "uuid",
  "expectedUpdatedAt": "2026-02-07T10:00:00Z"
}
```

All fields are optional - only provided fields will be updated.

`content` without `contentJson` (the CLI) clears `contentJson` and recounts `wordCount` from the markdown, so the editor reloads from the new markdown instead of the stale TipTap document; `"contentJson": null` also clears it. The browser sends both. A `contractId` moves the note (the ID keeps its prefix) and must be the caller's (`403 contract_forbidden`).

`expectedUpdatedAt` is the `updatedAt` the client last saw. When the note has changed since (for example, in another tab), the save is refused with `409` and `{ "error": "conflict", "updatedAt": "..." }`. The editor then halts autosave and offers Reload. Without the field, the save is unconditional.

**Response:**
```json
{
  "note": {
    "id": "BIGCH.20260207.001",
    "title": "Updated Title",
    "contractId": "uuid",
    "content": "# Updated markdown",
    "contentJson": "{...}",
    "wordCount": 150,
    "isPinned": false,
    "createdAt": "2026-02-07T10:00:00Z",
    "updatedAt": "2026-02-07T11:00:00Z"
  }
}
```

### `PATCH /api/notes/[noteId]`

Partial change for machine clients (sprint 034-CL): the same fields and rules as `PUT`, but `expectedUpdatedAt` is required (`400 expected_updated_at_required` without it), so a change is always based on the copy the caller read; a stale copy is `409 conflict`.

### `DELETE /api/notes/[noteId]`

Moves the note to the trash (see above) and purges the caller's trash older than 30 days. Another user's note, or one already in the trash, is 404 and untouched.

**Response:**
```json
{
  "success": true,
  "id": "BIGCH.20260207.001",
  "title": "Meeting Notes",
  "contractId": "uuid",
  "deletedAt": "2026-11-04T12:00:00.000Z",
  "purgeAt": "2026-12-04T12:00:00.000Z"
}
```

### `POST /api/notes/[noteId]/restore`

Takes the caller's note out of the trash with its ID, links and time-entry links. 404 `not_in_trash` when it is not the caller's or not in the trash. A restore onto an archived contract is allowed; `contract.archived` reports it.

**Response:** `{ "note": { …the full note… }, "contract": { "id", "name", "clientShortCode", "archived", "isSystem" } }`

### `PUT /api/notes/[noteId]/pin` (sprint 039-CL)

Body `{ "pinned": true | false }`. Pins or unpins the caller's note. A dedicated route rather than a `PATCH` field: `PATCH` requires `expectedUpdatedAt` and bumps `updatedAt`, while pinning is not an edit and must not make an open editor's next autosave a 409. `updatedAt` does not change; pinning a pinned note keeps its first `pinnedAt`. 400 `bad_request` when `pinned` is not a boolean; 404 `note_not_found` for another user's note or one in the trash.

**Response:** `{ "note": { "id", "contractId", "isPinned", "pinnedAt" } }`

### `GET /api/notes/trash`

The caller's trash, most recently deleted first: `{ "notes": [{ "id", "title", "contractId", "contract", "deletedAt", "purgeAt" }] }` (`contract` is `SHORTCODE/Contract name`).

## Attachment Routes

### `POST /api/notes/[noteId]/attachments`

Uploads a file attachment to a note. Accepts `multipart/form-data` with a `file` field.

- Max file size: 10 MB (400 `File exceeds maximum size of 10 MB`)
- Allowed types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml, application/pdf
- The type is read from the file's first bytes (`attachments/file-type.ts`, sprint 036): it must be one of the
  allowed types and agree with the declared one (an empty or `application/octet-stream` declaration takes the
  sniffed type). A `.txt`, or a PDF renamed `.png`, is a 400 `File type "…" is not allowed…`. The stored
  `mimeType` is the sniffed one.
- In production, adapter-node's `BODY_SIZE_LIMIT` is set to `11M` in the Dockerfile (the default 512 KB
  would refuse most PDFs before the route sees them).

**Response:**
```json
{
  "attachment": {
    "id": "uuid",
    "filename": "screenshot.png",
    "mimeType": "image/png",
    "sizeBytes": 102400,
    "createdAt": "2026-02-07T10:00:00Z"
  }
}
```

### `GET /api/notes/[noteId]/attachments`

Lists all attachments for a note (metadata only, no binary data).

### `GET /api/attachments/[attachmentId]`

Serves the attachment binary data with correct `Content-Type` header, `inline` with an ASCII
`filename` and the RFC 5987 `filename*` (so a PDF opens in the browser's viewer), `X-Content-Type-Options:
nosniff`, and `X-Note-Id` (the note it belongs to; the CLI reads it with `HEAD` before a delete). Responses are `Cache-Control: private, max-age=31536000, immutable`, so decrypted bytes are never stored in a shared cache. A non-UUID ID returns `404`.

### `DELETE /api/attachments/[attachmentId]`

Deletes an attachment. Verifies ownership chain (attachment -> note -> user).

## Error Responses

All routes return standard HTTP error codes:

- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Missing required parameters or invalid file type/size
- `404 Not Found`: Note or attachment not found, or user doesn't have access
- `409 Conflict`: `PUT` with `expectedUpdatedAt` for a note that changed since (body includes `updatedAt`)
- `500 Internal Server Error`: Database or server error

## Implementation

- **Note queries**: `/src/lib/server/db/queries/notes.ts`
- **Note search**: `/src/lib/server/db/queries/note-search.ts`
- **Backlinks and link extraction**: `/src/lib/server/db/queries/note-links.ts`
- **Attachment queries**: `/src/lib/server/db/queries/attachments.ts`
- **Schema**: `/src/lib/server/db/schema/notes.ts`, `/src/lib/server/db/schema/attachments.ts`
- **Note routes**: `/src/routes/api/notes/`
- **Attachment routes**: `/src/routes/api/attachments/`

## Word Count Calculation

Word count is automatically calculated from the `contentJson` field when a note is created or updated. It counts words in text nodes within the TipTap document structure.

### `GET /api/notes/todos[?contractId=X][&all=1]` (sprint 040-CL)

Checkbox task items (`- [ ]` / `- [x]`, any depth) across the user's notes, read from each note's
decrypted markdown by `extractTaskItems` (`$lib/utils/task-items.ts`). The markdown is always current:
the editor saves it together with the TipTap JSON, and the CLI writes markdown only. Open items only
unless `all=1`; notes without matching items are left out; fenced code and trashed notes never count.
`contractId` must be a UUID (400 `invalid_contract`). Order as `GET /api/notes` (pinned, then newest).

```json
{ "notes": [{ "id": "ACME.20261104.001", "contractId": "uuid", "title": "Kickoff", "updatedAt": "…",
    "items": [{ "text": "Call Jane", "checked": false, "depth": 0, "line": 3 }] }],
  "openCount": 1, "doneCount": 0 }
```

`chronolog todos` is its client.

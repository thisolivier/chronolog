# Notes API Routes

API routes for CRUD operations on notes. All routes require authentication.

## Note ID Format

Notes use human-readable IDs in the format: `CLIENT_SHORT_CODE.YYYYMMDD.SEQ`

Example: `BIGCH.20260207.001`

- `CLIENT_SHORT_CODE`: The parent client's short code
- `YYYYMMDD`: Creation date in the creator's timezone (`X-Timezone` header or `?tz=`, the same source as `GET /api/me`; the browser and the CLI both send the header; default the server's zone)
- `SEQ`: Zero-padded sequence number (001, 002, etc.)

The ID is auto-generated when creating a note. It is allocated and inserted in one transaction holding `pg_advisory_xact_lock` on the `SHORTCODE.YYYYMMDD.` prefix, so parallel creates queue briefly and never collide (sprint 029-CL). Sequences above 999 keep counting (`.1000`).

## Routes

### `GET /api/notes[?contractId=X][&updatedSince=ISO-8601]`

Lists the user's notes. At least one filter is required (400 `bad_request` otherwise).

**Query Parameters:**
- `contractId` (optional): only this contract's notes. Must be a UUID (400 `invalid_contract`).
- `updatedSince` (optional): only notes changed after this ISO 8601 date or date-time (400 `invalid_date` if unparseable). Used for incremental sync; the CLI's `chronolog notes --since` sends it.

**Response:** each note has `id`, `contractId`, `title`, `displayTitle`, `firstLine`, `secondLine`, `isPinned`, `createdAt` and `updatedAt`. No body content is returned.

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

Notes are sorted by pinned status first, then by `updatedAt` (descending).

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

Retrieves a single note with full content.

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

Display titles for wiki-link rendering. IDs the user does not own are omitted; at most 100 IDs are read.

**Response:** `{ "titles": [{ "id", "displayTitle", "contractId", "clientId" }] }`

### `GET /api/notes/[noteId]/backlinks`

Notes that link to this note.

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

Deletes a note and its time entry links (another user's note is 404 and untouched).

**Response:**
```json
{
  "success": true,
  "id": "BIGCH.20260207.001",
  "title": "Meeting Notes",
  "contractId": "uuid"
}
```

## Attachment Routes

### `POST /api/notes/[noteId]/attachments`

Uploads a file attachment to a note. Accepts `multipart/form-data` with a `file` field.

- Max file size: 10 MB
- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml, application/pdf

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

Serves the attachment binary data with correct `Content-Type` header. Responses are `Cache-Control: private, max-age=31536000, immutable`, so decrypted bytes are never stored in a shared cache. A non-UUID ID returns `404`.

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

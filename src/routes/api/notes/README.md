# Notes API Routes

API routes for CRUD operations on notes. All routes require authentication.

## Note ID Format

Notes use human-readable IDs in the format: `CLIENT_SHORT_CODE.YYYYMMDD.SEQ`

Example: `BIGCH.20260207.001`

- `CLIENT_SHORT_CODE`: The parent client's short code
- `YYYYMMDD`: Creation date
- `SEQ`: Zero-padded sequence number (001, 002, etc.)

The ID is auto-generated when creating a note.

## Routes

### `GET /api/notes?contractId=X`

Lists notes for a specific contract.

**Query Parameters:**
- `contractId` (required): The contract UUID

**Response:**
```json
{
  "notes": [
    {
      "id": "BIGCH.20260207.001",
      "title": "Meeting Notes",
      "contractId": "uuid",
      "wordCount": 150,
      "isPinned": false,
      "createdAt": "2026-02-07T10:00:00Z",
      "updatedAt": "2026-02-07T10:00:00Z"
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

- `contractId` (required): The contract this note belongs to
- `title` (optional): Note title
- `content` (optional): Markdown content
- `contentJson` (optional): TipTap JSON for rich text rendering

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

### `PUT /api/notes/[noteId]`

Updates a note's title and/or content.

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "# Updated markdown",
  "contentJson": "{...}"
}
```

All fields are optional - only provided fields will be updated.

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

### `DELETE /api/notes/[noteId]`

Deletes a note and all associated time entry links.

**Response:**
```json
{
  "success": true
}
```

## Error Responses

All routes return standard HTTP error codes:

- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Missing required parameters
- `404 Not Found`: Note not found or user doesn't have access
- `500 Internal Server Error`: Database or server error

## Implementation

- **Queries**: `/src/lib/server/db/queries/notes.ts`
- **Schema**: `/src/lib/server/db/schema/notes.ts`
- **Routes**: `/src/routes/api/notes/`

## Word Count Calculation

Word count is automatically calculated from the `contentJson` field when a note is created or updated. It counts words in text nodes within the TipTap document structure.

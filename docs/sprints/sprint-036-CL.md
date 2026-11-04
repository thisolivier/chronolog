# Sprint 036 — CL: Attachments: PDFs, and the CLI

**Status:** in progress
**Branch:** `sprint-036-CL/attachments-pdf-cli` · **Worktree:** `.claude/worktrees/sprint-036-CL` · **Port:** 5214
**Sources:** owner request 2026-11-04; sprint 024 task 5 (attachment fix, `chronolog://attachment/<id>`), 028/031/034 (CLI, skill, confirm rule).

## Objective

Notes accept PDFs as well as images, the editor shows a non-image attachment as a link that opens it, and the CLI can list, add, fetch and delete attachments so the secretary can file a client's PDF beside the note. The CLI also gains a version and a changelog so a laptop session can tell what it has.

## Tasks

1. **API types.** `POST /api/notes/[noteId]/attachments` also accepts `application/pdf` (keep the 10 MB cap; sniff the magic bytes for PDF and the image types rather than trusting the declared type; reject with the existing 400 message). `GET /api/attachments/[id]` serves PDFs inline with the right `Content-Type` and the RFC 5987 filename from 024. List responses already carry `mimeType` and `sizeBytes`; make sure they do.
2. **Editor.** The Attach button and drag-and-drop accept PDFs. A PDF inserts as a link node `[filename.pdf](chronolog://attachment/<id>)` (not an image node). The link resolver treats `chronolog://attachment/` links the way `attachment-image.ts` treats image sources: clicking opens the decrypted file in a new tab through the blob URL. Markdown and PDF export (`note-export.ts`) render the link with the filename. `AttachmentList.svelte` shows a document icon and the size for non-images and opens them the same way.
3. **CLI.**
   - `chronolog note attach <note-id> <file> [--no-insert]`: multipart upload (Node `FormData` and `Blob`, no new dependency); by default appends `![name](chronolog://attachment/<id>)` for images or `[name](chronolog://attachment/<id>)` for PDFs on a new line via the 034 append path with `expectedUpdatedAt`; prints the id and the reference line.
   - `chronolog note attachments <note-id>`: id, filename, type, size, created.
   - `chronolog attachment get <id> [--out <path>]`: writes the file (default: the original filename in the current directory, refusing to overwrite without `--force`).
   - `chronolog attachment delete <id>`: confirmed per the 031 rule (`--yes` when no terminal); warns if the note's markdown still references it and leaves the reference alone.
   - `chronolog --version` prints the CLI version, and `chronolog me` includes the server's version. Add `cli/CHANGELOG.md` listing 028 through 036 by command, and bump the CLI version to `1.0.0` in `package.json` and wherever the CLI reads it. `GET /api/me` returns `serverVersion` from `package.json`.
4. **Skill.** "Filing a document" section (stay under 200 lines): attach the file the owner names, confirm which note, prefer attaching to the day's status note, never delete an attachment without the owner saying so in this conversation. Update the CLI readme and `docs/LAPTOP-SETUP.md` quick reference.
5. **Tests.** Unit: magic-byte sniffing (PNG, JPEG, PDF, and a PDF renamed `.png` rejected), export rendering of a PDF link. API e2e: attach a PNG and a PDF through the CLI, list, get (bytes match), delete with `--yes`, a 400 for a 10 MB + 1 file and for a `.txt`. Playwright: a PDF attached by the CLI shows in the editor as a link and in the attachment list with its size, and opens in a new tab.

## Boundaries

Owns `src/routes/api/notes/[noteId]/attachments/**`, `src/routes/api/attachments/**`, `src/routes/api/me/**` (serverVersion only), `src/lib/components/notes/extensions/**`, `AttachmentList.svelte`, `note-export.ts`, the Attach control in `NoteEditor.svelte`, `cli/**`, the skill, the docs named. Sprint 035 (desktop) may run in parallel and owns `src-tauri/**`, `src/lib/desktop/**` and the timer store; do not touch those. No schema change.

## Working rules

Worktree only. Dev server port 5214 with `BETTER_AUTH_URL=http://localhost:5214` and `ALLOW_REGISTRATION=true`; shared dev Postgres 127.0.0.1:5432, users `qa-036-*`, no reset, no seed. `npm run check` 0 errors, `npm test`, `npm run lint`, API e2e and Playwright green; rebase onto `main` before sign-off. Do not merge.

## Verification

Transcript in `docs/review/screenshots/sprint-036/transcript.md` of the CLI attaching a PNG and a PDF, plus screenshots of the editor showing the PDF link and the attachment list. Sign-off at the bottom with what was done, what was left, test counts.

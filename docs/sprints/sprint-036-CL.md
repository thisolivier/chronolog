# Sprint 036 — CL: Attachments: PDFs, and the CLI

**Status:** merged
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

## Sign-off

**2026-11-04, implemented on `sprint-036-CL/attachments-pdf-cli`, rebased onto `main` (`d0a6f60`). Status: ready for review, not merged.**

### What was done

1. **API types.** `src/routes/api/notes/[noteId]/attachments/file-type.ts` reads the first bytes: PNG, JPEG, GIF, WebP (RIFF…WEBP), PDF (`%PDF-`) and SVG (an `<svg` root after an optional prolog, comments, doctype). The bytes must be an allowed type and agree with the declared one (an empty or `application/octet-stream` declaration takes the sniffed type); the stored `mimeType` is the sniffed one. Refusals keep the existing 400 wording: `File type "text/plain" is not allowed. Allowed types: …`, and for a PDF renamed `.png`, `File type "image/png" is not allowed: the file's content is application/pdf. Allowed types: …`. The size check now runs before the bytes are read. `GET /api/attachments/[id]` already served `inline` with the RFC 5987 `filename*`; it now adds an ASCII `filename` fallback, `X-Content-Type-Options: nosniff` and `X-Note-Id` (used by the CLI's delete). List and upload responses carry `mimeType` and `sizeBytes` (they already did). `GET /api/me` returns `serverVersion` from `package.json`, now `1.0.0`.
   - **Addition (Dockerfile):** adapter-node refuses request bodies over 512 KB unless `BODY_SIZE_LIMIT` is set, and nothing set it, so in production most PDFs (and larger images) would have failed with 413 before reaching the route. The runtime image now sets `BODY_SIZE_LIMIT=11M` (10 MB plus multipart framing; the route's own 400 still applies at 10 MB). Needs a redeploy to take effect.
2. **Editor.** The Attach input and FileHandler already accepted PDFs and already inserted a link. The missing piece was that the Link mark dropped the `chronolog://` href on parse (unknown scheme), so a CLI-written `[x.pdf](chronolog://attachment/<id>)` rendered as plain text. `extensions/attachment-link.ts` exports `ATTACHMENT_LINK_PROTOCOLS` (passed to StarterKit's `link` options), `attachmentHrefFromTarget` and `openAttachment`: clicking an attachment link opens a tab inside the click (so popup blockers allow it) and points it at the resolver's blob URL, closing it if the fetch fails. An inserted PDF link is followed by an unlinked space so typing after it does not extend the link. Attachment links get a document icon in the editor CSS. Markdown export keeps `[filename](chronolog://…)`; PDF export (`note-print.ts`, where printing lives; `note-export.ts` only does markdown) replaces the link with the filename marked "(attached file)". `AttachmentList.svelte` shows image/document icons, the size, and the filename as a button that opens the file the same way.
   - **Addition (security):** a blob URL carries the app's origin, so opening an SVG attachment in a tab would run its scripts as Chronolog. `openAttachment` checks the blob's type and refuses SVG/HTML/XML; the list shows SVG names without the open button (they still render inside `<img>`, where scripts do not run).
3. **CLI** (`cli/commands/attachments.mjs`, `cli/lib/attachment-files.mjs`, `cli/lib/version.mjs`; `api.mjs` gained `upload`, `download`, `head`):
   - `note attach <note-id> <file> [--no-insert]` reads the note, uploads with Node's `FormData`/`Blob` (type from the extension; the server decides from the bytes), then appends `![name](chronolog://attachment/<id>)` for images or `[name](…)` otherwise through the 034 `patchNote` with the `updatedAt` it read (or `--expected-updated-at`). It prints the id and the line. On exit 7 the file stays attached and the message names the id and the line to append.
   - `note attachments <note-id>`: id, filename, type, size, created.
   - `attachment get <id> [--out <path>] [--force]`: the filename comes from `Content-Disposition` (RFC 5987 first), reduced to a bare name so a server value cannot escape the directory; `--out` may be a file or a directory; an existing file exits 2 without `--force` (written with `wx`).
   - `attachment delete <id> [--yes]`: `HEAD` for filename/type/size/note, then the note to count links to it; confirmed via `confirm.mjs` (exit 2 without `--yes` and no terminal); afterwards it warns when the note still links to it and leaves the text alone. Unknown ids exit 3.
   - `chronolog --version` prints `chronolog 1.0.0` (root `package.json`, read relative to the script so the `~/.local/bin` symlink works); `me` adds `Server <version> at <url>, CLI <version>` (`serverVersion`, `cliVersion` with `--json`). `cli/CHANGELOG.md` lists 028, 029, 031, 032, 034 and 036 by command (030, 033, 035 changed nothing in the CLI). `package.json` (and the lockfile's root entry, via `npm install --package-lock-only`) is `1.0.0`; the Tauri version is sprint 035's and was left alone.
4. **Skill and docs.** "Filing a document" in the secretary skill (199 lines): attach only the named file, confirm the note, prefer the day's status note, exit 7 handling, never delete an attachment without the owner saying so in this conversation; the description now triggers on attaching/filing documents. Updated `cli/readme.md` (attachments, version, module layout, exit codes), `docs/LAPTOP-SETUP.md` quick reference, `src/routes/api/notes/README.md` (sniffing, headers, BODY_SIZE_LIMIT), `extensions/README.md` and the notes components README.
5. **Tests.**
   - Unit: `file-type.test.ts` (7: each type sniffed, PNG/JPEG/PDF accepted, PDF renamed `.png` rejected, `.txt` rejected with the existing message, octet-stream falls back to the sniffed type); `extensions/attachment-link.test.ts` (7: a chronolog link survives parse and markdown save, is dropped without the protocol, click target lookup, the tab is pointed at the blob, closed on failure, an SVG is never opened, print renders the filename); `note-export.test.ts` (+1: markdown export keeps the PDF link with its filename); `cli/commands/attachments.test.mjs` (13).
   - API e2e `src/e2e/attachments-cli.e2e.test.ts` (7): `--version` and `me` versions; attach a PNG and a PDF through the CLI (lines appended, `note show` matches), `--no-insert`; list; get (bytes match, default name in the cwd, `--out` dir, refusal and `--force`); the server's inline PDF headers; delete refused without `--yes`, then deleted with the link warning and the note text untouched, then exit 3; 400s for 10 MB + 1, a `.txt` and a PDF renamed `.png`. Fixtures (a one-page PDF with a correct xref, a solid PNG) are generated by `src/e2e/attachment-fixtures.ts`.
   - Playwright `e2e-playwright/cli-attachments.spec.ts` (2 tests × chromium/webkit): a PDF attached by the CLI shows in the editor as a link (no image), in the list with the document icon and its size, and both the link and the list open it in a new tab (a blob URL holding the PDF; headless Chromium has no PDF viewer and turns that into a download of the blob, which the test checks byte for byte). The second test attaches a PDF through the Attach button and checks the link, that typing after it does not extend it, and the saved markdown.

### Verification

After the rebase: `npm run check` 0 errors (the 3 existing warnings in `src/routes/+layout.svelte`), `npm run lint` clean, `npm test` **805 passed in 76 files**, API e2e against `http://localhost:5214` **98 passed in 14 files**, Playwright **92 passed, 5 skipped** (chromium + webkit; the existing skips). The SVG guard came after the full Playwright run; the attachments spec was rerun after it (5 passed with auth setup) along with unit, lint and check.

Transcript: `docs/review/screenshots/sprint-036/transcript.md` (version, `me`, attach PNG and PDF, list, show, get ×3 with the overwrite refusal, `cmp` of both files, the three 400s, delete refused then done with the warning, exit 3 afterwards). Screenshots: `01-editor-pdf-link-and-attachment-list.png`, `02-attachment-list-row.png`.

### What was left, and notes

- **Note list preview shows raw link markdown.** A note whose first lines are attachment links previews as `[Statement of work.pdf](chronolo…` in the notes list (visible in screenshot 01). The preview extraction (`$lib/utils/extract-preview-lines`) is outside this sprint's boundary; it should strip link and image syntax to the text. Backlog item.
- **A link to a deleted attachment** stays in the text (as specified). Clicking it opens a tab that closes again; unlike images it gets no "missing" styling. A small follow-up could mark such links after a failed resolve.
- **Production needs a redeploy** for `BODY_SIZE_LIMIT`; until then uploads over 512 KB fail with 413 on `chronolog.throb.online`.
- Existing attachments keep the type they were stored with (the sniffing applies to new uploads only).
- QA users `qa-036-api-*`, `qa-036-pw-*` and `qa-036-transcript-*` remain in the shared dev DB, as in earlier sprints.

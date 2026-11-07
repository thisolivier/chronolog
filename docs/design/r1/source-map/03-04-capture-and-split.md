# Source map 03/04 · Time capture, completion, manual entry, ontology cascade, split feasibility

**Stage 1 (IN-02), read-only.** Branch `design-r1`, inspected 2026-11-07. Paths are relative to the repo root. Section (a) records facts only; recommendations are in (c) and are labelled.

## (a) What exists today

### 1. Timer model

**Two homes for one running timer.**
- **Server draft row.** A running or stopped timer with a contract is a `time_entries` row with `is_draft = true` (`src/lib/server/db/schema/time-entries.ts:26`). The row has `date` (`date`), `start_time`/`end_time` (Postgres `time`, no zone, `:22-23`), `duration_minutes` (integer, `:24`), `contract_id` NOT NULL (`:14`), deliverable, work type, encrypted `description`, `updated_at` and `client_request_id`. "Running" means `end_time` is null. "Stopped" means `end_time` is set and the row is still a draft. Only the route enforces one draft per user (409 in `src/routes/api/timer/start/+server.ts:21-24`). No DB constraint enforces it, and `getRunningTimer` takes the first draft row (`src/lib/server/db/queries/time-entries.ts:228-234`).
- **Browser pending timer.** A timer started with no contract lives only in `localStorage['chronolog.pending-timer']` as `{date, startTime, description, endTime?}` (`src/lib/components/timer/pending-timer.ts:6-16`). The widget creates the server draft, keeping the original local start, as soon as a contract is picked (`TimerWidget.svelte:96-101, 160-182, 198-212`). Start uses the sidebar's viewed contract in notes mode and never guesses one (`:275-293`).

**State lives in the component.** `TimerWidget.svelte:47-61` holds `timerState` (`idle | running | stopped`, no pause), `entryId`, `startTime`, `timerDate`, `endTime`, `elapsedSeconds`, `draftContractId` and `draftDescription` in local `$state`. The shared store `src/lib/stores/timer-state.svelte.ts` is display-only (status, elapsed, description, contract label, colour, short code). It feeds `TimerIndicator` and the Tauri menu bar (`:56-65`). The store does not drive the widget.

**Endpoints** (all through `DataService`, `src/lib/services/fetch-data-service.ts:218-257`):
- **`GET /api/timer/status`** returns the draft (running or stopped) or null (`status/+server.ts`).
- **`POST /api/timer/start`** takes `{contractId, date, startTime, confirmed:true}`. The browser always sends its local date and time with `confirmed` (`fetch-data-service.ts:224-237`).
- **`PATCH /api/timer`** moves the start of a running draft only. A stopped draft gets 409 `timer_stopped`. It also returns 400 for a future start (with 120 s slack) or a start more than 24 h ago, and 409 `start_overlaps_entry` unless confirmed (`api/timer/+server.ts:19-55`, `timer-start-rules.ts`, `start-guard.ts`). `moveRunningTimerStart` guards `is_draft AND end_time IS NULL` (`queries/timer-start.ts:32-51`).
- **`POST /api/timer/stop`** takes `{endTime: localTimeString()}` (`fetch-data-service.ts:247-249`). The server sets `end_time` and `duration_minutes = max(1, ceil(seconds/60))`, treating midnight as a day wrap (`queries/time-entries.ts:270-298`, `timer-duration.ts:21-28`).
- **`POST /api/timer/save`** sets contract, deliverable, work type, description and `isDraft:false`, plus an optional adjusted duration and range (`save/+server.ts`). It updates **by id and user only, with no `is_draft` guard** (`queries/time-entries.ts:195-216`).
- **`POST /api/timer/discard`** deletes **by id and user only, with no `is_draft` guard** (`discard/+server.ts:19`, `queries/time-entries.ts:219-226`).
- **`PUT /api/time-entries/:id`** also accepts a draft. The widget uses it for a running draft's contract (immediately, errors swallowed) and description (1.5 s debounce, flushed on Stop) (`TimerWidget.svelte:208, 236-251, 331-341`). PUT can set `startTime`/`endTime` without recomputing `durationMinutes` (`[id]/+server.ts:77-78`).

**Across reload or remount.** On mount, `checkExistingTimer` reads the status. A server draft wins and clears any pending timer. Otherwise the widget restores the pending timer (`TimerWidget.svelte:104-149`). The tick recomputes from the start date and time every second (`:190-196`).

**Across devices.** A device reads the status only on mount. Nothing polls or pushes. A pending timer is per browser.

**Offline.** `OfflineDataService` queues only entry create, update and delete (`src/lib/offline/offline-data-service.ts:330-400`, readme lines 16-17). Timer start, stop, adjust, save and discard are not queued. An offline start with no draft falls back to the pending timer (`TimerWidget.svelte:171-175`). An offline Stop of a server draft shows "Failed to stop timer" and the timer **keeps running** (`:352-354`). An offline Save of a pending timer goes through `createTimeEntry`, which is queued with a `clientRequestId` (`:363-378`).

**Stop and the "stopped but unfinished" state.** This state exists today. Stop freezes the end at once:
- For a server draft, `end_time` is written to the server row at Stop (`TimerWidget.svelte:343-351`).
- For a pending timer, `endTime = localTimeString()` is written to localStorage (`:321-328`).

The completion form then opens in place of the running controls. The draft stays in that state across reloads until Save or Discard.

**Discard.** With an `entryId`, Discard calls `POST /api/timer/discard`, which **hard-deletes** the row; errors are ignored. It then always calls `resetTimer()`, which clears local state and the pending timer (`:386-412`). Discard has no confirmation.

### 2. Completion form (`src/lib/components/timer/TimerCompletionForm.svelte`)

- **Header.** "Timer stopped: save or discard this entry" (`:108`).
- **Fields, in order:**
  - Description: textarea, plain text, not `WikiLinkInput` (`:110-122`).
  - Contract: native `<select>` (`:124-135`).
  - Deliverable: always rendered (`:137-148`).
  - Work type: wrapped in `class:hidden` until the deliverable has work types, so it **pops in and out** (`:150-161`).
  - Time: `DurationField` (`:163-174`).
- **Buttons.** Discard, then Save. Save reads "Saving…" while saving and "Retry" after an error (`:180-196`).
- **Required fields.** Contract is required: "Pick a contract" appears under the field with a red border (`:70, 134`). Time is validated only if its text changed from the measured text (`:72-75`). Deliverable and work type are optional.
- **Errors.** Field errors use `role="alert"` under the field. A save error goes in a red box above the buttons, with server text extracted by `describeSaveError` (`save-error.ts`).
- **Keyboard.** Enter without Shift in the description or time field saves (`:99-104`). The form has no Escape handling.
- **End time freeze (TC-04).** The end is frozen at Stop. An untouched Time field sends no duration, so the server keeps the stop-time `start_time`/`end_time`/`duration_minutes` (`:77-87`, `save/+server.ts:37-45`). An edited duration-only value sets start and end to **null**. An edited range sets both times as `HH:MM:00`.
- **Midnight in the time text.** The measured text is the range `HH:MM-HH:MM` (`formatDurationInput`, `duration.ts:190-198`). If the user edits a midnight-crossing range, the parser rejects it ("end must be after start").
- **Local copy.** The form keeps its own copy of every value (`:31-41`). Deliverable, work type, time text and **description edits made in the form are not persisted anywhere** until Save. A remount loses them.
- **Save.** A server draft goes to `saveTimer`. A pending timer goes to `createTimeEntry`, dated the timer's start date (`TimerWidget.svelte:358-384`). Both paths then dispatch `time-entry-saved` and call `navigation.showTimeEntryDay(date)`.
- **Add note / Attach note (sprint 049).** Only the **running** state has it. The `AttachNoteButton` icon (tooltip "Attach a new note") shows only once a contract is chosen (`TimerWidget.svelte:477-479`). It creates a note under `draftContractId` and appends `[[id]]` through `appendWikiLinkToDescription` (`weekly/attach-note.ts:16-28`). It saves the description immediately, by PUT for a draft or to localStorage for a pending timer, then calls `navigation.openNote(..., {focusEditor:'new-note'})` (`:257-273`). It does not start another timer. The completion form has no Add note.
- **Link reconciliation gap.** `POST /api/timer/save` does **not** reconcile wiki links into `note_time_entries`. Only `POST`/`PUT /api/time-entries` and batch do (`time-entries/+server.ts:108-114`, `[id]/+server.ts:101-120`). A `[[link]]` typed into the completion form of a server draft is saved as text but is not linked.

### 3. Ontology cascade

The cascade is **shared components, with the reset logic copied into each host.**
- **`ContractSelect.svelte`.** Loads `getContracts()` once per mount; the list excludes archived contracts. On failure the list is empty, with no message; the comment says the form reports the missing contract on submit (`:31-38`). The select is disabled until loaded.
- **`DeliverableSelect.svelte`.** Loads `getDeliverables(contractId)` when the contract changes. A failure sets an empty list (`:35-39`). With `alwaysRender`, the disabled placeholder reads "Pick a contract first", "Loading..." or "No deliverables" (`:74-79`). **A load failure and an empty set both read "No deliverables".** An explicit "No deliverable" option exists (`:69`).
- **`WorkTypeSelect.svelte`.** Loads by deliverable. A failure gives an empty list. The select is **not rendered** when the list is empty (`:82`), and hosts hide the label through `bind:hasWorkTypes`. A deliverable change clears the work type immediately (sprint 032, `:47-63`), and an invalid selection is dropped after load (`:40-44`).
- **Parent change in hosts.** A contract change unconditionally clears deliverable and work type (`TimerCompletionForm.svelte:48-60`, `AddTimeEntryModal.svelte:49-57`, `NewEntryRow.svelte:58-65`). Deliverables belong to one contract, so nothing valid is lost. The sprint 030 visible reset is tested in `e2e-playwright/timesheet-polish.spec.ts:150`.
- **Inline card editor.** `TimeEntryCard.svelte:227-245` saves each pick immediately. A contract change sends `deliverableId:null, workTypeId:null`, reopens the deliverable picker and shows a "contractChangeNotice". `deliverable-cache.ts` decides whether to show "Add deliverable…".
- **Sole-option auto-selection does not exist.** Grep finds no `length === 1` or "only option" logic.
- **Server rule.** Every write path runs `entryReferenceProblem`/`assertEntryReferences`, which returns 403 `contract_forbidden`, 400 `deliverable_mismatch` or 400 `work_type_mismatch` (`time-entries/entry-input.ts:46-59`).
- **Controls.** All options are native `<select>` elements. No anchored or overlay lists exist.

### 4. Manual Add Time Entry modal (`AddTimeEntryModal.svelte`)

- **Fields.** Date (`type=date`, defaults to the viewed day or today), Description (autofocused), Contract (the viewed contract in notes mode), Deliverable, Work type (hidden when empty) and Time (`:126-205`).
- **Buttons.** Cancel, then Save, with "Saving…" and "Retry" states (`:212-228`).
- **Validation.** "Pick a date", "Pick a contract" and the parser error (`:64-71`).
- **Payload.** Sends `durationMinutes`, plus `startTime`/`endTime` for a range (`:75-87`).
- **Escape.** A window keydown closes the modal unconditionally, even while a native select is open (`:100-102`).
- **Backdrop.** A click closes it, with no dirty check (`:96-98`).
- **Enter.** Enter without Shift in the description or time field saves (`:105-110`).
- **Layout.** A `fixed inset-0 p-4` centred card with `max-h-full overflow-y-auto` (`:115-121`). No `visualViewport` or keyboard handling exists anywhere in `src/`.
- **Running timer.** The modal never touches a running timer. The idle widget opens it (`TimerWidget.svelte:437-441`).

**One duration parser (sprint 025).** `src/lib/utils/duration.ts` is used by every form and by the server's `readDurationFields`/`validateDurationMinutes`.
- Accepted: `1.5`, `1,5`, `2h`, `1:30`, `2h30m`, `90`, `90m`, and ranges `9-10:30` or `09:00–11:15`.
- Rejected: empty, 0, more than 24 h, and a range whose end is not after its start, so midnight-crossing ranges are rejected.
- Warning: more than 12 h.
- Precision: ranges resolve to whole minutes (`HH:MM:00`) and durations are integer minutes.
- `DurationField.svelte` shows a "= 1h 30m" preview, the warning and the error.

### 5. Phone capture

- **Breakpoints.** `AppShell.svelte:66-91`: below 768 px is mobile (a separate DOM branch), 768–1023 is tablet, 1024 and up is desktop. Tablet and desktop share one branch.
- **Where the timer shows on a phone:**
  - Mobile shows one panel per level. The sidebar's `TimerWidget` appears only at level 0.
  - In the timesheet (`TimeEntriesPanel.svelte:187, 560-565`), a `placement="footer"` widget renders whenever no sidebar widget is mounted (`timer-widget-registry.svelte.ts`).
  - On note levels 1 and 2 there is no widget. The header `TimerIndicator` shows only while **running**, and tapping it calls `navigateMobile(0)` (`AppShell.svelte:183-191`, `TimerIndicator.svelte:24`).
  - A **stopped** timer has no header affordance on a phone. "Timer stopped: save entry" appears only on desktop with a collapsed sidebar (`TimerIndicator.svelte:28-30, 58-72`).
- **Remounts.** Moving between levels, or across 768 px, unmounts and remounts the widget. Running state survives through the server or localStorage. **Completion-form edits do not.**
- **Desktop collapse.** It sets the sidebar width to 0 but keeps the widget mounted (`AppShell.svelte:246-257`), so form state survives.
- **Tests.** `iphone-journeys.spec.ts:89` covers start, adjust, stop and discard on an iPhone.

### 6. Split feasibility (SP-01..SP-08), against the actual layer

- **No split operation exists.** No endpoint or client code creates one entry and advances the draft together.
- **Transactions exist.** `database.transaction` is in use (`server/batch/run-batch.ts:140`, `queries/notes.ts:207`, `safe-deletion.ts`). Creates are idempotent through `clientRequestId` (`queries/time-entries.ts:173-193`).
- **Running server draft, split at boundary B:**
  - "Save left" means inserting a non-draft entry for `start..B` with the left content.
  - "Advance source" means setting the draft's `date`/`start_time` to B.
  - Today's nearest pieces are `POST /api/time-entries` plus `PATCH /api/timer`. That is two requests. PATCH refuses a stopped draft and re-runs the overlap check. B equal to the left end is not an overlap, because `entryEnd > runStart` in `timer-start-rules.ts:75`.
  - If the left save succeeds and the advance fails, the left interval is **double-counted**: the saved entry plus a draft still starting at the original start. If the order is reversed, the left interval is lost.
  - A new endpoint (e.g. `POST /api/timer/split`) inside one transaction would be needed to meet SP-08.
- **Stopped server draft:**
  - The start cannot move through PATCH (409 `timer_stopped`).
  - PUT can set `start_time`, but `duration_minutes` is not recomputed. Only `stopTimer` derives a duration.
  - **Resume** (SP-05) of a stopped draft has no API. Nothing clears `end_time`.
- **Contract NOT NULL on the draft.** If the contract-bearing original content moves to the left (no Flip), the right remainder starts blank, contract included. A blank remainder can't stay a server draft. It would have to become a pending browser timer starting at B, the same model Start already uses. A Flipped split leaves the draft holding the original content, which works with the row.
- **Pending timer source.** The left save is `createTimeEntry`, which is idempotent and offline-queueable. The advance is a localStorage rewrite. The two writes are not atomic across server and browser.
- **Offline.** Timer endpoints are not queued, so a server-draft split offline would fail like Stop does today.
- **Precision:**
  - The timer stores seconds (`HH:MM:SS`, browser clock).
  - Typed ranges are minutes.
  - Durations are integer minutes, rounded **up**, minimum 1. Splitting one run in two can add up to 1 minute in total.
  - A part under 60 s is stored as 1 min by the stop path, but the parser rejects 0.
- **Timezone.** Every time is the browser's local wall clock, sent as strings; the server's local clock is the fallback (`queries/time-entries.ts:237-268`). The start checks use the `X-Timezone` header (`start-guard.ts:31-33`).
- **DST.** The client's elapsed time uses real elapsed time from a local `Date` (`timer-api.ts:9-29`). The server's duration uses the time-of-day difference. Across a DST change the two disagree by an hour.
- **Midnight (sprint 030).**
  - The entry is dated its **start date**. `end_time` earlier than `start_time` means the next day. The duration wraps once, so the maximum is 24 h.
  - `TimerStartField` shows a date input when the start date is not today (`TimerStartField.svelte:35`).
  - A split boundary after midnight would put the right remainder's `date` on the next day. PATCH supports that `date`.

## (b) Gaps between today and the spec

| Req | Today | Gap |
| --- | --- | --- |
| TC-01 | Start before a contract is supported; editable start, contract and description are present; Attach note appears once a contract exists. | Mostly met. The label is the icon "Attach a new note", not "Add note". |
| TC-02 | Clock, Stop, then a "Contract" select. The header pill has a pulse dot on the **left** of the clock (`TimerIndicator.svelte:39-40`). | Contract-first identity, top-right dot, motif graphic and a separate change affordance are all new. The desktop sidebar has no collapse chevron; collapse is whole-sidebar. |
| TC-03 | Creates and links a note under the timer contract, then navigates (`TimerWidget.svelte:257-273`). | Met for running. Not offered in completion. Completion-form links are not reconciled on timer save (§a2). |
| TC-04 | End frozen at Stop on the server or in localStorage. | Met. Field positions are not stable: Work type is hidden and shown, and Deliverable reads "Loading...". Stop offline fails for a server draft. |
| TC-05 | Contract change clears children; a deliverable change clears the work type. | No sole-option auto-select. Failure is indistinguishable from empty. Work type has no "pending/not applicable" placeholder and is hidden instead. Native selects, no anchored overlay lists. |
| TC-06 | Save/Discard labels match. Stopped state survives reload through the server row. | Form edits (deliverable, work type, time, description) are lost on remount, phone level change or the 768 px crossing. Phone has no "Finish entry" affordance. Desktop collapsed reads "Timer stopped: save entry". |
| TC-07 | None. | Split icon and the split flow are new. |
| TC-08 | Phone: sidebar widget at level 0, footer widget in the timesheet, running-only header pill. | No focused capture surface and no Back-to-origin. Actions are not kept above the keyboard. |
| TC-09 | Fields, Cancel/Save and the shared parser are as described. | Escape and backdrop discard silently. No keyboard-aware fitting. Styling is not shared with completion beyond the same components. |
| SP-01 | None. | New, desktop only (≥768 or ≥1024; see O06). |
| SP-02 | Seconds-precision start and end exist. The parser handles minutes only and rejects midnight ranges. | A shared-boundary editor is needed. Typed boundaries land on whole minutes. |
| SP-03 | Draft row content is contract, deliverable, work type and description. | Content packages and Flip are new. A blank contract cannot live on a server draft. |
| SP-04 | No atomic left-save-plus-advance. | A new transactional endpoint is needed (§a6). |
| SP-05 | Stop exists for running drafts only. | Stop inside a split, Resume (clearing `end_time`) and right Save from a moved start are all new. Duration must be recomputed after the start moves. |
| SP-06 | — | State must live outside `TimerWidget` so Cancel can restore. An explicit Stop inside the split is a real server Stop, so Cancel must not restart it. |
| SP-07 | The 768 px crossing **remounts** the whole shell branch, so the widget's local state is lost. | Split and in-flight save state must sit in a store that outlives the remount. Settle once, using an idempotency key. |
| SP-08 | Transactions and `clientRequestId` exist. Timer routes have neither concurrency guards nor `is_draft` guards on save and discard. | New endpoint with `is_draft` + expected-start guard + idempotency key. |

## (c) Open items this informs

**O06: small-layout breakpoint, compact timer, contract-change affordance.**
- Fact: the only true "small layout" is `max-width: 767px`, where the shell switches DOM branch (`AppShell.svelte:78`). Tablet (768–1023) keeps the sidebar widget mounted, as an overlay in notes mode.
- **Recommendation:** use 768 px as the split cancel threshold and the mobile-capture threshold, matching the existing branch switch. Don't add a new pixel value.
- **Recommendation:** build the compact desktop timer from `TimerIndicator`'s existing collapsed variant (`TimerIndicator.svelte:58-72`), changing its text to "Finish entry" with no running dot. Keep `data-testid` prefixes.
- **Recommendation:** the contract-change affordance can be a text button that reveals the existing `ContractSelect` in place. That keeps the `draftContractId` effect (`TimerWidget.svelte:199-212`) as the single write path.

**O10: persistence, time, validation.**
- **Recommendation: retain as is:**
  - The one parser in `duration.ts`: 1–1440 min, warning over 12 h, midnight ranges rejected.
  - Timer rounding: seconds, ceil, minimum 1 min.
  - Browser local wall-clock strings, with the entry dated its start day.
  - No overlap enforcement on save or manual create.
  - Contract required; deliverable and work type optional.
- **Recommendation: add a client-side "unfinished completion" record** in localStorage, keyed by draft id or `pending`, holding deliverable, work type, description and time text. Clear it on Save and Discard, and read it when the completion form mounts. That covers TC-06 Back, Finish entry and remounts without changing the server. The frozen end already lives on the server row or in the pending timer.
- **Recommendation: a new `POST /api/timer/split`** run in one `database.transaction`. Inputs: `entryId`, `expectedStartTime` (+ date), `boundary {date,time}`, `left {action: save|discard, contractId, deliverableId, workTypeId, description}`, `remainder {content: keep|blank}` and `clientRequestId`. Steps:
  1. Lock the draft row and assert `is_draft` and the expected start.
  2. Insert the left entry with link reconciliation, unless the left is discarded.
  3. Set the draft start to B and recompute `duration_minutes` if the draft is stopped.
  4. If the remainder is blank, delete the draft and return `remainder: pending`; the client writes the pending timer at B.

  A retry with the same `clientRequestId` returns the first result. That gives SP-08 "together", and the SP-07 "save in flight" branch settles once.
- **Recommendation:** when the source is a pending (browser) timer, write a "split-intent" marker to localStorage before `createTimeEntry(clientRequestId)`, then rewrite the pending start. On reload, re-run the idempotent create and apply the advance.
- **Recommendation:** disable Split while `connectivity` is offline for a server draft rather than queue it. Timer routes are not in the outbox today.
- **Recommendation:** add `Resume` as `PATCH /api/timer {resume:true}`, which clears `end_time` and `duration_minutes` on a stopped draft. It is only needed for SP-05.
- **Recommendation (pre-existing defect to fix alongside):** guard `save` and `discard` with `is_draft = true`, and reconcile description links in `save`. See (d).

**O13: deferred scope.**
- Fact: no API splits a saved entry. A saved entry's start, end and duration are edited only through PUT. Settings and ontology admin are untouched by this area.
- **Recommendation:** keep split strictly on the single draft or pending capture. Leave split-on-`isDraft=false` entries and duration-only entries out of the endpoint's accepted inputs, so the deferral is enforced in code.

## (d) Risks, races, and things that must not break

**Risks and races:**
1. **A stale device can destroy or overwrite a saved entry.** Device A saves the draft. Device B, still showing the old draft, presses Discard and `discard` deletes A's saved entry, or presses Save and `save` overwrites it. Neither route checks `is_draft` (`discard/+server.ts:19`, `save/+server.ts:47`). Split work will add more stale-draft paths. Guard them.
2. **Two-request split.** Without one transaction there is either a duplicate interval or a lost interval (§a6). The in-flight save on resize must not fire twice. Use `clientRequestId`.
3. **Widget state is per instance.** The sidebar and footer widgets each load status on mount. The 768 px crossing and phone level changes remount the widget. Split overlay state and the completion draft must live in a context or store, not inside `TimerWidget` (IN-03: no second timer model).
4. **Description debounce.** 1.5 s for a server draft. A reload inside that window loses text. Stop flushes it (`TimerWidget.svelte:331-341`). Split must flush it too before reading the content package.
5. **Contract PUT errors are swallowed** (`:208`). A split reading `draftContractId` may disagree with the server row. Use the server's value in the transaction.
6. **Rounding.** Splitting one run in two can sum 1 minute more than the unsplit duration. Document this, or compute the right part's duration as the total minus the left.
7. **DST.** Client elapsed time and server duration disagree by an hour across a change. Keep the server's rule (`timer-duration.ts`) as the source of truth for saved minutes.
8. **Escape in native selects.** The modal's window-level Escape closes it even while a select is open. Any overlay menu work must stop propagation the same way (SP-06 Escape guard).
9. **The Tauri tray Stop** clicks the first button whose text is exactly "Stop" inside `[data-testid^="timer-widget-"]` (`src-tauri/src/tray.rs:18-23`). Keep the "Stop" text and the testid. Make sure a split card's Stop is not matched by mistake, or update the script deliberately.

**Tests to keep green:**
- **Vitest:**
  - `src/lib/components/timer/{timer-api,pending-timer,timer-start-edit,local-date,save-error,contract-label}.test.ts`
  - `src/lib/stores/timer-state.test.ts`
  - `src/lib/utils/duration.test.ts`
  - `src/lib/server/db/queries/timer-duration.test.ts` (midnight)
  - `src/routes/api/timer/{timer-start-rules,timer-adjust,local-clock}.test.ts`
  - `src/routes/api/time-entries/batch/entries-batch.test.ts`
  - `src/lib/offline/outbox-{queue,merge,projection,replay}.test.ts`
  - `src/lib/components/weekly/attach-note.test.ts`
  - `src/lib/desktop/bridge.test.ts`
- **API e2e:**
  - `src/e2e/timer.e2e.test.ts`: start, stop with no 0 m, stopped status, discard, save, local date, adjusted time and the 24 h limit.
  - `src/e2e/timer-cli.e2e.test.ts`: overlap `--yes`, adjust.
  - `src/e2e/time-entries.e2e.test.ts`: deliverable and work type persistence and the 24 h limit.
  - `src/e2e/idempotent-creates.e2e.test.ts`
  - `src/e2e/entry-references-cli.e2e.test.ts`
- **Playwright:**
  - `timer-start-today.spec.ts`: move start, overlap confirm, pending-timer start.
  - `timesheet-polish.spec.ts:150`: the contract-change reset. Also `:234`, the Europe/London timer date.
  - `work-type-consistency.spec.ts`
  - `attach-note-sidebar.spec.ts:130`: running timer attach note.
  - `iphone-journeys.spec.ts:89`: phone timer.
  - `offline-outbox.spec.ts`: the queued create is made once.
  - The manual checklist in `e2e-playwright/manual-checklist/`.

**No test covers:**
- completion-form persistence across remount;
- stale-device save or discard;
- timer-save link reconciliation;
- a DST-crossing timer;
- Escape while a select is open.

Add those before changing these paths.

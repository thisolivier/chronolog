# Chronolog — current-state reference

**Recorded:** 6 November 2026  
**Purpose:** preserve the app's current behaviour and the user's corrections before discussing a reskin and minor component rebuild.  
**Evidence:** nineteen supplied screenshots and the owner's explanations from 5–6 November 2026, followed by the design decisions recorded below. This is a UI and workflow inventory, not a source-code audit. Sections 15 onward record subsequent decisions; later explicit amendments supersede conflicting earlier text and renders.

**Latest pattern geometry amendment:** section 31 changes the library's base unit to a square tile, repeatable edge to edge into rectangular or wider components, with zero gaps or borders between tiles. Earlier rectangular-footprint references describe the previous direction; specific tile designs, dimensions and remaining repetition rules are open.

## 1. Product and working context

Chronolog combines consulting time logging with contract-organised notes. The primary working pattern is:

1. Start a timer.
2. Make notes and retrieve information while doing much of the actual work outside Chronolog.
3. Move between notes and other app areas while that timer runs.
4. Stop the timer and save the entry.
5. Use Time Entries primarily to review and amend logged work.

The owner is still finding their routine and says the app generally works well. Their explicit concerns are the messy sidebar, insufficiently considered font sizes, and inconsistent presentation/access to the running timer when the sidebar is absent. No additional complaint should be inferred from the unfinished sentence in the second message.

Mac is the primary design target. The same design should work well on mobile. The supplied narrow screenshots are narrow Mac windows, not evidence of actual iPhone viewport dimensions or keyboard behaviour.

Documentation and a first inspirational mood board have been completed. Discussion has now established the design principles and scope decisions recorded in section 15. No app source code has been supplied or modified.

## 2. Technical context, as reported by the owner

| Layer | Current implementation |
| --- | --- |
| Interface | Svelte 5.49, using $state, $props, $derived and $effect |
| Application | SvelteKit 2.50 for routing, server endpoints and service worker |
| Styling | Tailwind CSS v4; configuration and custom small-screen/iPhone safe-area rules in src/app.css |
| Components | Handwritten buttons, menus, modals and sidebar in src/lib/components/; no component library |
| Note editor | TipTap 3, including a wiki-link extension triggered with [[ |
| Distribution | PWA with Tauri 2 wrappers for Mac and iOS; screens remain Svelte |

These are owner-provided implementation facts, not independently verified package versions. A later rebuild should begin by inspecting the actual repository.

## 3. Domain model and terminology

The authoritative classification hierarchy is **Client → Contract → Deliverable → Work Type / Tag**. This correction supersedes the earlier looser explanation that deliverables were simply tags.

| Object | Role and confirmed relationships |
| --- | --- |
| Client | Groups contracts. Has a name, short code, colour and an emoji column in management UI. Can be active or archived. |
| Contract | Belongs to a client. Owns notes and provides the context for time entries. Single-contract clients are flattened in the main navigation. |
| Deliverable | Belongs beneath a contract in the four-level hierarchy. Selected when classifying time. |
| Work Type / Tag | Fourth tier beneath a deliverable. An existing example has the value “default”. Do not treat this as an unrelated global tagging system. |
| Note | Belongs to a contract, has a reference code, and can contain formatted content, raw Markdown and wiki-links. |
| Time entry | Has a date, description, contract context, duration and/or a start/end range, and classification fields. It can reference multiple notes, including notes in other contracts. |
| Week status | Record-keeping state for one week: Unsubmitted, Draft ready, Submitted. It does not send anything. |

Notes belong at contract level; they are not a fifth tier below Work Type.

The navigation counts are **note counts**, not hours, entry counts, tasks or deliverables.

Client colours have semantic identity. The management screenshots label Amplitude as Sky, EasyJet as Amber, Internal as Rose, and Virgin Media O2 as Violet. Colour appears in navigation dots, entry accents and weekly breakdown bars. The exact scheme may later be restyled, but meaning should remain consistent.

The UI shows codes such as AMP.20261105.006. Copying the displayed code is a real action with the tooltip “Copy note code”. Do not infer the complete generation algorithm, date/timezone rules, code immutability or migration policy from this example.

## 4. App shell, navigation and responsive layouts

### Wide desktop

- Native Mac window chrome sits above the web UI. Window titles reflect current context.
- App header contains the Chronolog identity, sidebar toggle, back/forward controls and global search with a visible ⌘K hint.
- The left column contains Time Entries, the Notes client/contract tree, Archived, Trash and Settings.
- A timer area occupies the bottom of that left column.
- Notes normally use three columns: navigation, note list, editor.
- Time Entries uses navigation plus a wide weekly review area.
- The hamburger can hide the left navigation column. In notes this leaves note list plus editor.
- Columns are not user-resizable. The owner has no immediate plans to add resizing.
- Search and Settings are dedicated full-width pages with a “Back to app” action.

### Narrow window

- Navigation, contract note list and note editor appear as successive screens.
- Back controls identify the previous navigation level; text truncates where necessary.
- Search becomes an icon. Some screens also show an additional list/search-like icon; its precise behaviour has not been established.
- A running-time reflection can appear in the top bar.
- The screenshots show a full timer form below navigation or the time-entry review content, and only the top-bar reflection in narrow note views.
- The week overview remains visible above scrolled entry content in the supplied narrow example.
- The add-entry modal is centred over a dimmed screen; at narrow width it occupies most of the available width.

**Original implementation:** the top-bar elapsed-time reflection is not an independent compact timer mode. Clicking it routes back to the sidebar when the sidebar is not visible. Its application is inconsistent, as acknowledged by the owner. This describes the existing app, not the later desktop collapse/expand design direction recorded in section 28.

No exact CSS breakpoints, logical viewport sizes, zoom levels, safe-area values or sticky-position implementation have been verified from the screenshots.

## 5. Main sidebar

The sidebar combines several responsibilities:

1. Primary navigation to Time Entries.
2. Client/contract navigation for notes.
3. Archive, trash and settings access.
4. Timer controls and entry completion.

For clients with multiple contracts, the client appears as a collapsible group with indented contracts. Selecting a client can show notes across its contracts. Selecting a contract narrows the note list. When there is only one contract, the contract appears directly with the client as secondary text.

Examples shown include the Amplitude group with five contracts, plus flattened EasyJet, Internal and Virgin Media O2 items. Archived has a separate count, whose precise counting unit is not confirmed.

Active client context and active contract can both receive visual emphasis. Long names truncate in wide-sidebar rows. The timer's changing height reduces the navigation area available above it.

No sidebar context menu has been shown. Management is exposed through Settings; do not invent drag-and-drop, favourites, pinned contracts, custom sidebar sections or context actions as existing features.

## 6. Notes: list, editor and links

### List

- Header communicates either a client-wide scope (“All contracts” / client name) or a specific client and contract.
- “New Note” creates a note within the relevant context.
- A visible “Created ↓” control indicates sorting by creation; other sort choices were not shown.
- Rows contain a title, date/time, excerpt and, in the client-wide scope, contract context.
- Selected rows have a light highlight and accent at the left edge.
- Dates are expressed as times, relative weekdays or calendar dates.

### Editor

- Context header contains client/contract, note code, saved status and Move / Export / Delete actions.
- Formatting toolbar shows bold, italic, H1/H2/H3, bulleted/numbered/task lists, horizontal rule, Link, code, Attach and Rich/Raw mode.
- The narrow screenshot does not show every wide-toolbar control. Whether this is responsive omission, overflow or horizontal scrolling is unverified.
- Rich mode displays rendered headings, paragraphs, lists, inline code and wiki-links.
- Raw mode displays editable Markdown in a monospaced face, with the toolbar still present.
- A large heading in the document corresponds to the list title in examples. Whether title extraction is automatic, or a separate title field exists, is unverified.
- A visible “Saved” indicator communicates persistence. Exact autosave timing, error states and offline behaviour were not inspected.
- A “Linked time entries” region beneath the editor displays date, description/note link, contract context and duration.
- Note export formats, attachment behaviour and Move/Delete dialogs were not shown.

### References between notes and time

- Wiki-links are supported, including the [[ editor extension.
- Notes can reference other notes.
- Time-entry descriptions can reference several notes, including notes owned by different contracts.
- Creating a note from a running timer uses that timer's current contract, inserts the note code as a wiki-link in the description, and immediately navigates to the new note for editing.
- Creating/opening a note independently does not start a timer or automatically populate one.
- Copying a note code is an explicit header action.
- Raw codes, titled links and linked-entry summaries are visible across the examples.

Typing [[ opens a basic recent-note search/picker. Screenshot S19 shows codes, titles and excerpts, with a selected-row highlight. It does not visibly identify client/contract or result type, and the owner reports inadequate filtering. The owner wants better context and filtering here. Whether this picker currently returns time-entry targets as well as notes has not been established by the screenshot. Back/forward navigation already supports returning after following clickable wiki-links; preserving the note's scroll position is an extension the owner considers useful.

The exact difference between a bare pasted code and a bracketed wiki-link, reference parsing timing, broken references and backlink update rules remains unverified. Do not assert that every bare code is automatically linked.

## 7. Timer lifecycle

| State | Visible controls and behaviour |
| --- | --- |
| Idle | Start Timer and Add Entry |
| Running, no contract | Large elapsed time, Stop, editable-looking Started time, Contract selector, helper explaining a contract can be picked now or when stopping, Description |
| Running, contract selected | Elapsed time, Stop, Started time, chosen Contract, Description, create-note icon |
| Stopped draft | Message to save or discard; Description, Contract, Deliverable, Work type, Time field, computed duration; Discard and Save |
| Saved / discarded | The visible workflow returns to normal time logging; exact post-save focus/navigation was not demonstrated |

The observed running form does not expose Deliverable or Work Type, even with a contract selected. The stopped form does.

The owner reports that fields in the completion flow appear successively as earlier fields are filled, causing the form to jump. Completing the entry when stopping is desirable: that is when the owner knows what they did. The design direction is to stabilise this completion form, not introduce an automatic-draft/review-queue workflow.

Starting before selecting a contract is supported. Whether a contract is ultimately mandatory, which other fields are required, how validation is presented, and whether all contracts require the same depth of classification are unverified.

The displayed Time field after stopping accepts a range in the example, with a computed duration underneath. Timezone, midnight rollover and rounding rules are not established.

The screenshot with a Rank Group note referenced while Hungryroot is selected is not necessarily a data error: cross-contract references are supported.

No pause/resume, multiple simultaneous timers, automatic idle detection or ability to start another timer while a stopped draft is pending has been established. These must not be invented in a redesign.

## 8. Time Entries review

### Week overview

- Previous/next week navigation, week number, calendar date range and Today action.
- Monday–Sunday summaries with date, duration and small client-colour breakdown bars.
- Current-day visual emphasis.
- Weekly total.
- A status dropdown for that particular week.
- Clicking a day **scrolls to its heading** in the weekly entry list; it does not filter the list.

The owner reports that day headings disappear during scrolling and lack prominence. The week overview feels too tall and fragmented, particularly its separate weekday/date/duration lines. Wide entry cards waste space, and contract identity is too subtle for rapid visual grouping.

The screenshot values are sample data, not a live report or a requirement for the visual concept. Bar normalisation and duration rounding should be checked in code if changed.

### Entry list and editing

- Entries are grouped under day headings with daily totals.
- A plus beside a day heading provides an add-entry affordance.
- Each entry shows description, client/contract and lower-level classification.
- A client-colour edge/dot provides association.
- Duration is right aligned, with a clock range where present. Duration-only entries are also shown.
- Descriptions can display readable note links.
- Missing classification can show an “Add deliverable…” prompt.
- Existing entries are edited **inline**, not through the manual-add modal.
- Individual sections become text inputs or dropdowns as appropriate.
- The classification example presents Deliverable and Work Type dropdowns plus Done.
- The description example becomes a text field with an active underline.
- An x and a create-note-like icon appear on the right in the edit screenshots; their precise actions/confirmation behaviour have not been demonstrated.

### Manual add

The centred Add Time Entry modal provides Date, Description, Contract, Deliverable and Time fields, then Cancel/Save. Deliverable is disabled until a contract is picked in the supplied empty form.

Time accepts a human-readable duration or a clock range, with the example placeholder “1h30m or 9:00–10:30”. The presence/rules of Work Type after making selections in this modal have not been shown; the stopped timer and inline editor do expose it.

### Weekly status

| Status | Visible explanatory text | Actual meaning |
| --- | --- | --- |
| Unsubmitted | Still logging time | Manual record-keeping |
| Draft ready | Ready to review | Manual record-keeping |
| Submitted | Sent to the client | Manual record that submission happened elsewhere |

Changing status triggers no sending, export or integration. It is tracked independently for each week. Do not invent billing, invoicing, approval or client-notification workflows.

## 9. Search

Search opens a dedicated page rather than a small command palette.

- Header: Chronolog, history navigation, query field with clear control, Back to app.
- Combined results include notes and time entries.
- Icons distinguish document results from time results.
- Rows show client colour/context and matching excerpts with highlighted query text.
- Note results also show their title; dates/times appear at the right.
- Time results include date and duration.
- A count summary such as “50 of 216 notes · 50 of 214 time entries” is visible.

Do not infer the exact query semantics, pagination, 50-result cap, ranking or total-count interpretation from that one result screen. Empty, no-results, loading and error states are not shown. Timer reflection coverage on search is unverified.

## 10. Settings and management

### Settings landing page

Contains account identity and Sign out, plus three destinations:

- Clients and contracts: add, rename, reorder, archive and delete clients, contracts, deliverables and work types.
- Two-factor authentication: authenticator app and recovery codes.
- API tokens: personal tokens for the laptop CLI and Claude, including create, last use and revoke.

These capabilities are described on the screen; the security/token subflows were not opened.

### Clients

- Breadcrumb back to Settings.
- Add Client.
- Table columns: Name, Short code, Emoji, Colour, Actions.
- Active and archived clients are listed together.
- Row actions show Edit, Archive or Activate, and Delete.
- Clicking a client name opens its contracts page.

### Client detail / contracts

- Breadcrumbs: Settings / Clients / client.
- Client summary, short code and Edit Client.
- Contracts heading and Add Contract.
- Contract rows show name, Active state, Edit, Archive, Delete and up/down reorder controls.
- Contract names are navigable.
- The lower-level management screens for deliverables and work types were not supplied.

An advertised action is not evidence of its exact confirmation, cascading deletion, reactivation or permissions behaviour.

## 11. Design observations, separate from confirmed behaviour

These observations guide later discussion; they are not approved changes.

| Observation | Consequence worth exploring |
| --- | --- |
| Sidebar mixes navigation, hierarchy, utilities and a variable-height form | Establish stronger visual grouping and clearer ownership of timer space. |
| Client, contract, heading and action text have similar emphasis | Define distinct UI type roles and spacing before adding decoration. |
| Location is repeated across window title, toolbar, list header and editor metadata | Reduce repetition where the remaining context still supports navigation. |
| Existing timer reflection sometimes disappears and otherwise routes to the sidebar | Explore consistent timer access; any direct compact controls would be new behaviour. |
| Rich/Raw toolbar has many equally weighted controls | Clarify control grouping and responsive access while retaining capabilities. |
| Dense review content uses sizeable cards and secondary metadata | Explore more scannable rows while preserving inline editing and long descriptions. |
| Colours already encode client identity | Separate identity colour from action, selection, warning and timer semantics. |
| Note content and app chrome have different reading purposes | Tune their typography independently. |

A refreshed interface should preserve the working model unless an explicit change is later agreed: immediate timer start without full classification; independent note creation; create-and-link from a timer; cross-contract/multiple note references; rich/raw editing; inline time edits; duration/range input; scroll-to-day review; manual weekly status; and single-column navigation.

## 12. Unknowns retained for implementation, not another questionnaire

There is enough information for a first mood board. The following can be resolved from code or during implementation:

- Required fields, validation, defaults and draft persistence.
- Midnight, timezone, rounding, overlap and timer recovery behaviour.
- Note title derivation, code generation, wiki-link parsing, picker interactions and failed save states.
- Keyboard focus, shortcuts beyond the visible ⌘K hint, native menus and actual iPhone keyboard/safe-area behaviour.
- Search result ranking, counts and pagination.
- Archive/trash scope, restoration, deletion semantics and hidden management screens.
- Exact responsive breakpoints, scroll containers and toolbar overflow.
- Actual current typography, contrast and touch-target measurements.
- Behaviour of unspecified icons and post-save navigation.

No backend or data-model migration is proposed.

## 13. First visual exploration — provisional

Working direction: **Studio Ledger**.

A contemporary working notebook with the precision of a printed ledger: near-white surfaces, ink-coloured typography, fine rules, restrained geometric details and small coloured markers. Use a clear sans-serif for interface and document content, with monospaced/tabular numerals for time and reference codes. Bring in a little vivid violet and acid lime as exploration accents without erasing client identity colours.

The visual board should contain a dominant Mac notes workspace, a weekly review excerpt, a narrow/mobile note view, and enlarged timer/type/colour details. It should feel usable and recognisably Chronolog. Existing functionality is the content source; this is an aesthetic sketch rather than a final interaction specification.

The global bottom timer strip shown in the mood board was an exploratory proposal and has since been declined for the current direction: the owner values an uncluttered note-writing area and likes the timer in the sidebar. Improve access from Time Entries without adding a permanent timer bar across notes. No pause button, new analytics, tasks, invoicing, team features or AI controls should be added to make the concept look busier.

The name of the direction is a working label, not a proposed app rename. Chronolog remains the product name. Colours, fonts, wording and placement in a generated mood board are exploratory and must be checked before implementation.

## 14. Screenshot evidence index

Each reference links to the original supplied image. The filenames below are evidence identifiers, not proposed app assets.

| Ref | Original filename | Shows |
| --- | --- | --- |
| [S01](https://chatgpt.com/library?file_id=libfile_71b7042d95fc8191a5d0e27011da6f24&account_id=personal) | image.png | Narrow navigation; timer running without contract |
| [S02](https://chatgpt.com/library?file_id=libfile_47678f5991a081918616107ede6cc0d9&account_id=personal) | image(1).png | Wide notes; client-wide list, editor and linked time |
| [S03](https://chatgpt.com/library?file_id=libfile_0529072800548191b0515ef2711f9601&account_id=personal) | image(2).png | Wide weekly Time Entries review |
| [S04](https://chatgpt.com/library?file_id=libfile_79fdd11d4de88191818b542f5ba57966&account_id=personal) | image(3).png | Wide note; stopped timer draft and copy-code tooltip |
| [S05](https://chatgpt.com/library?file_id=libfile_0849f996b4b08191b449f8fbd6c71c2c&account_id=personal) | image(4).png | Narrow contract note list and elapsed-time reflection |
| [S06](https://chatgpt.com/library?file_id=libfile_f8ac660720008191ac8372d898839d3f&account_id=personal) | image(5).png | Narrow rich note editor |
| [S07](https://chatgpt.com/library?file_id=libfile_56a0876492408191a3d321a578c4f4ff&account_id=personal) | image(6).png | Narrow Time Entries with full running timer form |
| [S08](https://chatgpt.com/library?file_id=libfile_12d1d7fbb92481919102d3d0332987fa&account_id=personal) | image(7).png | Manual Add Time Entry modal |
| [S09](https://chatgpt.com/library?file_id=libfile_e68661a9b6d481918ea4f6e1e4d53029&account_id=personal) | image(8).png | Running timer with contract and create-note icon |
| [S10](https://chatgpt.com/library?file_id=libfile_eeb4245c3a608191b9a1de571dd4748e&account_id=personal) | image(9).png | Combined search results |
| [S11](https://chatgpt.com/library?file_id=libfile_8a18e9be07908191aa54778da27f1a41&account_id=personal) | image(10).png | Settings landing page |
| [S12](https://chatgpt.com/library?file_id=libfile_8d20b8d7e1a081918136afcee3419124&account_id=personal) | image(20261106-005238).png | Client management table |
| [S13](https://chatgpt.com/library?file_id=libfile_0d620e6e16d88191aae368367297a4db&account_id=personal) | image(20261106-005247).png | Client detail and contract management |
| [S14](https://chatgpt.com/library?file_id=libfile_4f31301842ac8191990e9afb1aefdabe&account_id=personal) | image(20261106-005326).png | Inline classification edit for a saved entry |
| [S15](https://chatgpt.com/library?file_id=libfile_b9d83bbedb2c8191ab9914aa2018c8c0&account_id=personal) | image(20261106-005356).png | Inline description edit for a saved entry |
| [S16](https://chatgpt.com/library?file_id=libfile_ed3a23ffa1e48191b1c6ee0c3f41dc88&account_id=personal) | image(20261106-005429).png | Raw Markdown editor |
| [S17](https://chatgpt.com/library?file_id=libfile_fbc69e7fa860819195a55f95b13c30b8&account_id=personal) | image(20261106-005506).png | Weekly status dropdown and all three states |
| [S18](https://chatgpt.com/library?file_id=libfile_0e3633c231a88191851c8d73d2402b75&account_id=personal) | image(20261106-010036).png | Wide notes with navigation hidden and timer reflection |
| [S19](https://chatgpt.com/library?file_id=libfile_42d430e6098c81919d6ecdb8f57e8948&account_id=personal) | image(20261106-084550).png | Basic wiki-link picker: codes, note titles and excerpts |

## 15. Design direction after owner feedback — 6 November 2026

### Decisions and scope

| Topic | Owner's position | Consequence for the next design pass |
| --- | --- | --- |
| Timer placement | Likes the sidebar timer; declines a global bottom bar because the note area should stay uncluttered | Preserve sidebar placement. Provide a meaningful way to reach the timer from Time Entries; Settings coverage is low priority. |
| Completing time | Values completing details at the end, when the work is fresh | Keep Stop → complete details → Save/Discard. Fix shifting field layout. Automatic draft capture is not agreed. |
| Contract recognition | Client colour alone is insufficient because much of the work is under Amplitude | Explore per-contract patterns or line styles, consistently reflected in navigation, timer, notes and time entries. |
| Classification | Client-specific ontologies are hard to recall and type | Make valid options visible and browsable. Search can assist but cannot be the only way to choose. Automatically fill fields with exactly one valid option. |
| Wiki-links | Existing [[ recent-note picker works but lacks context, type identification and useful filtering | Improve the existing picker before introducing another linking or preview system. |
| Return navigation | Back/forward already provides the main return path | Add/verify restoration of scroll position within a note. No new preview layer is requested. |
| Incomplete entries | A visible indication on each affected entry is enough | Mark the missing field inline. No Needs details filter, review queue or heavy completion workflow. |
| Splitting time | Wants split support, including when stopping | Support correcting a timer that accidentally spans two tasks, including carrying the second task forward as a running timer. |
| Sidebar grouping | Sections and selected scope need clearer distinction | Explore a softly tinted rounded client-group container and a separate, stronger selected-scope treatment. |
| Full contract names | Revealing untruncated names is not important | Do not spend layout space or interaction complexity on this as a priority. |
| Week overview | Too much height and fragmented alignment | Explore a compact, consistently aligned day/date/duration treatment. |
| Day headings | Too quiet and disappear on scroll | Make headings stronger and keep the current day heading visible while scrolling its entries. |
| Time-entry layout | Contract recognition is weak and wide cards waste space | Explore an aligned desktop row layout, retaining inline editing and chronological ordering. |
| Top bars | App and note-list bars feel uncomposed | Establish distinct global and local actions; consider search at the far right and a concise new-note action. |

### Principles extracted from this feedback

1. **Recognise work context at a glance.** Client, contract, current browsing scope and running task should be distinguishable before reading detailed content. Browsing context and timer context can differ legitimately.
2. **Give every visual treatment one meaning.** Client grouping, contract identity, selected scope and running/incomplete state need separate treatments. A pattern used for a contract must remain stable across screens.
3. **Keep reading and writing visually quiet.** Strong identification belongs at structural edges and in headers, navigation or review rows. Avoid decorative patterns behind document text and permanent extra controls in the writing area.
4. **Keep forms spatially stable.** Dependent fields should not repeatedly move the layout or the final actions. Show pending fields in predictable locations and update their options in place.
5. **Support recognition before recall.** Reveal available ontology choices. Use search as an accelerator. Remove decisions where there is only one possible answer.
6. **Make ordinary correction direct.** Inline missing-field cues, inline edits and a focused split operation suit the workflow. Avoid creating additional statuses and queues unless a real need arises.
7. **Preserve orientation through movement.** Keep day context visible during review, make selected navigation scope obvious, and restore note scroll position through history.
8. **Use density according to the task.** Reading benefits from breathing room; time review benefits from alignment and comparison. The same padded card layout need not serve both.

### Candidate treatments to test, not approved specifications

- **Identity system:** client colour plus a simple contract motif, supported by text. The owner refined the desired recognition to "owl eyes": a relaxed broad scan, not literal defocusing or exceptionally forceful visual differentiation. Keep selected/running/error state independent of the identity motif. Section 16 records the later requirement for a standard horizontal rectangular motif size.
- **Completion form:** keep the relevant field positions and Save/Discard area stable. Dependent fields can show a short pending message until a parent is selected. Auto-select a sole valid option and cascade through subsequent sole-option levels. Changing a parent invalidates incompatible children; visibly show the resulting selections. Allow option browsing with clear hierarchy, using a list for short choices and an expanded searchable list for long ones.
- **Wiki-link picker:** lead with readable title/description; show compact type and client/contract context plus the contract marker; demote the raw code to secondary metadata. A simple scope choice such as This contract / This client / All can support cross-contract links. Offer Note / Time type filtering only if the picker actually supports both target types; otherwise this would be a separately agreed feature.
- **Split at a boundary:** allow a time such as 10:20 to divide a timer starting at 09:00. If the second task is still running, save/classify 09:00–10:20 and continue the timer from 10:20 to now. If both are finished, produce two adjacent entries for completion. Preserve total duration, avoid duplicated intervals and keep allocation of descriptions/links explicit. Duration-only saved entries require a duration split, not invented start/end timestamps.
- **Week strip:** combine weekday and date on one line, with duration beneath and a thin breakdown indicator. Keep week navigation, weekly total and status in a compact aligned band. Sticky day headings sit below any fixed week strip; day-jump scrolling must account for their combined height.
- **Wide entry row:** an identity/contract column, a flexible description with deliverable/work type beneath, and a right-aligned duration/time column. Wrap long descriptions naturally. On narrow screens, stack the same content in a predictable order. Preserve chronology; patterns provide visual grouping without automatically regrouping entries by contract.
- **Navigation/header composition:** use a gentle client-section background for containment and an independent row selection indicator. Place global search predictably, keep note-list actions local, and test a document-plus or concise '+ Note' action with a tooltip/accessibility label. Reducing the button label should not reduce its hit area or clarity.

### Next useful design studies

Compare contract identity marks across a sidebar row, timer header, note header and time-entry row. Then compare a compact week strip plus sticky day heading and an aligned entry layout. Finally compose the stable stop form with browsable classification and the split operation. These can precede choosing a final palette or a complete reskin.

## 16. Field Notes direction and deferred adjustments

The owner likes the later earth-tone Field Notes mood board and its rebuilt sidebar timer. This is a preferred creative direction, not approval of every generated detail. The desired palette is green, brown and autumn tones, with red permitted. The running timer exploration uses a contract identity header, editable description, elapsed/start time and Note/Stop actions, all within the sidebar.

Relevant visual references:

- [Field Notes mood board](https://chatgpt.com/library?file_id=libfile_2b0e2b1a1e208191b89b3f0301eadde9&account_id=personal)
- [144-mark exploration sheet](https://chatgpt.com/library?file_id=libfile_37beaeb5d2648191950f100ed02136c6&account_id=personal)

### Owner's latest notes — record now, do not redraw yet

1. **Standard rectangular symbols.** The eventual assignment library should use the same horizontal rectangular size as the contract marks in the Field Notes mood board. All motifs should be designed for one shared rectangular footprint, with consistent padding and optical weight. The mixed square, round and tall silhouettes in the exploration sheet are candidates to adapt, not final assets. Do not assume a square icon canvas; exact pixel dimensions remain to be settled.
2. **Sidebar punch-out.** The contract item can use the standard app background as a punch-out from the surrounding coloured section. Working interpretation: the selected contract row reveals the normal paper background within the tinted client/contract group, with its identity mark and text still readable. This interpretation should be stated back to the owner; the comment is a design note, not approval of an exact outline or corner treatment.
3. **Remove repeated context.** The sidebar, note-list header and note editor currently repeat essentially the same client/contract context. Consolidate the identity information across the visible columns. Restore necessary context when upstream columns are hidden or when following a link opens a note in another contract. The exact header composition is deferred.

The sidebar and header adjustments above remain deferred. The owner subsequently requested a focused stopped-timer draft, not a complete mood-board redraft or app implementation.

### Signed-off behaviour: stopped timer and classification

The owner signed off this bounded behaviour proposal on 6 November 2026 ("Happy to sign off, give me a draft"), then approved the visual draft with two small changes: remove the entire 'Only option' annotation and use the button labels 'Save' and 'Discard'. Automatic selection remains approved. Record these changes without redrawing.

- Stop freezes the end timestamp immediately and opens the existing completion step; time spent completing the form does not extend the logged interval.
- Keep the contract, description, deliverable, work-type and time controls in predictable positions from the start of completion. Pending dependent controls explain which earlier choice is needed. Save/Discard remain anchored.
- Valid ontology options are browsable; search is optional. Keep current validation rules until source inspection establishes them rather than inventing new required fields.
- Exactly one valid option is selected automatically and remains visibly shown. Continue this through successive levels where each has one choice.
- With several valid options, show the choices through an in-place selector that opens a browsable anchored menu, keeping the surrounding completion form stable. Search is an optional accelerator.
- With no applicable options, show a clear not-applicable state; distinguish that from failure to load options or an incomplete required parent selection.
- Changing a parent preserves still-valid descendants, clears invalid selections and applies the same single-option rule to the new branch. Preserve description and note references.
- Save commits the entry; Discard retains its existing meaning. No automatic-save-on-stop queue, new review filter or global bottom timer bar is introduced.
- Split-entry behaviour is a related backlog item to specify separately after the basic completion step is agreed.

Anchored menus are the agreed starting point: choices overlay the surrounding form rather than expanding its height. On short or narrow viewports, placement must respect available space while preserving the stable completion layout.

### First stopped-timer visual draft

A focused Field Notes component study shows three equally sized sidebar completion cards: Just stopped, Browse deliverables, and Ready to save. It carries the pale sage contract header and standard rectangular contract mark into the stopped state, with a frozen duration, description and linked-note reference, fixed classification fields, editable time range, and anchored Discard/Save entry actions. The open menu overlays the form; the completed example explicitly shows the sole work-type option selected automatically.

The displayed options and single-option branch are illustrative, not a claim about the actual Hungryroot configuration. The note pill treats an existing wiki-link in the description; it does not add a separate new relationship or automatic note creation. The visual direction is approved with the amendments below; the image is not executable UI. Existing validation rules still require source inspection. Split-entry behaviour remains separate.

Draft image workspace reference: `/workspace/scratch/3968933593c9/generated_images/exec-1b2b9897-b744-4645-bf43-c94f291019c6.png` (generated image saved automatically).

### Visual approval amendments — banked without redraw

- Remove the checkmark and the entire 'Only option · selected automatically' helper element. Do not retain a spacer solely for this annotation. Single-option values are still selected automatically and shown normally in their fields. Keep the revised field layout stable across states.
- Button labels are exactly 'Save' and 'Discard'. Replace 'Save entry' with 'Save'.
- [Approved stopped-timer reference](https://chatgpt.com/library?file_id=libfile_4b24340906fc819183c0d5440f28c29e&account_id=personal). These written amendments take precedence over the original image.
- No new visual draft or implementation requested for these amendments.

## 17. Earlier multi-split exploration — superseded for the current treatment

The owner subsequently found these renders too fiddly and requested the much simpler single-split desktop dialog recorded in section 18. This section preserves the earlier exploration; its full-screen, slider and repeated-splitting interface is not the current direction. The explicitly approved continuous-resume timing remains applicable.

The owner refined the split proposal into a full-screen workflow, available while timing or during stopped-timer completion. This supports both correcting a timer spanning several tasks and deliberately keeping a long-running timer that is divided into completed tasks and a continuing final task. The earlier suggestion that all new parts inherit the original classification is superseded: new parts start blank.

### Owner-specified direction

- While running, put a Split icon beside Add note.
- During completion, put Split in the timer panel's top bar.
- Both entry points open a full-screen modal.
- Start with two boxes side by side. Allow their positions to be flipped so the original entry's existing details can belong to the first or last portion.
- The original description, note links and classification stay together. Newly created portions have nothing filled in: do not copy contract, classification, description or links from the original. The previously approved single-valid-option rules still apply once the user chooses a classification branch.
- Use a slider to divide the time, with the ability to split again into several chunks.
- Allow the final chunk to be left running. Save the completed chunks and resume the final one.
- Resume belongs to the still-unsaved final chunk within this split session. Saving an entry as finished does not make it resumable. The owner is not requesting a general resumable-entry model.
- The owner explicitly confirmed that choosing Resume after Stop includes the time spent in the split modal: the final chunk runs continuously from its split boundary through the current time. There is no excluded pause interval in this flow.

### Interpretation and recommendations for review — not yet signed off

- Keep time slots in chronological order. A flip moves the original content between slots rather than reversing time. With further splits, retain original content on exactly one selected chunk; the new chunk starts blank.
- Use one timeline with a handle per boundary. Each chunk shows its start, end and duration; also allow precise time/duration entry. Boundaries preserve adjacent intervals and positive durations. Duration-only saved entries, if later included, must not acquire invented clock times.
- Suggested final actions: Save finishes every chunk; Save & resume saves the earlier chunks and returns the last unsaved chunk to the active timer. This is a single coordinated commit, not separate Save operations on individual cards. The user has not yet agreed this action structure or wording.
- Cancel returns to the source timer/completion draft without applying the split. A running source timer must not lose time accrued while the modal was open.
- Clock treatment for the renders: entry from a running timer keeps accruing time to the final chunk while arranging the split; entry after Stop initially keeps its end fixed. Resume after Stop includes the modal interval continuously, as explicitly confirmed above. Save without resuming retains the stopped endpoint.
- Saved-entry splitting was an earlier assistant proposal; the owner's latest specified entry points are the running and ending timer. Whether saved entries also get this flow remains deferred. Do not offer Resume for already-finished saved entries.

The owner requested renders of the two-part flow, multiple splits, and mobile. Three visual studies have now been produced, described below. The timing rule above is approved; these visual layouts, action arrangement, commit/recovery details and exact timeline mechanics remain for review. No app implementation has been performed.

### Split-flow renders — first visual pass

1. **Two-part desktop.** Full-screen modal with a shared timeline and one draggable boundary, two equal-width forms, Swap details between them, and Split again on each. The original stays on the first part; the second starts completely blank. Entry-point insets show Split beside Add note while running and in the timer header after stopping. Footer actions are Save and Save & resume, with Cancel in the modal header.
2. **Four-part desktop.** One timeline with three boundaries; entry forms wrap into a two-column grid rather than narrowing indefinitely. Numbering binds cards to chronological segments. This is a mid-edit example: parts 1 and 2 were filled manually, part 3 remains blank, and the original content has been moved to part 4, which can continue running. The header/timeline and final actions remain available while the cards scroll. Move details should ultimately allow selecting any destination chunk; the paired arrows in the image are only an indicative affordance, not a restriction to neighbouring pairs.
3. **Mobile.** Full-screen modal with a vertical stack of chunk cards and one expanded editor at a time. Collapsed cards retain identity, number, time range and duration. A compact timeline provides the overview. Two-part splits can expose a generous handle directly; multiple splits use Adjust times or a boundary tap to open a focused bottom sheet with a full-width slider and precise time input. The sheet edits one boundary between two adjacent chunks and leaves the other boundaries fixed. Done returns to the split modal without saving entries. Save / Save & resume belong to the modal footer, not a new global timer bar. Keep safe-area padding and allow the card stack to scroll; do not shrink fields or touch targets just to show every part simultaneously.

New chunks always begin blank; the populated new chunks in the multi-split examples represent subsequent manual input. Contract marks retain a consistent horizontal rectangular footprint. No 'Only option' annotation appears. Button wording and detailed mobile interactions shown here are proposals for review, not new approvals inferred from the request for renders.

Rendering snapshots use a session beginning at 09:00, with a two-part boundary at 09:50, or multiple boundaries at 09:35, 10:00 and 10:20. The running snapshot is 10:30; it is illustrative, not a reference to the user's real clock. Resume keeps the final chunk continuous through the current time. A live timeline must not shift a boundary out from under the user's pointer while dragging; final scaling behaviour still needs implementation design.

Workspace image references (generated images saved automatically):
- Two-part desktop: `/workspace/scratch/3968933593c9/generated_images/exec-39e7c537-dba0-4f34-a3b0-140df8a1fab0.png`
- Four-part desktop: `/workspace/scratch/3968933593c9/generated_images/exec-a8aeb125-f3a9-404f-b437-a717f18341e0.png`
- Mobile study: `/workspace/scratch/3968933593c9/generated_images/exec-82ea5925-42c5-429c-a7bb-a7c200d4a23f.png`

## 18. Simplified single-split desktop dialog — previous rendered treatment

Owner feedback: "Way too fiddly". Requested a treatment for exactly one split, no slider, a Flip button, shown on desktop in a dialog floating at the centre of the app rather than occupying the whole window. This request supersedes the previous multi-split interface for the current design pass.

The new render uses a compact centred dialog over a dimmed notes screen, with generous visible app context around every side. A modest Split time header shows the original interval and total duration. A single Split at clock input controls the boundary. Below are exactly two side-by-side form panes with derived start/end ranges and durations. One central Flip button swaps their content while keeping the chronological time slots fixed. The original pane retains its contract, description, note links and classification; the new pane is entirely blank. No timeline, slider, additional split action, multi-part grid or numbered navigation is present.

The footer retains Cancel, Save, and Save & resume for review. Save finishes both parts; Save & resume saves the first and continues the unsaved second part from the split boundary through now, including the time in the dialog. Cancelling returns to the source without applying the split. Existing validation and single-valid-option behaviour remain as previously recorded, without an explanatory auto-selection annotation.

This is a visual treatment for feedback, not new approval of every detail. The surrounding dimmed app is illustrative context only; incidental labels or navigation in the generated backdrop are not proposed product changes. No mobile redraw or implementation was requested in this turn.

Workspace render reference (generated image saved automatically): `/workspace/scratch/3968933593c9/generated_images/exec-b7530426-c4fa-4072-a317-86bb50b355f1.png`.

## 19. Further simplification: two independent entry cards — preceding discussion

The owner requests two independent floating windows/cards side by side, each with Save and Discard, with Resume additionally on the right. The left should emphasise a duration; the right should express elapsed time through now. The owner is still considering how split input should work while allowing each entry's time to be fully modified. This supersedes the shared-footer dialog as the latest exploration, but precise time-editing and per-card commit behaviour are not yet agreed. Retain one split only and a Flip button; no slider or repeated splitting.

Proposed response, not signed off: eliminate the separate Split at field. Show each card's duration and editable start/end range. While both are uncommitted split drafts, the left end and right start represent one shared boundary: editing either updates the other. Editing the left duration keeps its start fixed and moves that boundary; editing the right duration while its end is Now moves the boundary backwards from now. The left start and right end can also be adjusted, changing the combined interval rather than imposing the original total as an immutable constraint. Now is a live endpoint, and an explicit end time can represent a finished right-hand interval. A subtle shared-boundary indicator could explain the connection without adding another input or a new mode toggle.

Example at 10:30: left 50m,09:00–09:50; right 40m until now,09:50–Now. Setting left duration to35m moves the boundary to09:35 and makes the right duration55m. Flipping moves content between the chronological slots; it does not reverse time.

Per-card action recommendation: Save commits that card as a finished entry; Discard removes that portion without silently allocating it to the other card. After either action, stop automatically changing the resolved entry; the remaining card becomes an ordinary independently editable draft. Resume applies only to the unsaved right-hand card and continues from its configured start through now, including time spent editing. If Resume is allowed before the left card is resolved, the app must retain the unfinished left draft alongside the active timer. This is a necessary consequence to discuss, not approval of a new draft queue or resumable saved-entry model. Flip no longer applies after a card has been resolved.

At this stage no render had been made. Section 20 records the subsequent correction and new draft. Allowing all four endpoints to vary independently while also requiring a gapless split is contradictory; the proposed linked boundary retains a gapless split during the paired draft stage, with normal independent editing after a part is resolved. The possibility of resuming while leaving an unfinished left draft is explicitly rejected in the following section.

## 20. Two-card split with left-first completion — approved desktop direction

The owner clarified that Resume must not be available before the left entry is dealt with, suggested a floating Cancel control and Stop on the right, and asked the assistant to resolve the details and render a draft. The owner then approved banking that draft and behaviour, with an explicit limitation: splitting is unavailable on mobile, and resizing from a large window into the small layout cancels the operation. The two-card direction below is now approved for desktop. Source inspection, exact breakpoint integration and implementation validation are still outstanding.

### Layout and time editing

- Two independent paper cards float side by side above the dimmed desktop app, without an enclosing dialog or shared footer. A modest Split time label and floating Cancel sit above; Flip sits between the cards.
- The left emphasises an editable duration (example 50 min), with From09:00 and To09:50 inputs. The right emphasises elapsed duration through now (example40 min until now), with From09:50 and ToNow. Its running state has a small green dot and an active Stop button.
- While both are unresolved, the left To and right From are one shared boundary. Editing either updates both; changing duration moves the corresponding boundary. Outer endpoints are editable too. When typing a duration against Now, resolve it using the time at edit confirmation, then keep that start timestamp fixed as the elapsed duration grows. Reject negative/zero intervals; do not silently move time boundaries while the user types.
- Original content and links stay together and can be flipped between chronological slots. New content remains blank. Contract/ontology selectors keep the approved single-option rules without an explanatory helper. Flip changes content, not the time slots.

### Resolving the two cards

1. Initially the left Save and Discard are active. The right is editable and Stop is active, but right Save, Discard and Resume are disabled until the left is resolved. The owner approved the rendered left-first flow including this consistent completion order.
2. Left Save commits only that interval. Left Discard intentionally leaves that interval unlogged. Either action resolves the left, fixes the boundary for the existing result, removes Flip and unlocks the right. A failed Save must leave the left unresolved and all text intact. The remaining right start can subsequently be edited normally without changing an already-saved left entry.
3. After resolution, replace the left form with a quiet Saved/Discarded summary in the same footprint, so the right does not jump position. Right Save, Discard and Resume then become available, subject to the app's existing validation. Resume may proceed without a contract, consistent with starting an ordinary timer without one.
4. Right Stop immediately freezes its endpoint and clears the live indicator; it does not save. The form remains editable. If entered from an already-stopped timer, the right starts in this stopped state and has no active Stop action.
5. Right Save commits the remaining entry, freezing now if still running or using its fixed end if stopped. Discard removes only the remaining portion. Resume returns the unsaved right portion to the normal active timer from its configured start. If previously stopped, Resume includes the entire interval through now, including editing time, as already agreed. It does not create a resumable saved-entry model.
6. Save/Discard/Resume on the right completes the overlay. There is never an unfinished left draft left behind when returning to the app.

### Cancel and persistence boundaries

Before the left is resolved, floating Cancel abandons the proposed split and restores the original unsplit content/range. Preserve elapsed time if the source is still running; preserve an explicit Stop performed in the overlay rather than unexpectedly restarting capture. Do not save either provisional card on cancellation.

After the left is saved or discarded, Cancel is removed: it must not promise to undo an already committed action. The left result stands, and the right must be saved, discarded or resumed to close the flow. Escape/backdrop dismissal follows the same state rule. Resolution of the left and advancement of the source timer/draft to the right interval must be persisted together to avoid duplicate recorded time or loss on interruption; this is a requirement for later implementation, not a claim about current persistence support.

### Desktop-only scope and cancellation on resize

- Splitting is not available on mobile. Hide Split entry points in mobile and small-window layouts; do not implement the earlier mobile split study.
- If an open split crosses from the large layout into the small layout, cancel the split UI immediately rather than adapting it into stacked cards. Use the app's applicable layout breakpoint; the exact width is not decided here.
- Before the left is resolved, resizing uses ordinary cancellation: restore the unsplit timer/completion draft, preserve elapsed time and any explicit Stop, and do not create entries.
- If the left has already been saved or discarded, preserve that completed action. Close the split UI and return the remaining portion to the existing ordinary timer flow in the small layout: running remains running, stopped remains a completion draft. Preserve its entered details. Never roll back a saved entry or automatically resume a stopped timer as a side effect of resizing. This is the necessary interpretation of cancellation after a partial commit; it does not introduce a new review queue.
- A resize coinciding with Save must settle the commit outcome once and use the corresponding cancellation branch; no duplicate save or orphaned remainder. Returning to a large layout does not reopen the cancelled split automatically.

### New visual draft

One desktop render shows the initial running state: two floating cards, duration and editable endpoint controls, Flip, floating Cancel, left Save/Discard, active right Stop and disabled right Discard/Save/Resume with the short reason 'Finish the first part to continue'. The still-unresolved right is blank. The later resolved-summary state is specified in prose but not separately rendered. The background app is illustrative only.

Workspace render reference (generated image saved automatically): `/workspace/scratch/3968933593c9/generated_images/exec-bd69e6aa-d634-4dd3-b241-ea9484f5c910.png`.

Approved visual reference: [Chronolog split time draft](https://chatgpt.com/library?file_id=libfile_feff1ac4595c819186f9ad63be543e2c&account_id=personal). The desktop-only and resize-cancellation notes above take precedence over earlier multi-part/mobile explorations. No redraw is requested for this sign-off.

## 21. Time-entry review layout — revised mockup, review pending

Return to the owner's remaining review-screen concerns: the week strip is too tall and fragmented; day headings disappear and need stronger emphasis; contract identity is too subtle; wide entry cards waste space. Treat these as one coherent review-screen study.

- Compact week strip: weekday and date together (Mon2), daily duration beneath, and a thin client-colour breakdown. Align week navigation, weekly total and manual submission status consistently. Clicking a day still scrolls to that day.
- Sticky day heading: strong date and day total stay visible while that day's entries scroll, with Add entry kept local to the day. Account for the fixed week strip in day-jump offsets.
- Aligned desktop entries: a stable contract-and-rectangular-mark column, a flexible description with classification beneath, and right-aligned duration/time. Long descriptions can wrap. Keep chronological ordering and existing field-level inline editing.
- Mark missing information at the relevant field. No additional completion filter or queue.
- Preserve a clear way to reach the active timer from Time Entries, showing its own contract identity when it differs from the browsing context. Detailed control placement remains to be composed.

The owner requested the mockup. A desktop Field Notes review-screen render has been produced; this remains a proposal, not a signed-off layout.

### Rendered treatment

The screen uses the earth-tone shell, a compact week strip with weekday/date together, daily durations and thin segmented client-colour breakdowns. Strong bark day bands carry date, local Add entry and total. Their intended behaviour is to pin beneath the fixed week controls while the corresponding day's rows scroll; a static image does not demonstrate that interaction.

Entries use aligned contract identity, description/classification and duration/time columns, with thin horizontal separators. Long descriptions wrap rather than being replaced with ellipses. Amplitude contracts share pine colouring but use distinct rectangular motifs. Missing deliverables appear as a small inline Add deliverable affordance. Entries retain chronological order within each day and field-level inline editing; the render introduces no extra review queue, filters or bulk workflow.

The sidebar retains the preferred running-timer treatment with Add note, desktop Split and Stop. The first render duplicated this with a top-bar timer shortcut; the owner has explicitly removed that duplication. The global visibility rule and sidebar refinements below supersede that first treatment.

The displayed dates, descriptions, classifications and intervals are illustrative sample content. Thursday's six rows total 4h38m; only part of Wednesday is visible. Weekly totals use the earlier supplied example. The final image corrects the initial draft's solid day bars into segmented client breakdowns; the marks and proportional strips remain visual approximations to implement consistently from actual data.

Previous workspace mockup reference (generated image saved automatically): `/workspace/scratch/3968933593c9/generated_images/exec-88ec8886-33da-465c-b06d-1a405aef54d6.png`.
Initial superseded render: `/workspace/scratch/3968933593c9/generated_images/exec-95d24e70-22ce-423e-80c9-56edea619dd1.png`.

### Owner refinements: timer visibility, sidebar alignment and emphasis

The owner likes the review-screen direction but finds the draft cluttered. These are requested rules, while the overall revised layout still awaits review:

- **Global timer visibility:** do not show the timer in the application top bar when the sidebar timer is visible, whether expanded or collapsed. Show the header reflection when the sidebar timer is not visible, retaining a way to reach it. Apply this across the app, not just Time Entries. Sidebar visibility, rather than route alone, governs duplication. A pending stopped entry uses the Finish entry treatment described in section 28.
- Remove the decorative client-colour dot next to the Amplitude heading.
- Use the first faded-sidebar draft's looser pattern alignment. The owner prefers it over the subsequent correction that forced all marks onto one shared axis. Amplitude's child motifs align with its heading within the group; flattened single-contract clients keep their slightly different outer inset. This supersedes the earlier request for universal alignment. Keep the client grouping.
- When Time Entries is selected, apply approximately **50% opacity to the whole Notes navigation section**, including its heading, client-group backgrounds, client and contract names, motifs, counts and disclosure controls, and Archived, Trash and Settings.
- This opacity is an emphasis treatment, not a disabled state. All those navigation controls remain clickable and keyboard accessible. Do not use disabled semantics or block pointer events. The selected Time Entries item and the entire sidebar timer stay at full opacity.
- Preserve the main review layout, sticky-heading intent, client-colour day breakdowns, chronological rows, inline editing and existing timer actions.

### Week numbering note

Weeks count from the start of the calendar year, as requested by the owner. This is a numbering requirement; it does not change day-click scrolling or the weekly record-keeping status. The exact treatment of the first partial week and year rollover has not been separately specified. The illustrative Week 45, 2–8 November 2026 label remains in this mockup.

### Revised visual

The updated desktop render removes the top-bar timer, fades the Notes and utility navigation, removes the client dot and aligns the contract marks. The running timer and review content retain their full visual weight. These are static mockups, not implemented application changes.

**Owner-selected sidebar variant:** [Chronolog time review sidebar refinement](https://chatgpt.com/library?file_id=libfile_720baeab722881919bb077a2cd362e68&account_id=personal). Workspace reference: `/workspace/scratch/3968933593c9/generated_images/exec-50064e58-a2ed-41a3-afae-ae6998e4be1f.png`. This first faded-sidebar treatment has the preferred less rigid graphic alignment. The timer-visibility and 50% opacity rules remain in force.

Superseded alignment correction: `/workspace/scratch/3968933593c9/generated_images/exec-f62625bb-2971-4115-8132-5e405aecd0c7.png`.

### Divider refinement for the engineering handoff

The owner asked to record this without redrawing the desktop:

> The horizontal dividers for time entries could collapse to the left of the client name, further makes same clients jump out since their dividers will line up, and it maximises space.

Carry this as a refinement to the row separators: reduce their extent toward the client-identity area, use their alignment to reinforce client recognition, and reclaim space. Preserve chronological ordering; this is not a request to regroup or sort entries by client. The quoted wording is authoritative. Exact endpoints and geometry remain to be resolved in the final engineering layout rather than inferred from the full-width rules in current images. The owner explicitly identifies these notes and images as preparation for a set of engineering specifications and visual references.

## 22. Mobile time-entry review — first visual draft, review pending

Produce a phone adaptation of the selected desktop direction, preserving the existing mobile drill-down navigation and desktop-only restriction on splitting.

- The sidebar is absent on the review screen. The application bar therefore shows the active timer's rectangular contract pattern and elapsed time, alongside navigation and far-right search. Tapping the timer reflection reaches the timer through the existing navigation. When the full timer is visible, hide this reflection according to the global rule. No persistent bottom timer bar is introduced.
- Keep all seven days visible in the week strip: weekday and date together, daily duration beneath, and thin segmented client-colour bars. A selected day remains a scroll target, not a filter. Week navigation, Today, weekly total and the manual status dropdown remain available.
- Use the bark day heading with date, Add entry and day total. Its intended behaviour is to remain visible below the week controls for the corresponding day's entries. Sticky behaviour and day-jump offsets must account for the actual narrow-layout header height.
- Reflow each entry into an identity-and-time line followed by full-width description and classification. Keep the rectangular contract motif and bold contract name together with the smaller client name; align duration and time range at the right. Wrap long descriptions and classification labels naturally.
- Retain chronological ordering, existing inline field editing and inline missing-detail affordances. No review queue, filters or new bottom navigation.
- No Split action on mobile. The previously agreed cancellation behaviour on a large-to-small resize still applies.
- Honour safe areas and preserve usable touch and keyboard targets. The static screenshot illustrates hierarchy, not exact implementation measurements.

The first phone render shows Thursday's first four entries with the Hungryroot, Rank Group and Daily Pay patterns; the remaining day's entries are reached by scrolling. The day total includes entries below this visible portion. It retains the current full-width row rules; these do not override the separately recorded divider refinement. It also shows a text Add entry label beside the plus icon; final fit can be resolved with the narrow layout. The mobile layout is a new draft, not yet approved, and no application code has been changed.

Workspace mobile mockup reference (generated image saved automatically): `/workspace/scratch/3968933593c9/generated_images/exec-2012f230-7cf1-4a2e-8a33-0ac251d82c0c.png`.

Mobile visual reference: [Chronolog mobile time entry review](https://chatgpt.com/library?file_id=libfile_7f1f590da9888191813bb23cf824ac0e&account_id=personal).

### Owner amendment — square brown heading bars, no redraw

The brown date-heading bars must have square ends/corners where they meet the screen or content edges. The owner calls these the brown week-heading bars; in the current mockups they label individual days. Remove the rounded caps shown in the images. Apply this treatment to the review layouts, including mobile. This written instruction takes precedence over the rendered rounded corners; no new image was requested.

## 23. Remaining design and handoff work

This is the current working backlog, distinguishing agreed behaviour from unfinished design. It does not reopen rejected multi-split/mobile-split flows or add new product features.

| Area | Remaining work | Current status |
| --- | --- | --- |
| Notes workspace and headers | Carry the selected-contract punch-out, reduced repeated context, compact note actions and responsive toolbar into the engineering specification. | Desktop and single-column mobile treatment approved in section 24, including the rule for restoring context when columns are hidden. Unrendered edge states still require implementation detail. |
| Wiki-link picker | Implement title-first results with contract identity; remove the picker header and scope controls. Search all supported targets, with client/contract names narrowing results through the query. | Banked with owner amendments in section 25; no redraw requested. |
| Contract pattern library | Use standard square base tiles that can repeat into rectangles and wider UI components. Specific designs, dimensions, tiling rules and assignment/reuse details remain to be developed. | Square geometry approved in section 31. Production design remains deferred; the detailed section 26 proposal is not approved. |
| Return navigation | Preserve/restore the position within a note through existing Back/Forward navigation. | Behaviour requested; implementation acceptance criteria remain to document. No new navigation layer requested. |
| Inline editing of saved time entries | Preserve click/tap-to-edit fields, with consistent controls, subtle hover/focus cues and stable row geometry. | General requirements recorded in section 29. Remaining control details are delegated to engineering; no further design discussion or render required. |
| Responsive and supporting states | Carry the time-review and completion treatments into narrow layouts; apply the mobile timer access and return rules, and preserve manual Add entry behaviour. | Mobile capture is drafted in section 27 and control rules confirmed in section 28. Remaining state coverage is engineering follow-through. |
| Global search presentation | Carry the approved desktop/mobile result treatments and large results-top search field into implementation. Use the shared client/contract-aware algorithm from section 25. | Desktop and mobile approved, with the search-placement amendment in section 30. |
| Settings styling | Apply the visual language to existing management screens. | Lower priority; no additional administration workflow requested. |
| Engineering handoff | Consolidate approved specifications, tokens, component states, responsive rules, interactions and labelled image references; distinguish current approved targets from superseded explorations and written amendments. Resolve source-dependent details during implementation planning. | Requested deliverable direction; the current document is the working source, not yet the final specification package. |

Already settled enough to carry forward: earth-tone direction; stable stopped-timer completion and automatic sole-option selection without helper text; Save/Discard wording; two-card, left-first, desktop-only split flow and resize cancellation; global single-visible-timer rule; 50% interactive Notes/utility navigation while Time Entries is selected; preferred first sidebar variant; year-based week numbering. The review layouts have been drafted with divider and square-heading-bar amendments; the mobile draft has not received an explicit final sign-off.

The wiki-link picker is banked with the header-removal and shared-search amendments in section 25. Mobile timer collapse and return controls are confirmed in section 28. Inline editing remains the existing field-level interaction, with implementation details delegated to engineering in section 29. Global search desktop and mobile styling are approved with the search-placement amendment in section 30. The production pattern library remains deferred.

## 24. Notes workspace and headers — approved desktop and mobile direction

The owner chose backlog item 1, then approved the desktop and single-column mobile treatment on 6 November 2026: “Love it, nailed it.” Bank the selected-contract punch-out, reduced repetition, compact note controls, responsive toolbar and the rule for restoring contract context when upstream columns are hidden. Both images show a Rank Group note while the timer runs for Hungryroot, demonstrating independent browsing and timing contexts. No redraw or application implementation was requested by this approval.

### Visible context has one primary home

Reduce repeated client/contract labels while keeping the current note's ownership explicit when the surrounding view cannot supply it. A stable rectangular contract motif may recur as a compact visual cue; repeated full breadcrumb text is what is being reduced.

| Visible layout/context | Primary client/contract label | List and editor treatment |
| --- | --- | --- |
| Three columns, one contract selected | Selected contract row within its client group in the sidebar | List header is Notes with a count and New note action. Omit repeated contract metadata from its rows. Editor shows the contract motif, code, save state and actions without repeating the breadcrumb. |
| Sidebar hidden, list and editor visible | List header restores client/contract and its motif | Editor may keep the compact metadata-only header when it matches that scope. |
| Single-column note list | List header names the selected client/contract | Keep local New note and sort actions; use existing drill-down navigation. |
| Single-column editor | Editor header restores client/contract and its motif | Document title remains in the document. App navigation returns to Notes. |
| Client-wide or other mixed-contract list | List header identifies the broader scope | Rows identify their own contracts. The editor explicitly identifies the selected note's contract where the broader scope would otherwise be ambiguous. |
| Cross-contract navigation where upstream scope still differs | Editor identifies the actual open note's client/contract | Follow existing route/history behaviour; never label a note using the timer or stale list context. If navigation updates the upstream scope, apply the appropriate normal rule above. |

These rules do not change the underlying note-navigation model or move a running timer to the browsed contract. Restoring note scroll position through existing history remains in the backlog.

### Sidebar and list

- Retain the owner-selected first sidebar variant's looser alignment, without the decorative client dot.
- Use the standard chalk background as the selected Rank Group row's punch-out within the sage Amplitude group, with a bold pine label and its two-bar motif. The current selection remains distinguishable from the group's background and from the running timer.
- Notes navigation is at normal opacity while using Notes. The 50% Notes/utility treatment remains specific to Time Entries being selected.
- The list header uses Notes plus the result count, a paper-plus icon button for New note, and the existing Created sort control. The icon needs the accessible name and tooltip New note; reducing visible wording must not reduce its target.
- Keep title, date/time and excerpt in each row; add contract context only when the list spans contracts. The selected note has a quiet sage fill and narrow pine edge rule.
- New note retains the current creation behaviour and scope. Do not silently inherit the timer's contract; creating a note from the timer remains a separate explicit action.

### Note metadata and actions

- Keep the contract motif and copyable note code together. The code and adjacent copy icon invoke the existing Copy note code operation.
- Show Saved as a small quiet check/label, not a large decorative badge. Preserve actual saving/failure states; this mockup does not define autosave timing or claim a persistence change.
- Move existing Move, Export and Delete actions into a note-actions ellipsis menu. Preserve their current behaviour and confirmations. Use an explicit accessible name such as Note actions.
- The document title appears in the document body rather than being duplicated in another local title bar.
- Retain the linked-time region as secondary content. Preserve linked entries and their actual identities, including visible contract context when it differs from the current note. No timer controls are added to this region.

### Editor toolbar

The desktop draft groups B/I, a heading-style dropdown, list controls, rule, link, code and attachment controls into one consistent row, with Rich/Raw at the right. The heading control contains the existing H1/H2/H3 choices and appropriate normal text style. Grouping controls must not remove capabilities.

The mobile draft keeps B/I, heading style, a list control and link visible, then uses a formatting overflow menu for the remaining controls. Rich opens the Rich/Raw mode choice. Distinguish the formatting overflow from the note-actions menu with accessible names and menu content. Preserve keyboard access and focus when menus close; do not change rich/raw conversion or title extraction without inspecting current source behaviour.

The full sidebar timer remains visible on desktop, so the app header has no duplicate timer. In the mobile editor the sidebar is hidden, so the app header includes the compact timer reflection and far-right search. Mobile Split remains unavailable. No bottom timer bar is introduced.

### Visual references and limits

- [Approved desktop notes workspace](https://chatgpt.com/library?file_id=libfile_90dd717a137481919c3eff5bdcd5d3c6&account_id=personal). Workspace reference: `/workspace/scratch/3968933593c9/generated_images/exec-ac487607-5593-4b9c-a593-d449cbc059ca.png`.
- [Approved mobile note editor](https://chatgpt.com/library?file_id=libfile_3a33b52593048191b3e4ca90d8eb22bf&account_id=personal). Workspace reference: `/workspace/scratch/3968933593c9/generated_images/exec-888d2566-b02f-4310-a190-f355bacc1b55.png`.

The body copy is shortened illustrative content from the supplied note, not a proposed edit to stored notes. The images demonstrate hierarchy, context ownership and control placement; exact dimensions, typography tokens, menu contents and production pattern geometry remain for the final specification. Stable production motif assets must replace any small generative variations between images. Two-column, mixed-contract, raw and open-menu states are described but not separately rendered. The wiki-link picker itself is the next separate design item.

## 25. Wiki-link picker — banked with global-search amendments

The owner requested this item after approving the notes workspace, then banked it with explicit amendments: “Ditch the header, global search only,” and client/contract searches must narrow results as part of the query using the same algorithm in global search. Remove the Link a note header and all This contract / This client / All notes scope controls from both images. Keep the title-first result rows, contract identity and inline insertion behaviour. No redraw is requested. This remains an inline picker; global search only means unscoped search across records, not routing away to the global search page.

### Entry point and query

- Typing [[ opens suggestions at the active insertion point. With no query, show recent notes.
- Continue typing the query in the note or time-entry description. Do not create a second search field or move text entry into the picker.
- Search supports titles, codes, existing searchable content, and owning client/contract metadata through the shared matching algorithm described below. The sample result order is illustrative, not a ranking specification.
- The active token is incomplete while searching. The desktop image's closing bracket/underline appearance is a rendering approximation, not an instruction to prematurely complete the link or change parsing rules.

### Global matching, shared with app search

There are no scope tabs, scope dropdowns, remembered scope or implicit current-contract restriction. Start with the global candidate set for the target types the picker actually supports. The current note, timer or sidebar selection must not silently limit the results.

Client and contract names participate in the query itself. A metadata match must find associated records even if the client/contract name does not occur in their title or body. Combine metadata and content terms so a query such as Hungryroot roles narrows to relevant roles material associated with Hungryroot; the user should not need to remember a separate filter syntax.

Use the same query interpretation, matching and ranking algorithm for the inline picker and the app's dedicated global search page. Reuse one implementation rather than approximating the behaviour independently in each component. The surfaces may display different metadata and limit results to their supported types: global search already includes notes and time entries, while the picker's actual linkable types require source confirmation. For the same query and candidate type, matching/order should be consistent.

Examples to carry into engineering acceptance criteria:

- Amplitude finds records belonging to that client even when Amplitude is absent from their text.
- Hungryroot roles combines contract identity with the remaining search terms across the relevant searchable fields.
- Matching a note code still finds the specific note.
- Starting the picker in a Rank Group note while timing Hungryroot does not restrict results to either contract.

Tokenisation, exact/partial matching, ambiguous names and weighting need a concrete algorithm specification during implementation planning. These details are not established by the image. The owner has approved the shared behaviour requirement, not a particular parser or scoring formula.

### Result hierarchy and identity

- Remove the visible Link a note heading and its dedicated header icon. The panel starts directly with results. Give the popup an appropriate accessible name without reintroducing a visible header.
- Lead each result with its title. Show the stable rectangular contract motif and the client/contract label next; place the raw note code in quiet secondary typography.
- Desktop fits date and code at the right of the title/context lines. Mobile drops the date and stacks the code if necessary.
- Client colour and contract pattern identify the target. A separate sage fill and narrow pine rule identify the currently selected result.
- Preserve readable text labels alongside patterns. Different contracts may have similarly named notes; client/contract context must remain visible.
- The draft does not invent time-entry link targets or add Note/Time tabs. Source inspection must establish all currently supported target types. If time targets already exist, retain them and add explicit type identification using their existing behaviour rather than silently dropping them. New target capabilities require a separate decision.

### Selecting, dismissing and continuing

- Arrow keys move the active result; Enter inserts the selected reference. Pointer click/tap does the same.
- Replace only the active [[ query token with the existing canonical wiki-link representation, then put the caret after it. Keep editor focus and, on mobile, the keyboard open. Do not navigate to the target note merely because it was inserted.
- Use the existing stable target/code representation; do not replace it with an ambiguous title-only relationship. Preserve normal undo behaviour.
- Escape or interaction outside the suggestion panel dismisses it without deleting the typed text. Leaving the active token or navigating away closes it. Remove the mobile header's close control with that header; do not reserve an empty header row. Result interactions must preserve the original insertion range.
- Keep ordinary typing independent of result loading. Distinguish no matches, loading and retrieval failure. Errors preserve the query; stale responses must not overwrite newer-query results.
- Results remain keyboard accessible with clear focus. The desktop hint footer is only an aid, not a substitute for keyboard semantics.

### Responsive placement

Desktop uses a floating autocomplete under the active query, sized within available editor/viewport space. Flip or constrain placement near an edge; internally scroll results instead of obscuring the active text. Do not dim the surrounding workspace or reflow the document when results change.

On mobile, a compact suggestion panel sits above the software keyboard and starts with results. Keep the active query visible by adjusting document scroll, without shrinking normal text or adding another input. The results area scrolls when space is limited; show fewer results on short screens. Omit the desktop shortcut footer and the removed picker header/scope controls. Maintain the approved mobile note header and timer-visibility rule. With a hardware keyboard or extra space, use available viewport geometry rather than reserving an absent keyboard's height.

### Visual references and limits

- [Desktop picker reference, with written header-removal amendment](https://chatgpt.com/library?file_id=libfile_a1e382b12fe88191b4d9bcf05ba814e6&account_id=personal). Workspace: `/workspace/scratch/3968933593c9/generated_images/exec-198bb3fa-37f6-4c17-aadb-032ccea7eb3a.png`.
- [Mobile picker reference, with written header-removal amendment](https://chatgpt.com/library?file_id=libfile_442b1741dae88191b0acc64006d14e73&account_id=personal). Workspace: `/workspace/scratch/3968933593c9/generated_images/exec-41eb1209-0a33-4623-b969-44d07021119e.png`.

Names, codes and dates in the results are illustrative. The image keyboard and exact dimensions are visual approximations; implementation must respect real viewport and keyboard geometry. No source code or application data has been changed. The owner banks this treatment with the written global-search/header-removal amendments, which take precedence over both images and the earlier scope-tab proposal.

## 26. Pattern library — deferred proposal, not yet approved

Move from the earlier symbol exploration to consistent production assets. Client colour plus contract pattern and recognisable identity across sidebar, notes, timers, search and time entries remain the direction. The original horizontal rectangular base-footprint proposal below is superseded by the owner's square-tile amendment in section 31.

Proposed rules for discussion:

- Superseded geometry proposal: a 2:1 rectangular canvas and tentative 32 by 16 CSS-pixel footprint. The approved base unit is now square; dimensions, padding, optical weight and repetition rules remain open under section 31.
- Curate motifs for recognition at their smallest actual display size. Use the earlier exploration as source material, not a final asset sheet; remove near-duplicates and details that disappear when reduced.
- Choose a motif randomly on contract creation, avoiding motifs already used by active sibling contracts where the available library permits. Client colour continues to come from the owning client.
- Store a stable motif ID on the contract. Rename, reordering, restart, sync and archive/reactivation must not reshuffle existing identities. Reuse the same asset everywhere, rather than regenerating a similar pattern for each component.
- If the available set is exhausted, permit controlled reuse rather than changing existing assignments. The exact initial set size and collision policy remain to be agreed.

The owner said “Skip for now, next.” Production design and assignment details remain deferred. The later square-tile amendment in section 31 changes only the geometry direction; it does not approve the other detailed proposals above. No new pattern sheet or assignment implementation has been created.

## 27. Mobile time capture — three-state visual draft, review pending

Carry the approved running-timer and stable stopped-entry treatment into the narrow layout. The next study covers running, stopped and manual-add states; this is responsive completion of existing workflows, not a redesign of the timer model.

- **Running:** use the existing mobile timer access/navigation, showing a full-width version of the identity header, elapsed/start time, contract and description, with Stop and Add note once a contract is selected. Hide the app-header reflection while the full timer is visible. Split remains unavailable.
- **Stopped:** Stop freezes the end immediately. Present the already approved full set of description, contract, deliverable, work-type and time fields in stable positions. Scroll the form when necessary; keep Save/Discard in an anchored local action row that does not cover the focused field or clash with the keyboard/safe area.
- **Choices:** retain browsable options and automatic sole-option selection, without an Only option annotation. Position the option menu within available screen/keyboard space rather than expanding the form and shifting subsequent fields.
- **Manual Add Entry:** reuse the same field styling and classification behaviour, with its existing Date and duration/range input. Preserve Cancel/Save wording for this separate manual-create modal.
- **Return to work:** retain the user's previous note or timesheet position. Back closes the focused mobile timer view, preserving a running timer or pending stopped entry as appropriate. Section 28 records the agreed Finish entry access for a stopped entry. Do not silently save, discard or resume time as a consequence of navigating or resizing.

The local anchored form actions do not introduce the previously rejected persistent bottom timer bar across notes. A three-state visual draft now explores the mobile presentation and keyboard-open layout; owner review is pending. Inline editing of saved entries is a subsequent supporting state to cover.

### Rendered mobile study

The owner asked whether to render or discuss; the response renders the fit around the keyboard because the core completion behaviour is already agreed.

The study places three phone canvases side by side:

1. **Running:** the selected Hungryroot identity appears above recording state, elapsed/start time and description. The first render used its chevron as a Contract selector; section 28 supersedes that interpretation and requires a separate contract-changing affordance. Add note and Stop occupy the local bottom action row. No duplicate timer reflection appears in the app header.
2. **Stopped:** the same identity header remains, with a frozen duration and all completion fields present. Deliverable and Work type show normal selected values, without any Only option annotation. Discard and Save remain anchored.
3. **Manual entry, typing:** Date, contract selection and the focused Description are visible. The remaining classification/time fields continue within the scrollable form. Cancel and Save sit immediately above the software keyboard, with enough reserved space that the focused description is unobscured.

The illustrations show the running timer at 24m18s from 09:25, then a later stopped example at 09:50 with 25m duration. Manual entry is an alternative workflow, not another save of the same timer. Names, field values, keyboard geometry and timings are illustrative.

The active manual form is shown editing Description; fields below the viewport are present, not conditionally omitted. Its depicted Save button is not a decision to relax validation. Apply the existing required-field rules and keep all entered values when the keyboard opens/closes. The local action region reserves space rather than obscuring scrollable inputs.

The focused timer canvases explore mobile timer access/return. Section 28 subsequently clarifies the desktop collapse control, mobile Back equivalent and pending stopped-entry return behaviour. These do not silently resolve or restart a draft. No source code has changed. Short screens, an open ontology menu and inline saved-entry editing still need state coverage.

Workspace render reference (generated image saved automatically): `/workspace/scratch/3968933593c9/generated_images/exec-e2140f20-e599-464a-ac24-5d0048180f4f.png`.

## 28. Timer collapse and return navigation — owner clarification

On 7 November 2026, the owner clarified that the chevron beside the timer identity reads as a desktop collapse control: the sidebar timer shrinks to a clock, graphic and client/contract subtitle. Adopt that meaning for the timer widget. The owner also accepted retaining an unfinished stopped entry when returning to work, with a way to reopen it.

### Separate presentation from timer state

| Surface/state | Open / expand | Close / collapse | State retained |
| --- | --- | --- | --- |
| Desktop sidebar, running | Activate the compact timer summary or expand chevron | Expanded widget's chevron collapses it in place | Timer keeps running; all entered details remain. |
| Desktop sidebar, stopped and unfinished | Activate the compact Finish entry summary | Collapse the expanded completion form in place | Frozen duration and entered fields remain; the compact summary identifies it as unfinished. |
| Mobile, running | Tap the compact header timer when the full timer is not visible | Back returns to the previous note or timesheet and its position | Timer keeps running; compact access is visible wherever the global visibility rule permits. |
| Mobile, stopped and unfinished | Tap Finish entry | Back returns to the previous work screen | Entry remains stopped and unsaved; reopening restores its fields. |

The compact desktop widget contains elapsed/frozen clock display, the contract motif, and a client/contract subtitle. Its collapse/expand chevron changes presentation only. A collapsed sidebar timer still counts as a visible timer, so the app header does not show a duplicate.

On mobile, Back serves the corresponding dismiss/return role. Do not add a second collapse chevron inside the focused mobile timer form. There is not a second independent mobile timer: its compact representation appears in the available sidebar or app-header location according to the existing visibility rule.

### Contract changes have a separate affordance

Do not overload the timer widget's collapse chevron with contract selection. Give changing the contract a separate explicit action in the expanded form; Change beside the contract identity is the proposed label, with exact placement still to review. A normal labelled Contract field in the manual-entry form remains a selector; it is not a collapsible timer widget.

The first mobile render's chevron beside Hungryroot is therefore not a reliable functional reference for implementation. On mobile omit the collapse control and expose contract changes separately. This is a written correction; no redraw has been requested.

### Returning after Stop

Back does not save, discard or resume the stopped entry. Preserve the one existing unfinished capture, its frozen end/duration and all entered fields. Replace the running timer reflection with Finish entry so it can be reopened. Do not show a running green state or an incrementing elapsed display for this stopped item. Retain enough contract identity to recognise it.

Save or Discard resolves the pending entry and removes Finish entry access. This extends access to the current stopped completion step; it does not introduce a queue of resumable saved entries, automatic save on Stop, or a general Resume action. Keep the previously agreed desktop Split-specific Resume behaviour separate. The manual Add Entry modal still closes through Cancel/Save.

The approved return behaviour and desktop-collapse interpretation are recorded here. Exact compact-widget composition and the separate Change control have not yet been rendered.

### Confirmed control rule

The owner explicitly confirmed this distinction with “Perfect”:

- The collapse/expand chevron belongs to the desktop sidebar timer widget, both while running and while finishing a stopped entry.
- Desktop split cards and other floating forms have no collapse chevron. Split retains its agreed Cancel/completion rules, including removal of Cancel after the left entry is resolved.
- Mobile uses Back for the equivalent return/dismiss role, preserving running or unfinished stopped state as specified above.

This confirms the control rule without requiring another render.

## 29. Inline editing — existing interaction retained; engineering follow-through

On 7 November 2026, the owner confirmed that saved time entries should continue to be edited by clicking a field, and asked for the general requirements to be recorded while leaving the control details to the engineers. This closes inline editing as a separate design-discussion item; no new mockup is required.

- Click or tap the relevant field to edit it in place. Description becomes a text input, contract/classification uses the appropriate selector, and time remains directly editable.
- Preserve field-level editing in the approved compact time-entry layout. Do not introduce an extra edit mode, whole-entry modal or additional save-all workflow as part of this reskin.
- Apply the agreed typography, colours, spacing and control styling consistently to the editing state.
- Use subtle hover and keyboard-focus cues to communicate editability. Keep controls usable by keyboard and touch; mobile must not depend on hover.
- Keep the row and neighbouring entries steady as controls appear. Avoid gratuitous shifts in columns, identity, duration or surrounding content; allow necessary expansion for text and real keyboard/viewport constraints.
- Preserve readable client/contract identity and note-link behaviour while editing other fields. Dropdown options should not reflow the entry list.
- Retain existing field dependencies, validation and commit/cancel behaviour unless implementation review identifies a concrete issue. Exact focus, keyboard, save timing and error handling are engineering details to resolve against the existing code, not newly approved interaction changes.

The scope is styling and integration of the existing interaction. Current source-dependent details remain unverified; this section does not assert an autosave-on-blur or Enter/Escape policy that has not been demonstrated.

## 30. Global search — desktop and mobile approved; input placement amended

On 7 November 2026, the owner approved the desktop search render with “Perfect” and requested a mobile version. Before the mobile render, the owner amended the search location: “make the search bar big and at top of the results” and hide the top-bar search once the results page is shown/the app routes. This amendment applies to the search page on both desktop and mobile and takes precedence over the desktop image's top-right query field.

### One query field on the results page

- Outside search, retain the global search entry point in the app header as previously agreed.
- On the dedicated search route, show one prominent query input directly above the results, spanning the results column on desktop and the available content width on mobile.
- Hide the app-header search field/control while this page is active. Do not render duplicate query inputs or reserve its old header space. Keep navigation and timer access available.
- Treat this as a route/surface rule, including loading and no-match states, rather than making it depend on a nonzero result count. Preserve the entered query when moving to the results page; implementation should maintain a smooth typing/focus handoff.
- The headerless wiki-link picker remains as specified in section 25, with its query typed inline after [[. This change concerns the dedicated global search page only.

### Approved desktop result treatment

- Keep notes and time entries in one mixed list. Lead with a note title or time-entry description and an outline document/clock icon identifying its type.
- Beneath the leading text, show the contract's standard rectangular motif and readable client/contract context. Client colour and contract pattern retain their distinct meanings.
- Put a matching excerpt below the context and use restrained ochre highlighting for matched text. A metadata match need not invent a matching excerpt phrase; client/contract-aware search follows section 25.
- Align dates in a quiet right column and make the duration of time results clearly readable. Use thin separators and consistent alignment; the active result can use pale sage fill with a narrow pine edge.
- The rendered query roles, four-note/two-time count, result texts, dates, durations and ordering are illustrative. They do not establish a ranking formula or change source data. Preserve existing result-opening behaviour.
- Show compact timer access in the header when the sidebar timer is absent, following the global single-visible-timer rule. A stopped unfinished entry uses Finish entry as already agreed.

### Mobile adaptation — approved

The owner approved the mobile render with “Great” on 7 November 2026. It uses Back to app and the compact running timer in the navigation row, with no search icon there. The large query field sits immediately below, followed by the count and mixed results. Titles and excerpts wrap; date and duration move into a compact metadata line beneath the excerpt, keeping the content width available for text. Contract patterns remain the same standard footprint across records.

The image shows the keyboard dismissed and five visible records from a six-result list; remaining records are reached by scrolling. This is a visual state, not a requirement to dismiss the keyboard automatically when results arrive. Safe areas, available viewport height and keyboard behaviour must be respected in implementation. Approval covers the mobile composition and the already agreed search-placement rule.

### References

- [Approved desktop search, with written input-placement amendment](https://chatgpt.com/library?file_id=libfile_a637993432c4819187bc5d5fc11932ad&account_id=personal). Workspace: `/workspace/scratch/3968933593c9/generated_images/exec-843751cf-6625-4c5f-88f9-0b0d89595283.png`.
- [Approved mobile search](https://chatgpt.com/library?file_id=libfile_d5556a6c29a881918bf718111ae7b85b&account_id=personal). Workspace: `/workspace/scratch/3968933593c9/generated_images/exec-c3a537fc-0e79-4b23-8e44-0a8a7ba501b5.png`.

No application code has been changed. Shared query behaviour is already banked in section 25; this section records presentation and the owner's search-input amendment.

## 31. Pattern library — square base tiles

On 7 November 2026, the owner amended the library to use “square tiles, which could tile for rectangles or wider UI components,” specifying no particular tiling designs and “just ‘square’ as the change for now.”

- The standard base unit is a square tile (1:1), replacing the earlier requirement for a horizontal rectangular base motif.
- Square tiles repeat edge to edge to compose rectangular or wider UI components. Adjacent tiles have zero gap and zero border, with no per-tile rounding at shared edges. A two-tile-wide composition reads as one continuous 2:1 rectangle; longer runs form a continuous strip.
- Specific motifs, tile dimensions, repetition direction/count and the outside edge treatment of the overall component remain open. Inter-tile spacing and borders are settled at zero. This amendment does not select a tiling design or prescribe changes to each component's layout.
- Client colour and contract pattern continue to identify context. The change concerns pattern geometry only.
- Production pattern design and assignment details remain deferred. No new render, asset sheet or implementation is requested by this amendment.

This written amendment takes precedence over earlier rectangular-base wording and motif geometry in the existing mockups. Preserve those mockups as references for their other approved layout and interaction decisions.

### Edge-to-edge clarification after the tile mood board

The owner clarified: “the tiles would be edge to edge and 0 border when next to each other.” The [square tile study](https://chatgpt.com/library?file_id=libfile_f08264035e4c8191867df02486270878&account_id=personal) incorrectly showed paired tiles as separately rounded badges with space between them. That spacing and individual badge treatment are superseded by the zero-gap, zero-border rule above. Workspace reference: `/workspace/scratch/3968933593c9/generated_images/exec-661a338d-cd8d-4ad5-b644-b9a66f2415e6.png`.

The mood board's two-tile timer, faint selected-contract band and time-entry background wash remain exploratory placement options, not approved additions. This clarification fixes how tiles join; it does not select a placement, opacity, tile artwork or requirement for motifs to connect visually across the tile boundary.


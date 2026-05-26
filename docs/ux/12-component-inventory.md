# Component Inventory

## Complete list of all Svelte components and their locations.

### Layout Components (`src/lib/components/layout/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `AppShell.svelte` | `panel1: Snippet`, `panel2: Snippet`, `panel3: Snippet` | Three-panel layout with mobile/desktop modes |
| `ContractsSidebar.svelte` | (none) | Panel 1: contracts list, actions, timer |
| `NoteListPanel.svelte` | (none) | Panel 2 (notes mode): note list with create/delete |
| `NoteEditorPanel.svelte` | (none) | Panel 3 (notes mode): editor + backlinks + attachments |
| `WeekListPanel.svelte` | (none) | Panel 2 (time mode): week summaries |
| `TimeEntriesPanel.svelte` | (none) | Panel 3 (time mode): continuous week/day scroll |
| `SidebarToggle.svelte` | (none) | Collapse/expand button for Panel 1 |

### Notes Components (`src/lib/components/notes/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `NoteEditor.svelte` | `initialContent`, `initialJson`, `noteId`, `onSave`, `onWikiLinkClick`, `onFileUpload`, `readonly` | TipTap rich text editor |
| `EditorToolbar.svelte` | `editor: Editor`, `onAttachFile` | Formatting toolbar |
| `LinkedTimeEntries.svelte` | `noteId: string` | Shows/unlinks time entries for a note |
| `AttachmentList.svelte` | `noteId: string` | Shows/deletes attachments for a note |

### Timer Components (`src/lib/components/timer/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `TimerWidget.svelte` | (none) | Full timer lifecycle (idle/running/paused/stopped) |
| `TimerDisplay.svelte` | `elapsedSeconds: number`, `isPaused?: boolean` | HH:MM:SS monospace display |
| `TimerCompletionForm.svelte` | `startTime`, `endTime`, `elapsedSeconds`, `initialContractId`, `initialDescription`, `onSave`, `onDiscard` | Stopped timer form |
| `CascadingSelects.svelte` | `selectedContractId`, `selectedDeliverableId`, `selectedWorkTypeId` (all bindable) | Contract > Deliverable > Work Type dropdowns |
| `ContractSelect.svelte` | `selectedContractId` (bindable), `compact?: boolean` | Standalone contract dropdown |
| `AddTimeEntryModal.svelte` | `onCreated`, `onClose` | Modal for manual time entry |

### Weekly Components (`src/lib/components/weekly/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `WeekSectionHeader.svelte` | `weekStart`, `weeklyTotalMinutes`, `currentStatus`, `onStatusChange` | Week heading + editable status |
| `TimeEntryCard.svelte` | `entry: EntryData`, `onUpdated?` | Inline-editable entry card |
| `NewEntryRow.svelte` | `date`, `onEntryCreated`, `onCancel` | Inline new entry form |
| `DaySection.svelte` | `dayGroup: DayGroupData` | Day header + entries (legacy) |
| `WeekHeader.svelte` | `weekStart`, `weeklyTotalMinutes`, `currentStatus`, nav callbacks | Week header with nav (legacy) |
| `WeeklyEntryRow.svelte` | `entry: EntryData` | Entry row with inline time edit (legacy) |

### Admin Components (`src/lib/components/admin/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `AdminBreadcrumb.svelte` | `items: BreadcrumbItem[]` | Breadcrumb navigation |
| `ClientRow.svelte` | `client` | Inline-editable client table row |
| `ContractRow.svelte` | `contract`, `clientId` | Inline-editable contract card |
| `ContractCreateModal.svelte` | `clients`, `onCreated`, `onClose` | Modal for creating contracts |
| `DeliverableCard.svelte` | `deliverable`, `actionBase` | Deliverable with nested work types |
| `WorkTypeRow.svelte` | `workType`, `deliverableId`, `actionBase` | Inline-editable work type |

### Time Components (`src/lib/components/time/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `TimeEntryRow.svelte` | `entry` | Read-only entry row (legacy) |

## TipTap Extensions (`src/lib/components/notes/extensions/`)

| File | Purpose |
|------|---------|
| `wiki-link.ts` | Custom WikiLink node for `[[NOTE.ID]]` syntax |
| `anchored-heading.ts` | Heading extension with auto-generated anchor IDs |
| `attachment-resolver.ts` | Resolves `chronolog://` URLs to blob URLs |
| `SuggestionDropdown.ts` | Dropdown UI for wiki-link suggestions |

## Route Pages

| Route | Page Component | Layout |
|-------|---------------|--------|
| `/` | `+page.svelte` | Three-panel AppShell |
| `/login` | `+page.svelte` | Standalone centered form |
| `/register` | `+page.svelte` | Standalone centered form |
| `/settings/two-factor` | `+page.svelte` | Standalone centered content |
| `/admin` | `+page.svelte` | Admin layout |
| `/admin/clients` | `+page.svelte` | Admin layout |
| `/admin/clients/[clientId]` | `+page.svelte` | Admin layout |
| `/admin/clients/[clientId]/contracts/[contractId]` | `+page.svelte` | Admin layout |
| `/time/new` | `+page.svelte` | Standalone with custom header |
| `/spike` | `+page.svelte` | Standalone monospace page |

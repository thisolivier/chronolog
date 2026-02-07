/**
 * Example test/usage demonstration for navigation state.
 *
 * This file demonstrates how the navigation state would be used in practice.
 * It can be adapted into actual tests using a testing framework.
 */

import {
	createNavigationState,
	type NavigationContext,
	type NavigationMode
} from './navigation.svelte';

/**
 * Basic usage example showing all features.
 */
function demonstrateBasicUsage() {
	const nav = createNavigationState();

	// Initial state verification
	console.assert(nav.mode === 'time-entries', 'Initial mode should be time-entries');
	console.assert(nav.isTimeEntriesMode === true, 'Should be in time entries mode');
	console.assert(nav.isNotesMode === false, 'Should not be in notes mode');
	console.assert(nav.selectedContractId === null, 'No contract selected initially');
	console.assert(nav.selectedWeek !== null, 'Week should be set to current week');
	console.assert(nav.panel1Collapsed === false, 'Sidebar should start expanded');
	console.assert(nav.mobileNavigationLevel === 0, 'Mobile nav should start at 0');

	// Test switching to notes mode
	nav.selectContract('contract-123', 'client-456');
	console.assert(nav.mode === 'notes', 'Mode should switch to notes');
	console.assert(nav.isNotesMode === true, 'Should be in notes mode');
	console.assert(nav.selectedContractId === 'contract-123', 'Contract ID should be set');
	console.assert(nav.selectedClientId === 'client-456', 'Client ID should be set');

	// Test switching back to time entries
	nav.selectTimeEntries();
	console.assert(nav.mode === 'time-entries', 'Mode should switch back to time-entries');
	console.assert(nav.selectedContractId === null, 'Contract should be cleared');
	console.assert(nav.selectedClientId === null, 'Client should be cleared');

	// Test week selection
	nav.selectWeek('2026-02-03');
	console.assert(nav.selectedWeek === '2026-02-03', 'Week should be updated');

	// Test note selection
	nav.selectNote('note-789');
	console.assert(nav.selectedNoteId === 'note-789', 'Note ID should be set');

	// Test sidebar toggle
	nav.toggleSidebar();
	console.assert(nav.isSidebarCollapsed === true, 'Sidebar should be collapsed');
	nav.toggleSidebar();
	console.assert(nav.isSidebarCollapsed === false, 'Sidebar should be expanded again');

	// Test mobile navigation
	nav.navigateMobile(1);
	console.assert(nav.mobileNavigationLevel === 1, 'Mobile level should be 1');
	nav.navigateMobile(2);
	console.assert(nav.mobileNavigationLevel === 2, 'Mobile level should be 2');
	nav.goBackMobile();
	console.assert(nav.mobileNavigationLevel === 1, 'Mobile level should go back to 1');
	nav.goBackMobile();
	console.assert(nav.mobileNavigationLevel === 0, 'Mobile level should go back to 0');
	nav.goBackMobile(); // Should not go below 0
	console.assert(nav.mobileNavigationLevel === 0, 'Mobile level should stay at 0');

	console.log('✓ All basic usage tests passed!');
}

/**
 * Demonstrate workflow for time entries mode.
 */
function demonstrateTimeEntriesWorkflow() {
	const nav = createNavigationState();

	// User starts in time entries mode viewing current week
	console.assert(nav.isTimeEntriesMode, 'Should start in time entries mode');

	// User navigates to a different week
	nav.selectWeek('2026-01-27');
	console.assert(nav.selectedWeek === '2026-01-27', 'Week should update');

	// User navigates forward a week
	nav.selectWeek('2026-02-03');
	console.assert(nav.selectedWeek === '2026-02-03', 'Week should update forward');

	console.log('✓ Time entries workflow tests passed!');
}

/**
 * Demonstrate workflow for notes mode.
 */
function demonstrateNotesWorkflow() {
	const nav = createNavigationState();

	// User clicks on a contract to view its notes
	nav.selectContract('contract-abc', 'client-xyz');
	console.assert(nav.isNotesMode, 'Should switch to notes mode');
	console.assert(nav.selectedContractId === 'contract-abc', 'Contract should be selected');

	// User clicks on a note to view it in Panel 3
	nav.selectNote('note-001');
	console.assert(nav.selectedNoteId === 'note-001', 'Note should be selected');

	// User clicks another note
	nav.selectNote('note-002');
	console.assert(nav.selectedNoteId === 'note-002', 'Note should update');

	// User switches to a different contract
	nav.selectContract('contract-def', 'client-xyz');
	console.assert(nav.selectedContractId === 'contract-def', 'Contract should update');
	console.assert(nav.selectedNoteId === null, 'Note should be cleared when switching contracts');

	// User goes back to time entries
	nav.selectTimeEntries();
	console.assert(nav.isTimeEntriesMode, 'Should switch back to time entries mode');
	console.assert(nav.selectedContractId === null, 'Contract should be cleared');

	console.log('✓ Notes workflow tests passed!');
}

/**
 * Demonstrate mobile navigation workflow.
 */
function demonstrateMobileWorkflow() {
	const nav = createNavigationState();

	// Start at contracts list (level 0)
	console.assert(nav.mobileNavigationLevel === 0, 'Start at level 0');

	// User taps a contract to see its week list
	nav.selectContract('contract-123', 'client-456');
	nav.navigateMobile(1);
	console.assert(nav.mobileNavigationLevel === 1, 'Advance to level 1');

	// User taps a week to see time entries
	nav.navigateMobile(2);
	console.assert(nav.mobileNavigationLevel === 2, 'Advance to level 2');

	// User taps back button
	nav.goBackMobile();
	console.assert(nav.mobileNavigationLevel === 1, 'Go back to level 1');

	// User taps back button again
	nav.goBackMobile();
	console.assert(nav.mobileNavigationLevel === 0, 'Go back to level 0');

	console.log('✓ Mobile workflow tests passed!');
}

// Run all demonstrations
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe('Navigation State', () => {
		it('should have correct initial state', () => {
			const nav = createNavigationState();
			expect(nav.mode).toBe('time-entries');
			expect(nav.isTimeEntriesMode).toBe(true);
			expect(nav.isNotesMode).toBe(false);
			expect(nav.selectedContractId).toBeNull();
			expect(nav.selectedWeek).toBeTruthy();
			expect(nav.panel1Collapsed).toBe(false);
			expect(nav.mobileNavigationLevel).toBe(0);
		});

		it('should switch to notes mode when selecting a contract', () => {
			const nav = createNavigationState();
			nav.selectContract('contract-123', 'client-456');
			expect(nav.mode).toBe('notes');
			expect(nav.selectedContractId).toBe('contract-123');
			expect(nav.selectedClientId).toBe('client-456');
		});

		it('should clear contract when switching to time entries', () => {
			const nav = createNavigationState();
			nav.selectContract('contract-123', 'client-456');
			nav.selectTimeEntries();
			expect(nav.mode).toBe('time-entries');
			expect(nav.selectedContractId).toBeNull();
			expect(nav.selectedClientId).toBeNull();
		});

		it('should toggle sidebar correctly', () => {
			const nav = createNavigationState();
			expect(nav.panel1Collapsed).toBe(false);
			nav.toggleSidebar();
			expect(nav.panel1Collapsed).toBe(true);
			nav.toggleSidebar();
			expect(nav.panel1Collapsed).toBe(false);
		});

		it('should handle mobile navigation correctly', () => {
			const nav = createNavigationState();
			nav.navigateMobile(1);
			expect(nav.mobileNavigationLevel).toBe(1);
			nav.goBackMobile();
			expect(nav.mobileNavigationLevel).toBe(0);
			nav.goBackMobile(); // Should not go below 0
			expect(nav.mobileNavigationLevel).toBe(0);
		});

		it('should clear note selection when switching contracts', () => {
			const nav = createNavigationState();
			nav.selectContract('contract-123', 'client-456');
			nav.selectNote('note-789');
			expect(nav.selectedNoteId).toBe('note-789');
			nav.selectContract('contract-abc', 'client-456');
			expect(nav.selectedNoteId).toBeNull();
		});
	});
}

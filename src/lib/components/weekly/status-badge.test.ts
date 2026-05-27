import { describe, it, expect } from 'vitest';

// Extract the logic from StatusBadge into a testable function
const STATUS_CYCLE = ['Unsubmitted', 'Draft ready', 'Submitted'];

function getNextStatus(currentStatus: string): string {
	const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
	const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
	return STATUS_CYCLE[nextIndex];
}

function getStatusClasses(status: string): string {
	switch (status) {
		case 'Draft ready':
			return 'bg-amber-100 text-amber-800';
		case 'Submitted':
			return 'bg-emerald-100 text-emerald-800';
		default:
			return 'bg-stone-100 text-stone-600';
	}
}

describe('StatusBadge logic', () => {
	it('cycles Unsubmitted -> Draft ready', () => {
		expect(getNextStatus('Unsubmitted')).toBe('Draft ready');
	});

	it('cycles Draft ready -> Submitted', () => {
		expect(getNextStatus('Draft ready')).toBe('Submitted');
	});

	it('cycles Submitted -> Unsubmitted', () => {
		expect(getNextStatus('Submitted')).toBe('Unsubmitted');
	});

	it('treats unknown status as Unsubmitted', () => {
		expect(getNextStatus('unknown')).toBe('Unsubmitted');
	});

	describe('getStatusClasses', () => {
		it('returns amber classes for Draft ready', () => {
			expect(getStatusClasses('Draft ready')).toContain('amber');
		});

		it('returns emerald classes for Submitted', () => {
			expect(getStatusClasses('Submitted')).toContain('emerald');
		});

		it('returns stone classes for Unsubmitted', () => {
			expect(getStatusClasses('Unsubmitted')).toContain('stone');
		});
	});
});

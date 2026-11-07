import { describe, it, expect } from 'vitest';
import { missingDetailFor, missingDetailAction } from './missing-detail';

describe('missingDetailFor (TR-05)', () => {
	const base = { contractHasDeliverables: true, deliverableId: null, deliverableHasWorkTypes: false, workTypeId: null };

	it('asks for a deliverable only when the contract has some', () => {
		expect(missingDetailFor(base)).toBe('deliverable');
		expect(missingDetailFor({ ...base, contractHasDeliverables: false })).toBeNull();
	});

	it('asks for a work type only when the chosen deliverable has some', () => {
		expect(missingDetailFor({ ...base, deliverableId: 'd1', deliverableHasWorkTypes: true })).toBe('work-type');
		expect(missingDetailFor({ ...base, deliverableId: 'd1', deliverableHasWorkTypes: false })).toBeNull();
	});

	it('is quiet when everything offered is filled in', () => {
		expect(missingDetailFor({ ...base, deliverableId: 'd1', deliverableHasWorkTypes: true, workTypeId: 'w1' })).toBeNull();
	});

	it('words the action', () => {
		expect(missingDetailAction('deliverable')).toBe('Add deliverable');
		expect(missingDetailAction('work-type')).toBe('Add work type');
	});
});

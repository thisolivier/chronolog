import { describe, expect, it } from 'vitest';
import { FINISH_FIRST_PART_REASON, resizeDecisionFor, splitActionsFor } from './split-rules';

describe('split actions per stage (SP-04, SP-05, SP-06)', () => {
	it('both unresolved: left Save/Discard, right Stop, Flip and Cancel; right completion locked with a reason', () => {
		expect(splitActionsFor('editing', true)).toEqual({
			leftResolve: true,
			rightStop: true,
			rightResolve: false,
			rightResolveReason: FINISH_FIRST_PART_REASON,
			flipAndCancel: true
		});
	});

	it('a stopped right has no Stop', () => {
		expect(splitActionsFor('editing', false).rightStop).toBe(false);
	});

	it('while the left request is in flight nothing else can start', () => {
		expect(splitActionsFor('left-saving', true)).toMatchObject({ leftResolve: false, rightStop: false, rightResolve: false, flipAndCancel: false });
	});

	it('left resolved: right Save/Discard/Resume unlock; Flip and Cancel are gone', () => {
		expect(splitActionsFor('resolved', true)).toEqual({
			leftResolve: false,
			rightStop: true,
			rightResolve: true,
			rightResolveReason: '',
			flipAndCancel: false
		});
	});
});

describe('crossing into the small layout (SP-07)', () => {
	it.each([
		['editing', 'cancel'],
		['left-saving', 'wait'],
		['resolved', 'return-remainder'],
		['right-busy', 'wait'],
		['closed', 'nothing']
	] as const)('%s → %s', (phase, decision) => {
		expect(resizeDecisionFor(phase)).toBe(decision);
	});
});

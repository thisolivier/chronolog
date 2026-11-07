import { describe, expect, it } from 'vitest';
import { matchReason } from './search-match-reason';

const identity = { clientName: 'Amplitude', clientShortCode: 'AMP', contractName: 'Hungryroot' };

describe('matchReason', () => {
	it('names the one identity field a metadata-only hit matched', () => {
		expect(matchReason({ ...identity, matchedIn: 'context', matchedContext: ['clientName'] })).toBe('Matches client Amplitude');
		expect(matchReason({ ...identity, matchedIn: 'context', matchedContext: ['clientShortCode'] })).toBe('Matches client code AMP');
	});

	it('joins several fields and says the client once', () => {
		expect(
			matchReason({ ...identity, matchedIn: 'context', matchedContext: ['clientName', 'clientShortCode', 'contractName'] })
		).toBe('Matches client Amplitude and contract Hungryroot');
		expect(
			matchReason({
				...identity,
				deliverableName: 'Roadmap',
				workTypeName: 'Workshop',
				matchedIn: 'context',
				matchedContext: ['contractName', 'deliverableName', 'workTypeName']
			})
		).toBe('Matches contract Hungryroot, deliverable Roadmap and work type Workshop');
	});

	it('gives no reason when the record text matched', () => {
		expect(matchReason({ ...identity, matchedIn: 'body', matchedContext: ['clientName'] })).toBeNull();
		expect(matchReason({ ...identity, matchedIn: 'title', matchedContext: [] })).toBeNull();
		expect(matchReason({ ...identity, matchedIn: 'context', matchedContext: [] })).toBeNull();
	});
});

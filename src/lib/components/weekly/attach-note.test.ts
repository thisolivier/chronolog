import { describe, expect, it, vi } from 'vitest';
import { appendWikiLinkToDescription, attachNewNoteToEntry, attachNoteBlockedReason } from './attach-note';
import { splitFormerlyLines } from './formerly-lines';

describe('appendWikiLinkToDescription', () => {
	it('adds the link after a space at the end of the text', () => {
		expect(appendWikiLinkToDescription('Call with Ana', 'ACME.20261105.001')).toBe('Call with Ana [[ACME.20261105.001]]');
	});

	it('is the link alone for an empty or missing description', () => {
		expect(appendWikiLinkToDescription('', 'A.1')).toBe('[[A.1]]');
		expect(appendWikiLinkToDescription(null, 'A.1')).toBe('[[A.1]]');
		expect(appendWikiLinkToDescription(undefined, 'A.1')).toBe('[[A.1]]');
	});

	it('drops trailing whitespace before the space', () => {
		expect(appendWikiLinkToDescription('Review  \n', 'A.1')).toBe('Review [[A.1]]');
	});

	it('keeps earlier links and adds the new one', () => {
		expect(appendWikiLinkToDescription('See [[A.1]]', 'A.2')).toBe('See [[A.1]] [[A.2]]');
	});

	it('leaves a description that already links the note unchanged', () => {
		expect(appendWikiLinkToDescription('See [[A.1]] today', 'A.1')).toBe('See [[A.1]] today');
	});

	it('puts the link before the "Formerly" lines, which stay last', () => {
		const linked = appendWikiLinkToDescription('Workshop\nFormerly: Old contract', 'A.1');
		expect(linked).toBe('Workshop [[A.1]]\nFormerly: Old contract');
		expect(splitFormerlyLines(linked)).toEqual({ body: 'Workshop [[A.1]]', formerlyLines: ['Formerly: Old contract'] });
		expect(appendWikiLinkToDescription('Formerly: Old contract', 'A.1')).toBe('[[A.1]]\nFormerly: Old contract');
	});
});

describe('attachNoteBlockedReason', () => {
	it('blocks only an entry without a contract', () => {
		expect(attachNoteBlockedReason('contract-1')).toBeNull();
		expect(attachNoteBlockedReason('')).toMatch(/contract/);
		expect(attachNoteBlockedReason(null)).toMatch(/contract/);
	});
});

describe('attachNewNoteToEntry', () => {
	it('creates an empty note on the contract, then saves the linked description', async () => {
		const calls: string[] = [];
		const dataService = {
			createNote: vi.fn(async (contractId: string) => {
				calls.push(`create ${contractId}`);
				return { id: 'ACME.20261105.002' } as Awaited<ReturnType<import('$lib/services/data-service').DataService['createNote']>>;
			}),
			updateTimeEntry: vi.fn(async (entryId: string) => {
				calls.push(`update ${entryId}`);
			})
		};
		const result = await attachNewNoteToEntry(dataService, { entryId: 'entry-1', contractId: 'contract-1', description: 'Planning' });
		expect(calls).toEqual(['create contract-1', 'update entry-1']);
		expect(dataService.createNote).toHaveBeenCalledWith('contract-1', {});
		expect(dataService.updateTimeEntry).toHaveBeenCalledWith('entry-1', { description: 'Planning [[ACME.20261105.002]]' });
		expect(result).toEqual({ noteId: 'ACME.20261105.002', description: 'Planning [[ACME.20261105.002]]' });
	});

	it('does not touch the entry when the note cannot be created', async () => {
		const dataService = {
			createNote: vi.fn(async () => {
				throw new Error('POST /api/notes failed (403): {"message":"nope"}');
			}),
			updateTimeEntry: vi.fn()
		};
		await expect(attachNewNoteToEntry(dataService, { entryId: 'e', contractId: 'c', description: '' })).rejects.toThrow('403');
		expect(dataService.updateTimeEntry).not.toHaveBeenCalled();
	});
});

import { describe, expect, it } from 'vitest';
import { formatSearchResult, markMatches, search } from './search.mjs';
import { UsageError } from '../lib/args.mjs';

const result = {
	query: 'budget',
	notes: {
		total: 3,
		hits: [
			{
				id: 'ACME.20261104.001',
				title: 'Budget plan',
				clientShortCode: 'ACME',
				contractName: 'Website',
				updatedAt: '2026-11-04T09:00:00.000Z',
				snippet: { text: 'The budget is set', matches: [{ start: 4, end: 10 }] }
			}
		]
	},
	timeEntries: {
		total: 1,
		hits: [
			{
				id: 'e-1',
				date: '2026-11-03',
				durationMinutes: 90,
				clientShortCode: 'ACME',
				contractName: 'Website',
				snippet: { text: 'Budget call', matches: [{ start: 0, end: 6 }] }
			}
		]
	}
};

describe('chronolog search', () => {
	it('marks matches in a snippet', () => {
		expect(markMatches({ text: 'a budget b budget', matches: [{ start: 2, end: 8 }, { start: 11, end: 17 }] })).toBe(
			'a »budget« b »budget«'
		);
	});

	it('prints the Notes and Time entries groups with counts and snippets', () => {
		expect(formatSearchResult(result).split('\n')).toEqual([
			'Notes (1 of 3)',
			'  ACME.20261104.001  ACME/Website  2026-11-04  Budget plan',
			'      The »budget« is set',
			'',
			'Time entries (1)',
			'  2026-11-03   1h30m  ACME/Website  »Budget« call  (e-1)'
		]);
	});

	it('calls /api/search with the query and limit, and passes the JSON through', async () => {
		const calls = [];
		const printed = [];
		const api = { get: async (path) => (calls.push(path), result) };
		await search({ api, print: (text, json) => printed.push({ text, json }), positionals: ['budget', 'plan'], flags: { limit: '5' } });
		expect(calls).toEqual(['/api/search?q=budget%20plan&limit=5']);
		expect(printed[0].json).toBe(result);
		expect(printed[0].text).toContain('Time entries (1)');
	});

	it('refuses a query under two characters', async () => {
		await expect(search({ api: {}, print: () => {}, positionals: ['x'], flags: {} })).rejects.toBeInstanceOf(UsageError);
	});
});

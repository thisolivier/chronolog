import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	listTimeEntriesForDate,
	deleteTimeEntry
} from '$lib/server/db/queries/time-entries';

export const load: PageServerLoad = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const dateParam = url.searchParams.get('date');
	const selectedDate = dateParam || new Date().toISOString().split('T')[0];

	const entriesForDate = await listTimeEntriesForDate(currentUser.id, selectedDate);

	const totalMinutes = entriesForDate.reduce(
		(sum, entry) => sum + entry.durationMinutes,
		0
	);

	return {
		entries: entriesForDate,
		selectedDate,
		totalMinutes
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const entryId = formData.get('entry_id')?.toString();

		if (!entryId) {
			return fail(400, { error: 'Entry ID is required.' });
		}

		const deletedEntry = await deleteTimeEntry(entryId, currentUser.id);
		if (!deletedEntry) {
			return fail(404, { error: 'Time entry not found.' });
		}

		return { success: true };
	}
};

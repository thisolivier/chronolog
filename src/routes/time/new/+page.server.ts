import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { createTimeEntry, updateTimeEntry } from '$lib/server/db/queries/time-entries';
import { database, timeEntries } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const editId = url.searchParams.get('edit');
	const defaultDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

	let existingEntry = null;
	if (editId) {
		const results = await database
			.select()
			.from(timeEntries)
			.where(and(eq(timeEntries.id, editId), eq(timeEntries.userId, currentUser.id)))
			.limit(1);
		existingEntry = results[0] ?? null;
	}

	return {
		defaultDate,
		existingEntry
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const entryId = formData.get('entry_id')?.toString();
		const contractId = formData.get('contract_id')?.toString();
		const deliverableId = formData.get('deliverable_id')?.toString() || null;
		const workTypeId = formData.get('work_type_id')?.toString() || null;
		const date = formData.get('date')?.toString();
		const startTime = formData.get('start_time')?.toString() || null;
		const endTime = formData.get('end_time')?.toString() || null;
		const manualDuration = formData.get('manual_duration')?.toString();
		const description = formData.get('description')?.toString() || null;

		if (!contractId) {
			return fail(400, { error: 'Contract is required.' });
		}
		if (!date) {
			return fail(400, { error: 'Date is required.' });
		}

		// Calculate duration
		let durationMinutes = 0;

		if (manualDuration) {
			// Parse hh:mm format
			const durationParts = manualDuration.split(':');
			const durationHours = parseInt(durationParts[0], 10) || 0;
			const durationMins = parseInt(durationParts[1], 10) || 0;
			durationMinutes = durationHours * 60 + durationMins;
		} else if (startTime && endTime) {
			// Calculate from start/end times
			const startParts = startTime.split(':').map(Number);
			const endParts = endTime.split(':').map(Number);
			const startTotalMinutes = startParts[0] * 60 + startParts[1];
			const endTotalMinutes = endParts[0] * 60 + endParts[1];
			durationMinutes = Math.max(0, endTotalMinutes - startTotalMinutes);
		}

		if (durationMinutes <= 0) {
			return fail(400, {
				error: 'Duration must be greater than zero. Enter start/end times or a manual duration.'
			});
		}

		const entryData = {
			contractId,
			deliverableId,
			workTypeId,
			date,
			startTime,
			endTime,
			durationMinutes,
			description,
			isDraft: false
		};

		if (entryId) {
			// Update existing entry
			const updatedEntry = await updateTimeEntry(entryId, currentUser.id, entryData);
			if (!updatedEntry) {
				return fail(404, { error: 'Time entry not found.' });
			}
		} else {
			// Create new entry
			await createTimeEntry({
				userId: currentUser.id,
				...entryData
			});
		}

		throw redirect(303, `/time?date=${date}`);
	}
};

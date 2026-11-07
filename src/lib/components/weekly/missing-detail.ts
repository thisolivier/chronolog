/**
 * Local missing-detail cue for one entry (sprint 057-DR, TR-05). Shown at the entry, with an
 * action, whenever the contract offers options for a level and that field is empty. Never a
 * filter, queue or review step; it does not change validation (both fields stay optional).
 */
export type MissingDetail = 'deliverable' | 'work-type' | null;

export function missingDetailFor(options: {
	contractHasDeliverables: boolean;
	deliverableId: string | null | undefined;
	deliverableHasWorkTypes: boolean;
	workTypeId: string | null | undefined;
}): MissingDetail {
	if (!options.deliverableId) return options.contractHasDeliverables ? 'deliverable' : null;
	if (!options.workTypeId && options.deliverableHasWorkTypes) return 'work-type';
	return null;
}

/** The cue's words */
export function missingDetailAction(missing: Exclude<MissingDetail, null>): string {
	return missing === 'deliverable' ? 'Add deliverable' : 'Add work type';
}

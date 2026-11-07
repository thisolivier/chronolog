/**
 * Why a metadata-only hit matched (059-DR, SR-02/SR-03): "Matches client Amplitude". The server
 * lists the identity fields that held query words the record's own text lacks (`matchedContext`);
 * a hit that matched only there has no highlighted excerpt, so the row names the reason instead.
 */
import type { ContextField } from '$lib/search/record-matcher';

type ReasonSource = {
	matchedIn: string;
	matchedContext: ContextField[];
	clientName: string;
	clientShortCode: string;
	contractName: string;
	deliverableName?: string | null;
	workTypeName?: string | null;
};

const FIELD_LABELS: Record<ContextField, string> = {
	clientName: 'client',
	clientShortCode: 'client code',
	contractName: 'contract',
	deliverableName: 'deliverable',
	workTypeName: 'work type'
};

function fieldValue(source: ReasonSource, field: ContextField): string {
	if (field === 'deliverableName') return source.deliverableName ?? '';
	if (field === 'workTypeName') return source.workTypeName ?? '';
	return source[field];
}

/** "Matches client Amplitude and contract Hungryroot"; null unless the hit matched only its identity */
export function matchReason(source: ReasonSource): string | null {
	if (source.matchedIn !== 'context' || source.matchedContext.length === 0) return null;
	// The client's name and its code name the same thing: say the name once
	const fields = source.matchedContext.filter(
		(field) => !(field === 'clientShortCode' && source.matchedContext.includes('clientName'))
	);
	const parts = fields.map((field) => `${FIELD_LABELS[field]} ${fieldValue(source, field)}`.trim());
	if (parts.length === 1) return `Matches ${parts[0]}`;
	return `Matches ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Initials for a contract mark (design r1, DS-02): up to three characters from the contract
 * name. Contracts have no short code in the data model (only clients do), so the name is the
 * source. Filler words are skipped unless nothing else is left.
 *
 *   "Rank Group" -> "RG", "National Debt Relief" -> "NDR", "Hungryroot" -> "HU",
 *   "Phase 2" -> "P2", "Ad hoc & support" -> "AHS", "" -> "?"
 */
const FILLER_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'with']);
const MAX_INITIALS = 3;

export function contractInitials(contractName: string): string {
	const words = contractName.match(/[\p{L}\p{N}]+/gu) ?? [];
	if (words.length === 0) return '?';
	const meaningfulWords = words.filter((word) => !FILLER_WORDS.has(word.toLowerCase()));
	const sourceWords = meaningfulWords.length > 0 ? meaningfulWords : words;
	if (sourceWords.length === 1) {
		const onlyWord = sourceWords[0];
		// A short code-like word ("CCX", "Q4") is kept whole; otherwise its first two letters
		const isCodeLike = onlyWord.length <= MAX_INITIALS && onlyWord === onlyWord.toUpperCase();
		return (isCodeLike ? onlyWord : onlyWord.slice(0, 2)).toUpperCase();
	}
	return sourceWords
		.slice(0, MAX_INITIALS)
		.map((word) => (/^\p{N}+$/u.test(word) ? word.slice(0, 2) : word[0]))
		.join('')
		.slice(0, MAX_INITIALS)
		.toUpperCase();
}

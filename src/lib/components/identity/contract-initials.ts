/**
 * Initials for a contract mark (design r1, DS-02): up to three characters from the contract
 * name. Contracts have no short code in the data model (only clients do), so the name is the
 * source. Filler words are skipped unless nothing else is left.
 *
 *   "Rank Group" -> "RG", "National Debt Relief" -> "NDR", "Hungryroot" -> "HU",
 *   "Phase 2" -> "P2", "Ad hoc & support" -> "AHS", "" -> "?"
 */
/** First `count` code points, so an astral letter is never split in half */
function firstCodePoints(text: string, count: number): string {
	return Array.from(text).slice(0, count).join('');
}

/** First letter with its combining marks ("e" + U+0301 stays one initial) */
function firstGrapheme(word: string): string {
	return word.match(/^\P{M}\p{M}*/u)?.[0] ?? firstCodePoints(word, 1);
}

const FILLER_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'with']);
const MAX_INITIALS = 3;

export function contractInitials(contractName: string): string {
	const words = contractName.normalize('NFC').match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
	if (words.length === 0) return '?';
	const meaningfulWords = words.filter((word) => !FILLER_WORDS.has(word.toLowerCase()));
	const sourceWords = meaningfulWords.length > 0 ? meaningfulWords : words;
	if (sourceWords.length === 1) {
		const onlyWord = sourceWords[0];
		// A short code-like word ("CCX", "Q4") is kept whole; otherwise its first two letters
		const isCodeLike = Array.from(onlyWord).length <= MAX_INITIALS && onlyWord === onlyWord.toUpperCase();
		const letters = isCodeLike ? onlyWord : firstGrapheme(onlyWord) + firstGrapheme(onlyWord.slice(firstGrapheme(onlyWord).length));
		return limitToInitials(letters.toUpperCase());
	}
	const initials = sourceWords
		.slice(0, MAX_INITIALS)
		.map((word) => (/^\p{N}+$/u.test(word) ? firstCodePoints(word, 2) : firstGrapheme(word)))
		.join('');
	return limitToInitials(initials.toUpperCase());
}

/** Uppercasing can lengthen text ("ß" -> "SS"); cap at three letters, keeping marks with them */
function limitToInitials(text: string): string {
	const letters = text.match(/\P{M}\p{M}*/gu) ?? [];
	return letters.slice(0, MAX_INITIALS).join('');
}

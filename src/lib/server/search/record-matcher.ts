/**
 * The shared search matcher is pure, so it lives in `$lib/search/record-matcher.ts` where the
 * offline picker fallback can use it too; server code imports it from here.
 */
export * from '$lib/search/record-matcher';

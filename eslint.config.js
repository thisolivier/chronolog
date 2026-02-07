import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			// Tauri desktop app with no base path — resolve() adds no value
			'svelte/no-navigation-without-resolve': 'off',
			// Allow unused params/vars/caught errors prefixed with underscore (standard convention)
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			],
		},
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
			},
		},
	},
	{
		// ESLint cannot parse Svelte 5 rune type declarations in .svelte.ts files
		ignores: ['**/*.svelte.ts'],
	},
	{
		// Test files use inline vitest functions that look unused to ESLint
		files: ['**/*.test.ts', '**/*.spec.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': 'off',
		},
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'src-tauri/'],
	},
);

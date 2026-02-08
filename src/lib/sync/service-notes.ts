/**
 * Notes Service Methods — SyncedDataService Mixin
 *
 * Extracted from SyncedDataService to keep file sizes manageable.
 * Provides CRUD operations for notes with online/offline fallback.
 */

import type { StorageAdapter } from '$lib/storage';
import type { NoteSummary, NoteDetail, NoteUpdateData } from './data-types';
import { queryNotesForContract, queryNoteById, generateNoteIdLocally } from './local-queries';

export interface NotesMixin {
	getNotesForContract(contractId: string): Promise<NoteSummary[]>;
	getNoteById(noteId: string): Promise<NoteDetail | null>;
	createNote(contractId: string): Promise<{ note: NoteDetail }>;
	updateNote(noteId: string, data: NoteUpdateData): Promise<NoteDetail | null>;
	deleteNote(noteId: string): Promise<void>;
}

/**
 * Fetch notes for a contract. Online: server API. Offline: local storage.
 */
export async function fetchNotesForContract(
	storage: StorageAdapter,
	isOnline: boolean,
	contractId: string
): Promise<NoteSummary[]> {
	if (isOnline) {
		try {
			const response = await fetch(
				`/api/notes?contractId=${encodeURIComponent(contractId)}`
			);
			if (!response.ok) throw new Error('Server error');
			const data = await response.json();
			return data.notes ?? [];
		} catch {
			// Fall through to local
		}
	}
	return queryNotesForContract(storage, contractId);
}

/**
 * Fetch a single note by ID. Online: server API. Offline: local storage.
 */
export async function fetchNoteById(
	storage: StorageAdapter,
	isOnline: boolean,
	noteId: string
): Promise<NoteDetail | null> {
	if (isOnline) {
		try {
			const response = await fetch(`/api/notes/${noteId}`);
			if (!response.ok) throw new Error('Server error');
			const data = await response.json();
			return data.note ?? null;
		} catch {
			// Fall through to local
		}
	}
	return queryNoteById(storage, noteId);
}

/**
 * Create a new note. Online: server API. Offline: generate ID locally.
 */
export async function createNoteAction(
	storage: StorageAdapter,
	isOnline: boolean,
	contractId: string,
	enqueueMutation: (table: string, entityId: string, operation: 'upsert' | 'delete', data: Record<string, unknown>) => Promise<void>
): Promise<{ note: NoteDetail }> {
	if (isOnline) {
		try {
			const response = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId })
			});
			if (!response.ok) throw new Error('Server error');
			const data = await response.json();
			// Cache the created note locally
			await storage.put('notes', {
				id: data.note.id,
				userId: '',
				contractId,
				title: data.note.title ?? null,
				content: data.note.content ?? null,
				contentJson: data.note.contentJson ?? null,
				wordCount: data.note.wordCount ?? 0,
				isPinned: data.note.isPinned ?? false,
				createdAt: data.note.createdAt,
				updatedAt: data.note.updatedAt
			});
			return data;
		} catch {
			// Fall through to offline creation
		}
	}

	// Offline: generate ID locally
	const noteId = await generateNoteIdLocally(storage, contractId);
	const now = new Date().toISOString();
	const noteRow = {
		id: noteId,
		userId: '',
		contractId,
		title: null,
		content: null,
		contentJson: null,
		wordCount: 0,
		isPinned: false,
		createdAt: now,
		updatedAt: now
	};

	await storage.put('notes', noteRow);
	await enqueueMutation('notes', noteId, 'upsert', noteRow);

	return {
		note: {
			id: noteId,
			title: null,
			content: null,
			contentJson: null,
			contractId,
			wordCount: 0,
			isPinned: false,
			createdAt: now,
			updatedAt: now
		}
	};
}

/**
 * Update a note. Online: server API + local cache. Offline: local + queue.
 */
export async function updateNoteAction(
	storage: StorageAdapter,
	isOnline: boolean,
	noteId: string,
	data: NoteUpdateData,
	enqueueMutation: (table: string, entityId: string, operation: 'upsert' | 'delete', data: Record<string, unknown>) => Promise<void>
): Promise<NoteDetail | null> {
	const now = new Date().toISOString();

	if (isOnline) {
		try {
			const response = await fetch(`/api/notes/${noteId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!response.ok) throw new Error('Server error');
			const result = await response.json();
			// Update local cache
			const existingNote = await storage.getById('notes', noteId);
			if (existingNote) {
				const updatedRow = { ...existingNote, ...data, updatedAt: now };
				await storage.put('notes', updatedRow);
			}
			return result.note ?? null;
		} catch {
			// Fall through to offline
		}
	}

	// Offline: update local and queue
	const existingNote = await storage.getById('notes', noteId);
	if (!existingNote) return null;

	const updatedRow = { ...existingNote, ...data, updatedAt: now };
	await storage.put('notes', updatedRow);
	await enqueueMutation('notes', noteId, 'upsert', updatedRow);

	return {
		id: updatedRow.id,
		title: updatedRow.title,
		content: updatedRow.content,
		contentJson: updatedRow.contentJson,
		contractId: updatedRow.contractId,
		wordCount: updatedRow.wordCount,
		isPinned: updatedRow.isPinned,
		createdAt: updatedRow.createdAt,
		updatedAt: updatedRow.updatedAt
	};
}

/**
 * Delete a note. Online: server API. Offline: local delete + queue.
 */
export async function deleteNoteAction(
	storage: StorageAdapter,
	isOnline: boolean,
	noteId: string,
	enqueueMutation: (table: string, entityId: string, operation: 'upsert' | 'delete', data: Record<string, unknown>) => Promise<void>
): Promise<void> {
	if (isOnline) {
		try {
			const response = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('Server error');
			await storage.delete('notes', noteId);
			return;
		} catch {
			// Fall through to offline
		}
	}

	await storage.delete('notes', noteId);
	await enqueueMutation('notes', noteId, 'delete', { id: noteId });
}

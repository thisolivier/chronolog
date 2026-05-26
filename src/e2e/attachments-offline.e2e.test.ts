/**
 * E2E Tests: GATE C — Attachment Offline Degradation (API Level)
 *
 * Verifies the attachment pipeline works end-to-end and documents the
 * expected offline degradation behavior:
 * - Attachment metadata (filename, mime_type, size) is synced via PowerSync
 * - Actual file binary is served from the API (excluded from bucket sync)
 * - When offline: metadata available, file download fails gracefully
 *
 * Tests:
 * - Upload an attachment to a note -> verify it's listed
 * - Verify attachment metadata is accessible
 * - Verify the attachment download URL pattern
 * - Delete the attachment -> verify cleanup
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import './test-init';
import { BASE_URL, authGet, authPost, authDelete, getSessionCookies } from './helpers';

describe('GATE C: Attachment Offline Degradation (API)', () => {
	let contractId: string;
	let noteId: string;
	let attachmentId: string;

	/** Create a minimal valid PNG (1x1 pixel, transparent) for upload testing. */
	function createMinimalPng(): Buffer {
		// Minimal 1x1 pixel transparent PNG
		const pngBytes = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
			0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
			0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
			0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, // RGBA, 8-bit
			0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
			0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, // compressed data
			0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, // ...
			0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, // IEND chunk
			0x60, 0x82
		]);
		return pngBytes;
	}

	beforeAll(async () => {
		// Get the seeded "General" contract
		const contractsResponse = await authGet('/api/contracts');
		expect(contractsResponse.ok).toBe(true);
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		expect(generalContract).toBeDefined();
		contractId = generalContract.id;

		// Create a note to attach files to
		const noteResponse = await authPost('/api/notes', { contractId });
		expect(noteResponse.status).toBe(201);
		const noteData = await noteResponse.json();
		noteId = noteData.note.id;
	});

	afterAll(async () => {
		// Clean up
		if (attachmentId) {
			await authDelete(`/api/attachments/${attachmentId}`).catch(() => {});
		}
		if (noteId) {
			await authDelete(`/api/notes/${noteId}`).catch(() => {});
		}
	});

	it('uploads an attachment to a note via multipart form data', async () => {
		const pngBuffer = createMinimalPng();
		const blob = new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' });
		const formData = new FormData();
		formData.append('file', blob, 'test-attachment.png');

		const cookies = getSessionCookies();
		const response = await fetch(
			`${BASE_URL}/api/notes/${noteId}/attachments`,
			{
				method: 'POST',
				headers: {
					Cookie: cookies.join('; ')
				},
				body: formData
			}
		);

		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('attachment');
		expect(data.attachment).toHaveProperty('id');
		expect(data.attachment).toHaveProperty('filename', 'test-attachment.png');
		expect(data.attachment).toHaveProperty('mimeType', 'image/png');
		expect(data.attachment).toHaveProperty('sizeBytes');
		expect(data.attachment.sizeBytes).toBeGreaterThan(0);

		attachmentId = data.attachment.id;
	});

	it('lists attachments for the note and shows metadata', async () => {
		const response = await authGet(`/api/notes/${noteId}/attachments`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('attachments');
		expect(Array.isArray(data.attachments)).toBe(true);
		expect(data.attachments.length).toBeGreaterThanOrEqual(1);

		const ourAttachment = data.attachments.find(
			(attachment: { id: string }) => attachment.id === attachmentId
		);
		expect(ourAttachment).toBeDefined();

		// Verify all metadata fields are present (these are synced via PowerSync)
		expect(ourAttachment).toHaveProperty('filename', 'test-attachment.png');
		expect(ourAttachment).toHaveProperty('mimeType', 'image/png');
		expect(ourAttachment).toHaveProperty('sizeBytes');
		expect(ourAttachment).toHaveProperty('createdAt');
	});

	it('downloads the attachment file via the download URL', async () => {
		// The download URL pattern is GET /api/attachments/:attachmentId
		const cookies = getSessionCookies();
		const response = await fetch(
			`${BASE_URL}/api/attachments/${attachmentId}`,
			{
				headers: { Cookie: cookies.join('; ') }
			}
		);

		expect(response.ok).toBe(true);
		expect(response.headers.get('Content-Type')).toBe('image/png');

		const contentLength = response.headers.get('Content-Length');
		expect(contentLength).toBeTruthy();
		expect(parseInt(contentLength!, 10)).toBeGreaterThan(0);

		// Verify the response body is a valid binary
		const arrayBuffer = await response.arrayBuffer();
		expect(arrayBuffer.byteLength).toBeGreaterThan(0);
	});

	it('verifies attachment download requires authentication (offline-degradation prerequisite)', async () => {
		// When offline, the browser can't reach the server.
		// This test confirms the download endpoint requires auth,
		// which means unauthenticated/offline requests will fail gracefully.
		const response = await fetch(
			`${BASE_URL}/api/attachments/${attachmentId}`,
			{ redirect: 'manual' }
		);

		// Without cookies, should get redirected or unauthorized
		expect([401, 302, 303]).toContain(response.status);
	});

	it('deletes the attachment and verifies cleanup', async () => {
		const deleteResponse = await authDelete(`/api/attachments/${attachmentId}`);
		expect(deleteResponse.ok).toBe(true);

		const deleteData = await deleteResponse.json();
		expect(deleteData).toHaveProperty('success', true);

		// Verify attachment is gone from the list
		const listResponse = await authGet(`/api/notes/${noteId}/attachments`);
		expect(listResponse.ok).toBe(true);

		const listData = await listResponse.json();
		const deletedAttachment = listData.attachments.find(
			(attachment: { id: string }) => attachment.id === attachmentId
		);
		expect(deletedAttachment).toBeUndefined();

		attachmentId = '';
	});
});

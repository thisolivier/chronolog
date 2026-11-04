/**
 * Small, valid attachment files for the API e2e and Playwright tests (sprint 036-CL): a one-page
 * PDF with a correct xref table and a 1x1 PNG. Written with Buffers so no fixture files are stored.
 */
import { deflateSync } from 'node:zlib';

/** A one-page PDF that shows `text`; offsets in the xref table are computed, so viewers open it cleanly. */
export function minimalPdf(text = 'Chronolog test PDF'): Buffer {
	const escaped = text.replace(/([()\\])/g, '\\$1');
	const stream = `BT /F1 24 Tf 72 720 Td (${escaped}) Tj ET`;
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
	];
	let body = '%PDF-1.4\n';
	const offsets: number[] = [];
	objects.forEach((object, index) => {
		offsets.push(Buffer.byteLength(body));
		body += `${index + 1} 0 obj\n${object}\nendobj\n`;
	});
	const xrefOffset = Buffer.byteLength(body);
	body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
	body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
	return Buffer.from(body, 'latin1');
}

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(typeAndData));
	return Buffer.concat([length, typeAndData, checksum]);
}

/** A valid square PNG of one colour (RGB), `size` pixels wide. */
export function minimalPng(size = 8, rgb: [number, number, number] = [37, 99, 235]): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8; // bit depth
	header[9] = 2; // colour type RGB
	const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
	const pixels = Buffer.concat(Array.from({ length: size }, () => row));
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', header),
		pngChunk('IDAT', deflateSync(pixels)),
		pngChunk('IEND', Buffer.alloc(0))
	]);
}

#!/usr/bin/env node
/**
 * Draws the Chronolog desktop icons as PNGs with no dependencies (no brand assets exist).
 *
 *   node src-tauri/scripts/draw-icons.mjs
 *   npx tauri icon src-tauri/icons/app-icon.png    # regenerates the bundle icons from it
 *
 * Outputs, in src-tauri/icons/:
 *   app-icon.png       1024 px source for `tauri icon`: white clock on a blue rounded square
 *   tray-template.png  44 px monochrome menu-bar template (black on transparent, 22 pt @2x)
 *   app-icon-ios.png   1024 px iOS source: the same clock, full bleed and opaque (iOS masks the
 *                      corners itself and App Store validation rejects alpha). Regenerate the
 *                      iOS set with `npx tauri icon src-tauri/icons/app-icon-ios.png -o <tmp>`
 *                      and copy `<tmp>/ios/*` into gen/apple/Assets.xcassets/AppIcon.appiconset/
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const iconsDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

// -- PNG encoding (RGBA, 8 bit) --

const crcTable = Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	return value >>> 0;
});

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(typeAndData));
	return Buffer.concat([length, typeAndData, checksum]);
}

function encodePng(size, rgbaPixels) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8; // bit depth
	header[9] = 6; // colour type RGBA
	const rows = Buffer.alloc(size * (size * 4 + 1));
	for (let row = 0; row < size; row++) {
		rows[row * (size * 4 + 1)] = 0; // filter: none
		rgbaPixels.copy(rows, row * (size * 4 + 1) + 1, row * size * 4, (row + 1) * size * 4);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', header),
		pngChunk('IDAT', deflateSync(rows, { level: 9 })),
		pngChunk('IEND', Buffer.alloc(0))
	]);
}

// -- Shapes, in unit coordinates (0..1 across the canvas) --

const insideCircle = (centerX, centerY, radius) => (x, y) =>
	(x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;

const insideRing = (centerX, centerY, outerRadius, innerRadius) => (x, y) => {
	const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;
	return distanceSquared <= outerRadius ** 2 && distanceSquared >= innerRadius ** 2;
};

/** A stroke from (startX, startY) to (endX, endY) with round caps */
const insideStroke = (startX, startY, endX, endY, halfWidth) => (x, y) => {
	const segmentX = endX - startX;
	const segmentY = endY - startY;
	const along = Math.max(
		0,
		Math.min(1, ((x - startX) * segmentX + (y - startY) * segmentY) / (segmentX ** 2 + segmentY ** 2))
	);
	return (x - startX - along * segmentX) ** 2 + (y - startY - along * segmentY) ** 2 <= halfWidth ** 2;
};

const insideRoundedSquare = (left, top, side, cornerRadius) => (x, y) => {
	if (x < left || y < top || x > left + side || y > top + side) return false;
	const nearestX = Math.max(left + cornerRadius, Math.min(x, left + side - cornerRadius));
	const nearestY = Math.max(top + cornerRadius, Math.min(y, top + side - cornerRadius));
	return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= cornerRadius ** 2;
};

/** Clock glyph centred at (0.5, 0.5): ring, hour hand to ten o'clock, minute hand to twelve */
function clockShapes(faceRadius, ringWidth) {
	const handWidth = ringWidth / 2;
	const hourAngle = (-60 * Math.PI) / 180; // ten o'clock, measured from twelve
	return [
		insideRing(0.5, 0.5, faceRadius, faceRadius - ringWidth),
		insideStroke(0.5, 0.5, 0.5, 0.5 - faceRadius * 0.62, handWidth),
		insideStroke(
			0.5,
			0.5,
			0.5 + Math.sin(hourAngle) * faceRadius * 0.45,
			0.5 - Math.cos(hourAngle) * faceRadius * 0.45,
			handWidth
		),
		insideCircle(0.5, 0.5, handWidth * 1.4)
	];
}

/** Render layers of { shapes, colour: [r, g, b] } with 4x4 supersampling */
function render(size, layers) {
	const pixels = Buffer.alloc(size * size * 4);
	const samplesPerAxis = 4;
	for (let pixelY = 0; pixelY < size; pixelY++) {
		for (let pixelX = 0; pixelX < size; pixelX++) {
			let red = 0;
			let green = 0;
			let blue = 0;
			let alpha = 0;
			for (let sampleY = 0; sampleY < samplesPerAxis; sampleY++) {
				for (let sampleX = 0; sampleX < samplesPerAxis; sampleX++) {
					const x = (pixelX + (sampleX + 0.5) / samplesPerAxis) / size;
					const y = (pixelY + (sampleY + 0.5) / samplesPerAxis) / size;
					// Topmost layer that covers this sample wins
					for (let layerIndex = layers.length - 1; layerIndex >= 0; layerIndex--) {
						const layer = layers[layerIndex];
						if (layer.shapes.some((shape) => shape(x, y))) {
							red += layer.colour[0];
							green += layer.colour[1];
							blue += layer.colour[2];
							alpha += 1;
							break;
						}
					}
				}
			}
			const offset = (pixelY * size + pixelX) * 4;
			if (alpha > 0) {
				pixels[offset] = Math.round(red / alpha);
				pixels[offset + 1] = Math.round(green / alpha);
				pixels[offset + 2] = Math.round(blue / alpha);
				pixels[offset + 3] = Math.round((alpha / samplesPerAxis ** 2) * 255);
			}
		}
	}
	return encodePng(size, pixels);
}

// macOS icon grid: an 824 px body inside the 1024 px canvas
const appIcon = render(1024, [
	{ shapes: [insideRoundedSquare(100 / 1024, 100 / 1024, 824 / 1024, 185 / 1024)], colour: [37, 99, 235] },
	{ shapes: clockShapes(0.27, 0.05), colour: [255, 255, 255] }
]);
writeFileSync(join(iconsDirectory, 'app-icon.png'), appIcon);

// iOS: full-bleed opaque square (every pixel covered by the background layer, so alpha is 255)
const iosAppIcon = render(1024, [
	{ shapes: [() => true], colour: [37, 99, 235] },
	{ shapes: clockShapes(0.32, 0.06), colour: [255, 255, 255] }
]);
writeFileSync(join(iconsDirectory, 'app-icon-ios.png'), iosAppIcon);

const trayTemplate = render(44, [{ shapes: clockShapes(0.44, 0.1), colour: [0, 0, 0] }]);
writeFileSync(join(iconsDirectory, 'tray-template.png'), trayTemplate);

console.log(`Wrote app-icon.png, app-icon-ios.png and tray-template.png to ${iconsDirectory}`);

import assert from 'node:assert/strict';
import test from 'node:test';
import { computeContextMenuPosition } from '../webview/ui/components/events/ContextMenuPosition';

test('context menu positioning keeps oversized menus inside the viewport padding', () => {
	const position = computeContextMenuPosition(150, 250, 220, 1000, 8, 320, 600);
	assert.equal(position.top, 8);
	assert.ok(position.left >= 8);
});

test('context menu positioning uses a fitting candidate before clamping', () => {
	assert.deepEqual(
		computeContextMenuPosition(20, 20, 100, 80, 8, 500, 400),
		{ left: 20, top: 20 },
	);
});

test('context menu positioning clamps both axes when the anchor is near the edge', () => {
	assert.deepEqual(
		computeContextMenuPosition(490, 390, 120, 100, 8, 500, 400),
		{ left: 370, top: 290 },
	);
});

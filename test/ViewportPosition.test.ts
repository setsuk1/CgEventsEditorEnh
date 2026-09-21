import assert from 'node:assert/strict';
import test from 'node:test';
import { clampViewportCoordinate } from '../webview/ui/utils/viewportPosition';

test('viewport coordinate clamp keeps a normal overlay inside the padded viewport', () => {
	assert.equal(clampViewportCoordinate(-5, 100, 8, 500), 8);
	assert.equal(clampViewportCoordinate(450, 100, 8, 500), 392);
	assert.equal(clampViewportCoordinate(120, 100, 8, 500), 120);
});

test('viewport coordinate clamp never returns a negative coordinate for oversized overlays', () => {
	assert.equal(clampViewportCoordinate(50, 800, 8, 500), 8);
	assert.equal(clampViewportCoordinate(-100, 800, 8, 500), 8);
});

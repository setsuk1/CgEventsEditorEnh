import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSuggestionDropdownLayout } from '../webview/ui/components/inputs/SuggestionDropdownLayout';

test('suggestion dropdown layout keeps normal anchors inside the viewport', () => {
	assert.deepEqual(
		resolveSuggestionDropdownLayout(
			{ left: 280, top: 70, bottom: 100, width: 100 },
			{ width: 320, height: 240 },
		),
		{ left: 212, width: 100, maxHeight: 132, placeBelow: true },
	);
});

test('suggestion dropdown layout never produces negative width or oversized minimum height', () => {
	const layout = resolveSuggestionDropdownLayout(
		{ left: 0, top: 25, bottom: 35, width: 100 },
		{ width: 10, height: 60 },
	);
	assert.equal(layout.width, 0);
	assert.equal(layout.left, 5);
	assert.equal(layout.maxHeight, 17);
	assert.equal(layout.placeBelow, true);
});

test('suggestion dropdown layout chooses the side with more available height', () => {
	assert.deepEqual(
		resolveSuggestionDropdownLayout(
			{ left: 20, top: 180, bottom: 210, width: 120 },
			{ width: 400, height: 240 },
		),
		{ left: 20, width: 120, maxHeight: 172, placeBelow: false },
	);
});

test('suggestion dropdown layout clamps malformed dimensions', () => {
	const layout = resolveSuggestionDropdownLayout(
		{ left: Number.NaN, top: Number.NaN, bottom: Number.NaN, width: -20 },
		{ width: Number.NaN, height: Number.POSITIVE_INFINITY },
	);
	assert.deepEqual(layout, { left: 0, width: 0, maxHeight: 0, placeBelow: true });
});

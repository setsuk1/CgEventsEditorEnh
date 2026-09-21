import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeClampedIndex, resolveRelativeIndex } from '../webview/editor/editorIndex';

test('clamped indexes reject non-finite values and normalize finite values', () => {
	assert.equal(normalizeClampedIndex(Number.NaN, 3), undefined);
	assert.equal(normalizeClampedIndex(Number.POSITIVE_INFINITY, 3), undefined);
	assert.equal(normalizeClampedIndex(1, Number.NaN), undefined);
	assert.equal(normalizeClampedIndex(1, -1), undefined);
	assert.equal(normalizeClampedIndex(-2, 3), 0);
	assert.equal(normalizeClampedIndex(1.9, 3), 1);
	assert.equal(normalizeClampedIndex(99, 3), 3);
});

test('relative indexes reject invalid moves and normalize fractional deltas', () => {
	assert.equal(resolveRelativeIndex(1, Number.NaN, 3), undefined);
	assert.equal(resolveRelativeIndex(1, Number.POSITIVE_INFINITY, 3), undefined);
	assert.equal(resolveRelativeIndex(0, -1, 3), undefined);
	assert.equal(resolveRelativeIndex(2, 1, 3), undefined);
	assert.equal(resolveRelativeIndex(1, 1.9, 4), 2);
	assert.equal(resolveRelativeIndex(2, -1.2, 4), 0);
});

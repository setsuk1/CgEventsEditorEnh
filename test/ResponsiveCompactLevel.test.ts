import assert from 'node:assert/strict';
import test from 'node:test';
import {
	normalizeCompactLevel,
	reconcileCompactLevel,
} from '../webview/ui/components/events/ResponsiveLayout';

test('compact level normalization clamps malformed and out-of-range values', () => {
	assert.equal(normalizeCompactLevel(null, 5), 0);
	assert.equal(normalizeCompactLevel('3.9', 5), 3);
	assert.equal(normalizeCompactLevel('-2', 5), 0);
	assert.equal(normalizeCompactLevel('99', 4), 4);
	assert.equal(normalizeCompactLevel('invalid', 4), 0);
	assert.equal(normalizeCompactLevel('2', Number.NaN), 0);
});

test('compact level reconciliation grows until overflow clears', () => {
	let applied = 0;
	const levels: number[] = [];
	const result = reconcileCompactLevel(
		'0',
		5,
		(level) => {
			applied = level;
			levels.push(level);
		},
		() => applied < 3,
	);

	assert.equal(result, 3);
	assert.deepEqual(levels, [0, 1, 2, 3]);
});

test('compact level reconciliation shrinks while preserving the last fitting level', () => {
	let applied = 5;
	const levels: number[] = [];
	const result = reconcileCompactLevel(
		'5',
		5,
		(level) => {
			applied = level;
			levels.push(level);
		},
		() => applied < 3,
	);

	assert.equal(result, 3);
	assert.deepEqual(levels, [5, 4, 3, 2, 3]);
});

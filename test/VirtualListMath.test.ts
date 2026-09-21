import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildVirtualListLayout,
	computeVirtualListPadding,
	computeVirtualListRange,
	findVirtualListIndexAtOffset,
} from '../webview/ui/components/events/VirtualListMath';

test('virtual list layout builds prefix sums with inter-item gaps', () => {
	const heights = [100, 200, 50];
	const layout = buildVirtualListLayout(heights.length, (index) => heights[index], 10);

	assert.deepEqual(layout.prefixSums, [0, 110, 320, 370]);
	assert.equal(layout.totalHeight, 370);
});

test('virtual list offset lookup respects item boundaries', () => {
	const prefix = [0, 110, 320, 370];
	assert.equal(findVirtualListIndexAtOffset(prefix, 370, 3, 0), 0);
	assert.equal(findVirtualListIndexAtOffset(prefix, 370, 3, 109), 0);
	assert.equal(findVirtualListIndexAtOffset(prefix, 370, 3, 110), 1);
	assert.equal(findVirtualListIndexAtOffset(prefix, 370, 3, 319), 1);
	assert.equal(findVirtualListIndexAtOffset(prefix, 370, 3, 320), 2);
	assert.equal(findVirtualListIndexAtOffset(prefix, 370, 3, 999), 2);
});

test('virtual list range applies overscan and handles empty lists', () => {
	const prefix = [0, 110, 320, 370];

	assert.deepEqual(
		computeVirtualListRange(prefix, 370, 3, 105, 210, 1),
		{ start: 0, end: 3 },
	);
	assert.deepEqual(
		computeVirtualListRange([0], 0, 0, 100, 300, 6),
		{ start: 0, end: 0 },
	);
});

test('virtual list padding preserves the gap after the rendered window', () => {
	const prefix = [0, 110, 320, 370];

	assert.deepEqual(
		computeVirtualListPadding(prefix, 370, 3, 1, 2, 10),
		{ top: 110, bottom: 60 },
	);
	assert.deepEqual(
		computeVirtualListPadding(prefix, 370, 3, 0, 3, 10),
		{ top: 0, bottom: 0 },
	);
});

test('virtual list math normalizes non-finite dimensions instead of producing NaN', () => {
	const layout = buildVirtualListLayout(3, (index) => [100, Number.NaN, Number.POSITIVE_INFINITY][index], Number.NaN);

	assert.deepEqual(layout.prefixSums, [0, 100, 100, 100]);
	assert.equal(layout.totalHeight, 100);
	assert.deepEqual(
		computeVirtualListRange(layout.prefixSums, layout.totalHeight, 3, Number.NaN, Number.POSITIVE_INFINITY, Number.NaN),
		{ start: 0, end: 1 },
	);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventLogicBlock } from '../shared/events';
import {
	computeLoopBreakUpdates,
	getLoopBreaks,
	getLoopState,
	normalizeLoopBreaks,
} from '../webview/ui/components/events/LogicItemsListCheckMeta';

function block(data?: Record<string, unknown>): ICgEventLogicBlock {
	return { type: 'sample', data };
}

test('loop break normalization keeps only finite non-negative integers', () => {
	assert.equal(normalizeLoopBreaks(undefined), 0);
	assert.equal(normalizeLoopBreaks(Number.NaN), 0);
	assert.equal(normalizeLoopBreaks(Number.POSITIVE_INFINITY), 0);
	assert.equal(normalizeLoopBreaks(-2), 0);
	assert.equal(normalizeLoopBreaks(2.9), 2);
	assert.equal(getLoopBreaks({ _loopBreaks: 3.8 }), 3);
});

test('loop state only treats boolean donotActOnEachPass values as loops', () => {
	assert.deepEqual(getLoopState(), { isLoop: false, showSigma: false });
	assert.deepEqual(getLoopState({ donotActOnEachPass: false }), { isLoop: true, showSigma: false });
	assert.deepEqual(getLoopState({ donotActOnEachPass: true }), { isLoop: true, showSigma: true });
	assert.deepEqual(getLoopState({ donotActOnEachPass: 'true' }), { isLoop: false, showSigma: false });
});

test('loop break cascade increases the selected break and clamps following breaks', () => {
	const items = [
		block({ donotActOnEachPass: false }),
		block({ donotActOnEachPass: true }),
		block({ _loopBreaks: 0 }),
		block({ _loopBreaks: 2 }),
	];

	assert.deepEqual(computeLoopBreakUpdates(items, 2, 1), [
		{ index: 2, breaks: 1 },
		{ index: 3, breaks: 1 },
	]);
});

test('loop break cascade is a no-op for invalid increments and indexes', () => {
	const items = [block({ donotActOnEachPass: false }), block({ _loopBreaks: 0 })];

	assert.deepEqual(computeLoopBreakUpdates(items, 1, Number.NaN), []);
	assert.deepEqual(computeLoopBreakUpdates(items, 1, Number.POSITIVE_INFINITY), []);
	assert.deepEqual(computeLoopBreakUpdates(items, 1, 0), []);
	assert.deepEqual(computeLoopBreakUpdates(items, -1, 1), []);
	assert.deepEqual(computeLoopBreakUpdates(items, items.length, 1), []);
});

test('loop break cascade does not invent data objects for blocks without data', () => {
	const items = [
		block({ donotActOnEachPass: false }),
		block(),
		block({ _loopBreaks: 1 }),
	];

	assert.deepEqual(computeLoopBreakUpdates(items, 1, 1), []);
});

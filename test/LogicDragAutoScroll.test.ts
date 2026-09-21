import assert from 'node:assert/strict';
import test from 'node:test';
import { computeLogicDragAutoScrollDelta } from '../webview/ui/components/events/LogicItemsListInteraction';

const bounds = { top: 100, bottom: 500 };

test('drag auto-scroll is idle away from container edges', () => {
	assert.equal(computeLogicDragAutoScrollDelta(300, bounds), 0);
	assert.equal(computeLogicDragAutoScrollDelta(180, bounds), 0);
	assert.equal(computeLogicDragAutoScrollDelta(420, bounds), 0);
});

test('drag auto-scroll accelerates toward the top edge', () => {
	assert.equal(computeLogicDragAutoScrollDelta(100, bounds), -20);
	assert.equal(computeLogicDragAutoScrollDelta(140, bounds), -10);
	assert.equal(computeLogicDragAutoScrollDelta(179, bounds), -4);
});

test('drag auto-scroll accelerates toward the bottom edge', () => {
	assert.equal(computeLogicDragAutoScrollDelta(500, bounds), 20);
	assert.equal(computeLogicDragAutoScrollDelta(460, bounds), 10);
	assert.equal(computeLogicDragAutoScrollDelta(421, bounds), 4);
});

test('drag auto-scroll rejects invalid or out-of-bounds pointers', () => {
	assert.equal(computeLogicDragAutoScrollDelta(99, bounds), 0);
	assert.equal(computeLogicDragAutoScrollDelta(501, bounds), 0);
	assert.equal(computeLogicDragAutoScrollDelta(Number.NaN, bounds), 0);
	assert.equal(computeLogicDragAutoScrollDelta(120, { top: 500, bottom: 100 }), 0);
});

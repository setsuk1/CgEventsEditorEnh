import assert from 'node:assert/strict';
import test from 'node:test';
import { planLogicSelectionMove } from '../webview/ui/components/events/LogicSelectionMove';

test('contiguous same-event drops inside the selected range are no-ops', () => {
	const selection = [
		{ eventId: 'event-a', index: 1 },
		{ eventId: 'event-a', index: 2 },
	];

	assert.equal(planLogicSelectionMove(selection, 'event-a', 1), undefined);
	assert.equal(planLogicSelectionMove(selection, 'event-a', 2), undefined);
	assert.equal(planLogicSelectionMove(selection, 'event-a', 3), undefined);
});

test('non-contiguous same-event selections can move inside their outer bounds', () => {
	const selection = [
		{ eventId: 'event-a', index: 0 },
		{ eventId: 'event-a', index: 2 },
	];

	assert.deepEqual(planLogicSelectionMove(selection, 'event-a', 2), { targetIndex: 1 });
});

test('moving into an event adjusts the insertion index for selected items removed before it', () => {
	const selection = [
		{ eventId: 'event-a', index: 1 },
		{ eventId: 'event-b', index: 0 },
	];

	assert.deepEqual(planLogicSelectionMove(selection, 'event-a', 2), { targetIndex: 1 });
	assert.deepEqual(planLogicSelectionMove(selection, 'event-c', 2), { targetIndex: 2 });
});

test('invalid move targets are rejected', () => {
	const selection = [{ eventId: 'event-a', index: 0 }];

	assert.equal(planLogicSelectionMove([], 'event-a', 0), undefined);
	assert.equal(planLogicSelectionMove(selection, '', 0), undefined);
	assert.equal(planLogicSelectionMove(selection, 'event-a', Number.NaN), undefined);
	assert.equal(planLogicSelectionMove(selection, 'event-a', Number.POSITIVE_INFINITY), undefined);
});

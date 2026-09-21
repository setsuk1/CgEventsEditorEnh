import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEvent } from '../shared/events';
import {
	moveLogicBlockByDelta,
	moveLogicBlockToEvent,
	moveLogicBlockToIndex,
} from '../webview/editor/LogicBlockMoveMutations';

function event(id: string, actions: string[]): ICgEvent {
	return {
		id,
		triggers: [],
		checks: [],
		actions: actions.map((type) => ({ type, data: {} })),
	};
}

test('relative logic moves preserve block identity and unaffected events', () => {
	const eventA = event('event-a', ['one', 'two', 'three']);
	const eventB = event('event-b', ['four']);
	const events = [eventA, eventB];
	const movedBlock = eventA.actions[0];

	const result = moveLogicBlockByDelta(events, 'actions', 0, 0, 2);

	assert.ok(result);
	assert.strictEqual(result.previousEvents, events);
	assert.deepEqual(result.nextEvents[0].actions.map((block) => block.type), ['two', 'three', 'one']);
	assert.strictEqual(result.nextEvents[0].actions[2], movedBlock);
	assert.strictEqual(result.nextEvents[1], eventB);
	assert.equal(result.sourceIndex, 0);
	assert.equal(result.targetIndex, 2);
});

test('indexed logic moves clamp targets and reject true no-ops', () => {
	const eventA = event('event-a', ['one', 'two', 'three']);

	const moved = moveLogicBlockToIndex([eventA], 'actions', 0, 0, 99);
	assert.ok(moved);
	assert.equal(moved.targetIndex, 2);
	assert.deepEqual(moved.nextEvents[0].actions.map((block) => block.type), ['two', 'three', 'one']);

	assert.equal(moveLogicBlockToIndex([eventA], 'actions', 0, 1, 1), undefined);
	assert.equal(moveLogicBlockToIndex([eventA], 'actions', 0, 99, 0), undefined);
	assert.equal(moveLogicBlockToIndex([eventA], 'actions', 0, 0, Number.NaN), undefined);
});

test('cross-event logic moves preserve the moved block reference', () => {
	const eventA = event('event-a', ['one', 'two']);
	const eventB = event('event-b', ['three']);
	const movedBlock = eventA.actions[1];

	const result = moveLogicBlockToEvent(
		[eventA, eventB],
		'actions',
		0,
		1,
		1,
		0,
	);

	assert.ok(result);
	assert.deepEqual(result.nextEvents[0].actions.map((block) => block.type), ['one']);
	assert.deepEqual(result.nextEvents[1].actions.map((block) => block.type), ['two', 'three']);
	assert.strictEqual(result.nextEvents[1].actions[0], movedBlock);
	assert.equal(result.sourceEventId, 'event-a');
	assert.equal(result.targetEventId, 'event-b');
	assert.equal(result.sourceIndex, 1);
	assert.equal(result.targetIndex, 0);
});

test('same-event destination moves reuse indexed move semantics', () => {
	const eventA = event('event-a', ['one', 'two', 'three']);

	const result = moveLogicBlockToEvent(
		[eventA],
		'actions',
		0,
		0,
		0,
	);

	assert.ok(result);
	assert.deepEqual(result.nextEvents[0].actions.map((block) => block.type), ['two', 'three', 'one']);
	assert.equal(result.targetIndex, 2);
});

test('single logic moves reject missing events and invalid relative movement', () => {
	const eventA = event('event-a', ['one']);

	assert.equal(moveLogicBlockByDelta([eventA], 'actions', -1, 0, 1), undefined);
	assert.equal(moveLogicBlockByDelta([eventA], 'actions', 0, 0, Number.NaN), undefined);
	assert.equal(moveLogicBlockToEvent([eventA], 'actions', 0, 0, -1, 0), undefined);
});

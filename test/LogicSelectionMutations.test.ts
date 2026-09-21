import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEvent } from '../shared/events';
import {
	insertLogicBlocks,
	moveLogicSelectionToBoundary,
	moveLogicSelectionToEvent,
	removeLogicSelection,
	toggleLogicSelectionDisabled,
} from '../webview/editor/LogicSelectionMutations';

function createEvent(
	id: string,
	actions: Array<{ type: string; disabled?: unknown }>,
): ICgEvent {
	return {
		id,
		triggers: [],
		checks: [],
		actions: actions.map(({ type, disabled }) => ({
			type,
			data: disabled === undefined ? {} : { disabled },
		})),
	};
}

test('logic selection removal normalizes indexes and preserves unaffected event references', () => {
	const eventA = createEvent('event-a', [
		{ type: 'one' },
		{ type: 'two' },
		{ type: 'three' },
	]);
	const eventB = createEvent('event-b', [{ type: 'four' }]);
	const events = [eventA, eventB];

	const result = removeLogicSelection(events, 'actions', [
		{ eventId: 'event-a', index: 1.9 },
		{ eventId: 'event-a', index: 1.1 },
		{ eventId: 'event-a', index: Number.NaN },
		{ eventId: 'event-a', index: -1 },
		{ eventId: 'event-a', index: 99 },
		{ eventId: 'missing', index: 0 },
	]);

	assert.ok(result);
	assert.strictEqual(result.previousEvents, events);
	assert.deepEqual(result.affectedEventIds, ['event-a']);
	assert.deepEqual(result.nextEvents[0].actions.map((block) => block.type), ['one', 'three']);
	assert.strictEqual(result.nextEvents[1], eventB);
});

test('logic selection disabled toggles clone only selected blocks and preserve legacy truthiness semantics', () => {
	const event = createEvent('event-a', [
		{ type: 'one', disabled: false },
		{ type: 'two', disabled: false },
		{ type: 'three', disabled: 'legacy-truthy' },
	]);
	const first = event.actions[0];
	const middle = event.actions[1];
	const third = event.actions[2];

	const result = toggleLogicSelectionDisabled([event], 'actions', [
		{ eventId: 'event-a', index: 0 },
		{ eventId: 'event-a', index: 2 },
	]);

	assert.ok(result);
	assert.equal(result.blockReplacements.length, 2);
	assert.notStrictEqual(result.nextEvents[0].actions[0], first);
	assert.strictEqual(result.nextEvents[0].actions[1], middle);
	assert.notStrictEqual(result.nextEvents[0].actions[2], third);
	assert.equal(result.nextEvents[0].actions[0].data?.disabled, true);
	assert.equal(result.nextEvents[0].actions[2].data?.disabled, false);
});

test('logic selection boundary moves preserve section order and skip true no-ops', () => {
	const event = createEvent('event-a', [
		{ type: 'one' },
		{ type: 'two' },
		{ type: 'three' },
	]);

	const moved = moveLogicSelectionToBoundary([event], 'actions', [
		{ eventId: 'event-a', index: 2 },
		{ eventId: 'event-a', index: 0 },
	], 'top');

	assert.ok(moved);
	assert.deepEqual(moved.nextEvents[0].actions.map((block) => block.type), ['one', 'three', 'two']);

	const noOp = moveLogicSelectionToBoundary(
		moved.nextEvents,
		'actions',
		[
			{ eventId: 'event-a', index: 0 },
			{ eventId: 'event-a', index: 1 },
		],
		'top',
	);
	assert.equal(noOp, undefined);
});

test('invalid logic selections are no-ops', () => {
	const event = createEvent('event-a', [{ type: 'one' }]);
	const selection = [
		{ eventId: '', index: 0 },
		{ eventId: 'event-a', index: Number.POSITIVE_INFINITY },
		{ eventId: 'event-a', index: -1 },
		{ eventId: 'event-a', index: 99 },
	];

	assert.equal(removeLogicSelection([event], 'actions', selection), undefined);
	assert.equal(toggleLogicSelectionDisabled([event], 'actions', selection), undefined);
	assert.equal(moveLogicSelectionToBoundary([event], 'actions', selection, 'bottom'), undefined);
});

test('logic selection move transfers selected blocks across events in selection order', () => {
	const eventA = createEvent('event-a', [
		{ type: 'one' },
		{ type: 'two' },
		{ type: 'three' },
	]);
	const eventB = createEvent('event-b', [{ type: 'four' }]);
	const events = [eventA, eventB];

	const result = moveLogicSelectionToEvent(
		events,
		'actions',
		[
			{ eventId: 'event-a', index: 2, block: eventA.actions[2] },
			{ eventId: 'event-a', index: 0, block: eventA.actions[0] },
		],
		'event-b',
		1,
	);

	assert.ok(result);
	assert.strictEqual(result.previousEvents, events);
	assert.deepEqual(result.affectedEventIds, ['event-a', 'event-b']);
	assert.deepEqual(result.nextEvents[0].actions.map((block) => block.type), ['two']);
	assert.deepEqual(
		result.nextEvents[1].actions.map((block) => block.type),
		['four', 'three', 'one'],
	);
	assert.strictEqual(result.nextEvents[0].actions[0], eventA.actions[1]);
	assert.notStrictEqual(result.nextEvents[1].actions[1], eventA.actions[2]);
	assert.notStrictEqual(result.nextEvents[1].actions[2], eventA.actions[0]);
	assert.deepEqual(result.blockReplacements, [
		{ previous: eventA.actions[2], next: result.nextEvents[1].actions[1] },
		{ previous: eventA.actions[0], next: result.nextEvents[1].actions[2] },
	]);
});

test('logic selection move can reorder within the target event', () => {
	const event = createEvent('event-a', [
		{ type: 'one' },
		{ type: 'two' },
		{ type: 'three' },
		{ type: 'four' },
	]);

	const result = moveLogicSelectionToEvent(
		[event],
		'actions',
		[
			{ eventId: 'event-a', index: 1, block: event.actions[1] },
			{ eventId: 'event-a', index: 2, block: event.actions[2] },
		],
		'event-a',
		0,
	);

	assert.ok(result);
	assert.deepEqual(result.affectedEventIds, ['event-a']);
	assert.deepEqual(
		result.nextEvents[0].actions.map((block) => block.type),
		['two', 'three', 'one', 'four'],
	);
});

test('logic block batch insertion clones blocks and clamps the target index', () => {
	const event = createEvent('event-a', [
		{ type: 'one' },
		{ type: 'two' },
	]);
	const sourceBlocks = [
		{ type: 'alpha', data: { disabled: true } },
		{ type: 'beta', data: { value: 2 } },
	];

	const result = insertLogicBlocks(
		[event],
		'actions',
		0,
		sourceBlocks,
		99,
	);

	assert.ok(result);
	assert.deepEqual(
		result.nextEvents[0].actions.map((block) => block.type),
		['one', 'two', 'alpha', 'beta'],
	);
	assert.notStrictEqual(result.nextEvents[0].actions[2], sourceBlocks[0]);
	assert.notStrictEqual(result.nextEvents[0].actions[2].data, sourceBlocks[0].data);
	assert.deepEqual(result.affectedEventIds, ['event-a']);
});

test('logic block batch insertion rejects missing targets and invalid indexes', () => {
	const event = createEvent('event-a', [{ type: 'one' }]);
	const block = { type: 'alpha', data: {} };

	assert.equal(insertLogicBlocks([event], 'actions', -1, [block], 0), undefined);
	assert.equal(insertLogicBlocks([event], 'actions', 0, [], 0), undefined);
	assert.equal(insertLogicBlocks([event], 'actions', 0, [block], Number.NaN), undefined);
});


test('logic selection move rejects stale block snapshots', () => {
	const eventA = createEvent('event-a', [
		{ type: 'one' },
		{ type: 'two' },
	]);
	const eventB = createEvent('event-b', []);
	const staleBlock = eventA.actions[0];
	const refreshedEventA: ICgEvent = {
		...eventA,
		actions: [
			{ type: 'one-refreshed', data: {} },
			eventA.actions[1],
		],
	};

	const result = moveLogicSelectionToEvent(
		[refreshedEventA, eventB],
		'actions',
		[{ eventId: 'event-a', index: 0, block: staleBlock }],
		'event-b',
		0,
	);

	assert.equal(result, undefined);
	assert.deepEqual(refreshedEventA.actions.map((block) => block.type), ['one-refreshed', 'two']);
	assert.deepEqual(eventB.actions, []);
});

test('logic selection move rejects stale indexes instead of inserting captured blocks', () => {
	const eventA = createEvent('event-a', [{ type: 'one' }]);
	const eventB = createEvent('event-b', []);

	assert.equal(
		moveLogicSelectionToEvent(
			[eventA, eventB],
			'actions',
			[{ eventId: 'event-a', index: 4, block: eventA.actions[0] }],
			'event-b',
			0,
		),
		undefined,
	);
});


test('logic selection move deduplicates repeated event indexes', () => {
	const eventA = createEvent('event-a', [
		{ type: 'one' },
		{ type: 'two' },
	]);
	const eventB = createEvent('event-b', []);
	const selected = eventA.actions[0];

	const result = moveLogicSelectionToEvent(
		[eventA, eventB],
		'actions',
		[
			{ eventId: 'event-a', index: 0, block: selected },
			{ eventId: 'event-a', index: 0, block: selected },
		],
		'event-b',
		0,
	);

	assert.ok(result);
	assert.deepEqual(result.nextEvents[0].actions.map((block) => block.type), ['two']);
	assert.deepEqual(result.nextEvents[1].actions.map((block) => block.type), ['one']);
});

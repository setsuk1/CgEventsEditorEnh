import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEvent } from '../shared/events';
import { normalizeSuggestionTitles, resolveSuggestions } from '../webview/ui/utils/suggestionResolver';

function createEvent(): ICgEvent {
	return {
		id: 'event_1',
		tag: 'event-own',
		actions: [{ type: 'sample', data: { tag: 'action-own' } }],
		checks: [],
		triggers: [],
	};
}

test('event dynamic suggestions ignore inherited prototype fields', () => {
	const suggestions = resolveSuggestions(
		['events<tag,toString,constructor>'],
		undefined,
		undefined,
		[createEvent()],
		undefined,
		undefined,
		undefined,
		undefined,
	);
	assert.deepEqual(suggestions, [{ value: 'event-own', label: 'event-own' }]);
});

test('logic dynamic suggestions ignore inherited prototype fields', () => {
	const suggestions = resolveSuggestions(
		['actions<tag,toString,constructor>'],
		undefined,
		undefined,
		[createEvent()],
		undefined,
		undefined,
		undefined,
		undefined,
	);
	assert.deepEqual(suggestions, [{ value: 'action-own', label: 'action-own' }]);
});

test('server itemcode suggestions fall back to the code when an item name is missing', () => {
	const suggestions = resolveSuggestions(
		['server<itemcode>'],
		undefined,
		undefined,
		undefined,
		{ list: [{ code: 'item-1' }] } as any,
		undefined,
		undefined,
		undefined,
	);
	assert.deepEqual(suggestions, [{ value: 'item-1', label: 'item-1' }]);
});

test('unsupported dynamic-looking suggestions remain literal static values', () => {
	assert.deepEqual(
		resolveSuggestions(
			['custom<id>'],
			undefined,
			undefined,
			[createEvent()],
			undefined,
			undefined,
			undefined,
			undefined,
		),
		[{ value: 'custom<id>', label: 'custom<id>' }],
	);
});

test('dynamic suggestions do not consume compact static suggestion titles', () => {
	assert.deepEqual(
		resolveSuggestions(
			['first', 'events<id>', 'second'],
			{ en: ['First title', 'Second title'] },
			undefined,
			[createEvent()],
			undefined,
			undefined,
			undefined,
			undefined,
		),
		[
			{ value: 'first', label: 'First title' },
			{ value: 'second', label: 'Second title' },
			{ value: 'event_1', label: 'event_1' },
		],
	);
});

test('suggestion title normalization uses a safe record and drops malformed locale arrays', () => {
	const input = JSON.parse('{"__proto__":["Prototype title"],"en":["English title"],"bad":[1]}');
	const normalized = normalizeSuggestionTitles(input);

	assert.equal(Object.getPrototypeOf(normalized), null);
	assert.equal(Object.prototype.hasOwnProperty.call(normalized, '__proto__'), true);
	assert.deepEqual(normalized['__proto__'], ['Prototype title']);
	assert.deepEqual(normalized.en, ['English title']);
	assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'bad'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEvent } from '../shared';
import {
	formatGeneratedEventId,
	generateDuplicateEventId,
	generateEventId,
} from '../webview/editor/EventIdGeneration';

function event(id: string): ICgEvent {
	return {
		id,
		actions: [],
		checks: [],
		triggers: [],
	};
}

test('generated event IDs use zero-padded numbering', () => {
	assert.equal(formatGeneratedEventId(1), 'event_0001');
	assert.equal(formatGeneratedEventId(42), 'event_0042');
	assert.equal(formatGeneratedEventId(10000), 'event_10000');
});

test('event ID generation returns the first available generated ID', () => {
	assert.equal(generateEventId([]), 'event_0001');
	assert.equal(
		generateEventId([
			event('event_0001'),
			event('custom'),
			event('event_0003'),
		]),
		'event_0002',
	);
});

test('duplicate event IDs skip occupied copy suffixes', () => {
	assert.equal(
		generateDuplicateEventId('event_1', [
			event('event_1'),
			event('event_1_copy1'),
			event('event_1_copy2'),
			event('event_1_copy4'),
		]),
		'event_1_copy3',
	);
});

test('duplicate event IDs treat the base ID literally', () => {
	assert.equal(
		generateDuplicateEventId('boss_copy1', [
			event('boss_copy1'),
			event('boss_copy1_copy1'),
		]),
		'boss_copy1_copy2',
	);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { isCgEventsDocument } from '../shared/events';

function documentWithEventPatch(patch: Record<string, unknown>) {
	return {
		config: {},
		events: [{
			id: 'event_1',
			actions: [] as unknown[],
			checks: [] as unknown[],
			triggers: [] as unknown[],
			...patch,
		}],
	};
}

test('events document validation accepts declared optional event field types', () => {
	assert.equal(isCgEventsDocument(documentWithEventPatch({
		disabled: false,
		folder: 'chapter/one',
		startTime: 1.5,
		checkInterval: 0,
		repeats: 3,
		repeatInterval: 2.5,
		devOnly: true,
		referenceOnly: false,
		color: '#abcdef',
	})), true);
});

test('events document validation rejects event IDs with edge whitespace', () => {
	assert.equal(isCgEventsDocument(documentWithEventPatch({ id: ' event_1' })), false);
	assert.equal(isCgEventsDocument(documentWithEventPatch({ id: 'event_1 ' })), false);
	assert.equal(isCgEventsDocument(documentWithEventPatch({ id: '   ' })), false);
	assert.equal(isCgEventsDocument(documentWithEventPatch({ id: 'event one' })), true);
});

test('events document validation rejects malformed boolean event fields', () => {
	assert.equal(isCgEventsDocument(documentWithEventPatch({ disabled: 'false' })), false);
	assert.equal(isCgEventsDocument(documentWithEventPatch({ devOnly: 1 })), false);
	assert.equal(isCgEventsDocument(documentWithEventPatch({ referenceOnly: null })), false);
});

test('events document validation rejects malformed numeric event fields', () => {
	for (const patch of [
		{ startTime: '1' },
		{ checkInterval: Number.NaN },
		{ repeats: Number.POSITIVE_INFINITY },
		{ repeatInterval: {} },
	]) {
		assert.equal(isCgEventsDocument(documentWithEventPatch(patch)), false);
	}
});

test('events document validation rejects malformed color values', () => {
	assert.equal(isCgEventsDocument(documentWithEventPatch({ color: 123 })), false);
	assert.equal(isCgEventsDocument(documentWithEventPatch({ color: {} })), false);
});

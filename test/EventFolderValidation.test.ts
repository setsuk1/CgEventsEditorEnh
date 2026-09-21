import assert from 'node:assert/strict';
import test from 'node:test';
import { isCgEventsDocument } from '../shared/events';

function documentWithFolder(folder?: unknown) {
	const event: Record<string, unknown> = {
		id: 'event_1',
		actions: [],
		checks: [],
		triggers: [],
	};
	if (folder !== undefined) event.folder = folder;
	return {
		config: {},
		events: [event],
	};
}

test('events document validation accepts missing or string folders', () => {
	assert.equal(isCgEventsDocument(documentWithFolder()), true);
	assert.equal(isCgEventsDocument(documentWithFolder('')), true);
	assert.equal(isCgEventsDocument(documentWithFolder('chapter/one')), true);
});

test('events document validation rejects malformed folder values', () => {
	assert.equal(isCgEventsDocument(documentWithFolder(123)), false);
	assert.equal(isCgEventsDocument(documentWithFolder({ name: 'folder' })), false);
	assert.equal(isCgEventsDocument(documentWithFolder(['folder'])), false);
	assert.equal(isCgEventsDocument(documentWithFolder(null)), false);
});

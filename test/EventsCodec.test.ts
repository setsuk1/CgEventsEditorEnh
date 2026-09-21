import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsDocument } from '../shared/events';
import { parseEventsText, serializeEventsText } from '../src/utils/eventsCodec';

function createDocument(): ICgEventsDocument {
	return {
		config: {
			stage: {
				width: 800,
				height: 600,
				backgroundColor: '#999999',
				resolutionPolicy: 'showAll',
				alignHorizontal: 'center',
				alignVertical: 'middle',
			},
			preload: { resourcesExclude: [], sources: [] },
		},
		events: [{ id: 'event_1', actions: [], checks: [], triggers: [] }],
	};
}

test('events codec round-trips JSON format', () => {
	const document = createDocument();
	const serialized = serializeEventsText({ format: 'json', json: document });
	assert.equal(serialized.format, 'json');
	if (serialized.format !== 'json') return;
	const parsed = parseEventsText(serialized.text);
	assert.equal(parsed.format, 'json');
	if (parsed.format !== 'json') return;
	assert.deepEqual(parsed.json, document);
});

test('events codec round-trips LZ format', () => {
	const document = createDocument();
	const serialized = serializeEventsText({ format: 'lz', json: document });
	assert.equal(serialized.format, 'lz');
	if (serialized.format !== 'lz') return;
	const parsed = parseEventsText(serialized.text);
	assert.equal(parsed.format, 'lz');
	if (parsed.format !== 'lz') return;
	assert.deepEqual(parsed.json, document);
});

test('events codec preserves base64 JSON compatibility as LZ mode', () => {
	const document = createDocument();
	const encoded = btoa(JSON.stringify(document));
	const parsed = parseEventsText(encoded);
	assert.equal(parsed.format, 'lz');
	if (parsed.format !== 'lz') return;
	assert.deepEqual(parsed.json, document);
});

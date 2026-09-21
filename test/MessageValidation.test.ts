import assert from 'node:assert/strict';
import test from 'node:test';
import { isIncomingMessage, isOutgoingMessage, isSortingPreset, IncomingMessageType, OutgoingMessageType } from '../shared/messages';

const rules = [{ order: 'asc' as const, target: 'id' as const }];

test('sorting preset validation accepts trimmed non-empty names', () => {
	assert.equal(isSortingPreset({ name: 'My preset', rules }), true);
});

test('sorting preset validation rejects unsafe or non-canonical names', () => {
	for (const name of ['', '   ', ' padded ', '__proto__']) {
		assert.equal(isSortingPreset({ name, rules }), false, `expected ${JSON.stringify(name)} to be rejected`);
	}
});

test('sorting preset incoming messages use the same name contract', () => {
	assert.equal(isIncomingMessage({
		type: IncomingMessageType.SORTING_PRESETS,
		data: [{ name: 'My preset', rules }],
	}), true);
	assert.equal(isIncomingMessage({
		type: IncomingMessageType.SORTING_PRESETS,
		data: [{ name: ' padded ', rules }],
	}), false);
});

test('sorting preset save and delete messages use the same name contract', () => {
	assert.equal(isOutgoingMessage({
		type: OutgoingMessageType.SORTING_PRESETS_SAVE,
		data: { name: 'My preset', rules },
	}), true);
	assert.equal(isOutgoingMessage({
		type: OutgoingMessageType.SORTING_PRESETS_SAVE,
		data: { name: ' padded ', rules },
	}), false);
	assert.equal(isOutgoingMessage({
		type: OutgoingMessageType.SORTING_PRESETS_DELETE,
		data: 'My preset',
	}), true);
	for (const data of ['', '   ', ' padded ', '__proto__']) {
		assert.equal(isOutgoingMessage({
			type: OutgoingMessageType.SORTING_PRESETS_DELETE,
			data,
		}), false, `expected ${JSON.stringify(data)} to be rejected`);
	}
});


test('events document version tokens are optional non-negative integers', () => {
	const json = { config: {}, events: [] as unknown[] };
	for (const documentVersion of [0, 1, 42]) {
		assert.equal(isIncomingMessage({
			type: IncomingMessageType.EVENTS_JSON,
			data: { format: 'json', json, documentVersion },
		}), true);
		assert.equal(isOutgoingMessage({
			type: OutgoingMessageType.SAVE,
			data: { format: 'json', json, documentVersion },
		}), true);
	}

	assert.equal(isOutgoingMessage({
		type: OutgoingMessageType.SAVE,
		data: { format: 'json', json },
	}), true);

	for (const documentVersion of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
		assert.equal(isIncomingMessage({
			type: IncomingMessageType.EVENTS_JSON,
			data: { format: 'json', json, documentVersion },
		}), false, `expected version ${String(documentVersion)} to be rejected`);
		assert.equal(isOutgoingMessage({
			type: OutgoingMessageType.SAVE,
			data: { format: 'json', json, documentVersion },
		}), false, `expected version ${String(documentVersion)} to be rejected`);
	}
});

test('parse-error messages validate document version tokens too', () => {
	for (const documentVersion of [undefined, 0, 7]) {
		assert.equal(isIncomingMessage({
			type: IncomingMessageType.EVENTS_JSON,
			data: { format: 'error', error: 'invalid', documentVersion },
		}), true);
	}

	for (const documentVersion of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '7']) {
		assert.equal(isIncomingMessage({
			type: IncomingMessageType.EVENTS_JSON,
			data: { format: 'error', error: 'invalid', documentVersion },
		}), false, `expected parse-error version ${String(documentVersion)} to be rejected`);
	}
});

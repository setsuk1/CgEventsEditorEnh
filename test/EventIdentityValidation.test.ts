import assert from 'node:assert/strict';
import test from 'node:test';
import {
	validateEventFolder,
	validateEventId,
} from '../webview/ui/components/events/EventIdentityValidation';

test('event ID validation trims valid IDs', () => {
	const result = validateEventId(' event_2 ', 'event_1', () => false);
	assert.deepEqual(result, { value: 'event_2' });
});

test('event ID validation reports required and invalid values', () => {
	assert.deepEqual(
		validateEventId('   ', 'event_1', () => false),
		{ value: '', error: 'event-id-required' },
	);
	assert.deepEqual(
		validateEventId('bad id', 'event_1', () => false),
		{ value: 'bad id', error: 'event-id-invalid' },
	);
	assert.deepEqual(
		validateEventId('bad.id', 'event_1', () => false),
		{ value: 'bad.id', error: 'event-id-invalid' },
	);
});

test('event ID validation rejects collisions but permits the current ID', () => {
	const exists = (eventId: string) => eventId === 'event_1' || eventId === 'taken';

	assert.deepEqual(
		validateEventId('taken', 'event_1', exists),
		{ value: 'taken', error: 'event-id-exists' },
	);
	assert.deepEqual(
		validateEventId('event_1', 'event_1', exists),
		{ value: 'event_1' },
	);
});

test('event folder validation trims values and permits empty folders', () => {
	assert.deepEqual(validateEventFolder(' Folder '), { value: 'Folder' });
	assert.deepEqual(validateEventFolder('   '), { value: '' });
});

test('event folder validation rejects unsupported bracket characters', () => {
	assert.deepEqual(
		validateEventFolder('bad<folder>'),
		{ value: 'bad<folder>', error: 'event-folder-invalid' },
	);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultEvent } from '../webview/editor/EventDefaults';

test('default event uses the editor creation defaults', () => {
	assert.deepEqual(createDefaultEvent('event_1'), {
		id: 'event_1',
		folder: '',
		disabled: false,
		startTime: 0,
		checkInterval: 10,
		repeatInterval: 0,
		repeats: 0,
		devOnly: false,
		referenceOnly: false,
		color: '#ffffff',
		actions: [],
		checks: [],
		triggers: [],
	});
	assert.equal(createDefaultEvent('event_2', { folder: 'Boss' }).folder, 'Boss');
});

test('default events never share logic block arrays', () => {
	const first = createDefaultEvent('first');
	const second = createDefaultEvent('second');

	first.actions.push({ type: 'sample', data: {} });

	assert.equal(second.actions.length, 0);
	assert.notStrictEqual(first.actions, second.actions);
	assert.notStrictEqual(first.checks, second.checks);
	assert.notStrictEqual(first.triggers, second.triggers);
});

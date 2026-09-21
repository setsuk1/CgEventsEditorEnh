import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultEvent } from '../webview/editor/EventDefaults';
import {
	buildEventHeaderSummary,
	formatClockTimeSeconds,
} from '../webview/ui/components/events/EventHeaderSummary';

test('event header clock formatting clamps and floors seconds', () => {
	assert.equal(formatClockTimeSeconds(0), '00:00:00');
	assert.equal(formatClockTimeSeconds(3661.9), '01:01:01');
	assert.equal(formatClockTimeSeconds(-4), '00:00:00');
	assert.equal(formatClockTimeSeconds(Number.NaN), '00:00:00');
});

test('event header summary uses event defaults when fields are omitted', () => {
	const event = createDefaultEvent('event-a');
	delete event.startTime;
	delete event.checkInterval;
	delete event.repeats;
	delete event.repeatInterval;

	const summary = buildEventHeaderSummary(event);
	assert.equal(summary.showStart, false);
	assert.equal(summary.showCheck, false);
	assert.equal(summary.repeatChipOff, true);
	assert.equal(summary.repeatSummary, '');
	assert.equal(summary.startSummary, '00:00:00');
	assert.equal(summary.checkSummary, '10ms');
});

test('event header summary formats repeats and non-default timings', () => {
	const event = createDefaultEvent('event-a');
	event.startTime = 65;
	event.checkInterval = 25;
	event.repeats = -1;
	event.repeatInterval = 500;
	event.devOnly = true;

	const summary = buildEventHeaderSummary(event);
	assert.equal(summary.showStart, true);
	assert.equal(summary.showCheck, true);
	assert.equal(summary.showDev, true);
	assert.equal(summary.repeatChipOff, false);
	assert.equal(summary.repeatSummary, 'x ∞ / 500ms');
	assert.equal(summary.startSummary, '00:01:05');
	assert.equal(summary.checkSummary, '25ms');
});

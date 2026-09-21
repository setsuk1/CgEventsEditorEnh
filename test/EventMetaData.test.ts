import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventMetaEditorData, buildEventPatchFromMeta } from '../webview/ui/components/events/EventMetaData';

test('event meta patch trims identifiers and ignores logic block arrays', () => {
	const patch = buildEventPatchFromMeta({
		id: ' event_2 ',
		folder: ' Folder ',
		actions: [{ type: 'ignored' }],
		checks: [],
		triggers: [],
	});

	assert.deepEqual(patch, {
		id: 'event_2',
		folder: 'Folder',
	});
});

test('event meta patch normalizes boolean and reference-only values consistently', () => {
	assert.deepEqual(
		buildEventPatchFromMeta({
			disabled: 1,
			devOnly: 0,
			referenceOnly: 1,
		}),
		{ disabled: true, devOnly: false, referenceOnly: true },
	);
	assert.equal(buildEventPatchFromMeta({ referenceOnly: true }).referenceOnly, true);
	assert.equal(buildEventPatchFromMeta({ referenceOnly: 0 }).referenceOnly, false);
	assert.equal(buildEventPatchFromMeta({ referenceOnly: '1' }).referenceOnly, false);
});

test('event meta patch accepts typed numeric/color fields and ignores malformed known values', () => {
	assert.deepEqual(
		buildEventPatchFromMeta({
			startTime: 1,
			checkInterval: 20,
			repeats: -1,
			repeatInterval: 250,
			color: '#123456',
		}),
		{
			startTime: 1,
			checkInterval: 20,
			repeats: -1,
			repeatInterval: 250,
			color: '#123456',
		},
	);

	assert.deepEqual(
		buildEventPatchFromMeta({
			startTime: '1',
			checkInterval: Number.NaN,
			repeats: Number.POSITIVE_INFINITY,
			repeatInterval: false,
			color: 123,
		}),
		{},
	);
});

test('event meta patch preserves and isolates additional non-logic metadata', () => {
	const nested = { enabled: true };
	const arrayValue = [{ value: 1 }];
	const patch = buildEventPatchFromMeta({
		customFlag: 'value',
		customObject: nested,
		customArray: arrayValue,
	});

	assert.deepEqual(patch, {
		customFlag: 'value',
		customObject: { enabled: true },
		customArray: [{ value: 1 }],
	});
	assert.notStrictEqual(patch.customObject, nested);
	assert.notStrictEqual((patch as any).customArray, arrayValue);

	nested.enabled = false;
	arrayValue[0].value = 2;
	assert.deepEqual(patch.customObject, { enabled: true });
	assert.deepEqual((patch as any).customArray, [{ value: 1 }]);
});


test('event meta editor data excludes logic arrays and maps reference-only booleans', () => {
	const meta = buildEventMetaEditorData({
		id: 'event_1',
		folder: 'Folder',
		referenceOnly: true,
		actions: [{ type: 'action', data: {} }],
		checks: [{ type: 'check', data: {} }],
		triggers: [{ type: 'trigger', data: {} }],
		customValue: 42,
	});

	assert.deepEqual(meta, {
		id: 'event_1',
		folder: 'Folder',
		referenceOnly: 1,
		customValue: 42,
	});
});

test('event meta editor data isolates custom nested metadata from the source event', () => {
	const event = {
		id: 'event_1',
		actions: [],
		checks: [],
		triggers: [],
		customObject: { nested: { enabled: true } },
		customArray: [{ value: 1 }],
	} as any;

	const meta = buildEventMetaEditorData(event);
	assert.notStrictEqual(meta.customObject, event.customObject);
	assert.notStrictEqual(meta.customObject.nested, event.customObject.nested);
	assert.notStrictEqual(meta.customArray, event.customArray);
	assert.notStrictEqual(meta.customArray[0], event.customArray[0]);

	meta.customObject.nested.enabled = false;
	meta.customArray[0].value = 2;
	assert.deepEqual(event.customObject, { nested: { enabled: true } });
	assert.deepEqual(event.customArray, [{ value: 1 }]);
});

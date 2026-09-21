import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsParseSuccess } from '../shared/events';
import { cloneEditorEntry, cloneEditorValue } from '../webview/editor/EditorSnapshots';

test('editor snapshot cloning detaches nested serializable values', () => {
	const source = { nested: { value: 1 }, list: [{ enabled: true }] };
	const cloned = cloneEditorValue(source);

	assert.deepEqual(cloned, source);
	assert.notStrictEqual(cloned, source);
	assert.notStrictEqual(cloned.nested, source.nested);
	assert.notStrictEqual(cloned.list, source.list);
	assert.notStrictEqual(cloned.list[0], source.list[0]);
});

test('editor entry cloning preserves metadata and detaches JSON', () => {
	const entry: ICgEventsParseSuccess = {
		format: 'json' as const,
		documentVersion: 7,
		json: {
			config: {
				stage: {
					width: 800,
					height: 600,
					backgroundColor: '#000000',
					resolutionPolicy: 'showAll' as const,
					alignHorizontal: 'center' as const,
					alignVertical: 'middle' as const,
				},
				preload: { resourcesExclude: [], sources: [] },
			},
			events: [],
		},
	};

	const cloned = cloneEditorEntry(entry);
	assert.ok(cloned);
	assert.equal(cloned.documentVersion, 7);
	assert.deepEqual(cloned.json, entry.json);
	assert.notStrictEqual(cloned.json, entry.json);
});

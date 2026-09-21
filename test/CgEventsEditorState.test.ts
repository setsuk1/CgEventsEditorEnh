import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsDocument } from '../shared/events';
import { CgEventsEditor, EditorChangeEvents, type EditorChangeEventPayload } from '../webview/editor/CgEventsEditor';

function createDocument(): ICgEventsDocument {
	return {
		config: {
			stage: {
				width: 800,
				height: 600,
				backgroundColor: '#999999',
				resolutionPolicy: 'showAll' as const,
				alignHorizontal: 'center' as const,
				alignVertical: 'middle' as const,
			},
			preload: {
				resourcesExclude: [],
				sources: [],
			},
		},
		events: [
			{
				id: 'event_1',
				disabled: false,
				actions: [{ type: 'sample', data: { disabled: false } }],
				checks: [],
				triggers: [],
			},
		],
	};
}

function createEditor(): CgEventsEditor {
	const editor = new CgEventsEditor();
	editor.setCgEventsJson({ format: 'json', json: createDocument() });
	return editor;
}

test('invalid JSON drafts stay local to the JSON editor', () => {
	const editor = createEditor();
	const before = editor.getEventsJson();
	let documentUpdates = 0;
	editor.on(EditorChangeEvents.DOCUMENT_UPDATED, () => { documentUpdates += 1; });

	const error = editor.applyJsonText('{ invalid json');

	assert.ok(error instanceof Error);
	assert.equal(editor.getParseError(), undefined);
	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(documentUpdates, 0);
});

test('stale event toggle targets are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.toggleEventDisabled('missing-event');

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
});

test('stale logic toggle targets are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.toggleLogicDisabled('event_1', 'action', 99);

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
});

test('unsafe logic field paths are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.updateLogicField('event_1', 'action', 0, ['__proto__', 'polluted'], true);
	editor.updateLogicField('event_1', 'action', 0, ['safe', 'prototype', 'polluted'], true);
	editor.updateLogicField('event_1', 'action', 0, ['constructor', 'prototype', 'polluted'], true);

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('identical event, config, and format updates are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson()!;
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.updateEvent('event_1', { id: 'event_1', disabled: false });
	editor.updateConfig({ stage: before.config.stage });
	editor.setFormat('json');

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('deep-equivalent event patches are no-ops', () => {
	const editor = createEditor();
	editor.updateEvent('event_1', { metadata: { nested: { value: 1 } } } as any);
	editor.clearHistory();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.updateEvent('event_1', { metadata: { nested: { value: 1 } } } as any);

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('cached event updates preserve rename validation and undo', () => {
	const editor = createEditor();
	editor.addEvent();
	const secondId = editor.getEvents()[1]?.id;
	assert.ok(secondId);
	assert.equal(editor.getEventIndex('event_1'), 0);
	assert.equal(editor.getEventIndex(secondId), 1);
	editor.clearHistory();

	const beforeDuplicate = editor.getEventsJson();
	editor.updateEvent('event_1', { id: secondId });
	assert.strictEqual(editor.getEventsJson(), beforeDuplicate);
	assert.equal(editor.canUndo(), false);

	editor.updateEvent('event_1', { id: ' renamed_event ' });
	assert.equal(editor.getEventById('event_1'), undefined);
	assert.equal(editor.getEventById('renamed_event')?.id, 'renamed_event');
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.equal(editor.getEventById('event_1')?.id, 'event_1');
	assert.equal(editor.getEventById('renamed_event'), undefined);
});

test('cached event moves preserve order and undo', () => {
	const editor = createEditor();
	editor.addEvent();
	const beforeIds = editor.getEvents().map((event) => event.id);
	assert.equal(editor.getEventIndex(beforeIds[0]), 0);
	editor.clearHistory();

	editor.moveEvent(beforeIds[0], 1);
	assert.deepEqual(editor.getEvents().map((event) => event.id), [beforeIds[1], beforeIds[0]]);
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.deepEqual(editor.getEvents().map((event) => event.id), beforeIds);
});

test('deep-equivalent config patches are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson()!;
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.updateConfig({ stage: { ...before.config.stage } });

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('equivalent JSON documents are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	const error = editor.applyJsonText(JSON.stringify(createDocument()));

	assert.equal(error, null);
	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('equivalent external documents preserve editor state and history', () => {
	const editor = createEditor();
	editor.toggleEventDisabled('event_1');
	const before = editor.getEventsJson();
	const equivalent = JSON.parse(JSON.stringify(before));
	let documentUpdates = 0;
	editor.on(EditorChangeEvents.DOCUMENT_UPDATED, () => { documentUpdates += 1; });

	editor.setCgEventsJson({ format: 'json', json: equivalent });

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(editor.canUndo(), true);
	assert.equal(documentUpdates, 0);
	editor.undo();
	assert.equal(editor.getEventById('event_1')?.disabled, false);
});

test('equivalent external documents refresh the save version token without clearing history', () => {
	const editor = new CgEventsEditor();
	editor.setCgEventsJson({ format: 'json', json: createDocument(), documentVersion: 3 });
	editor.toggleEventDisabled('event_1');
	const before = editor.getEventsJson();
	const equivalent = JSON.parse(JSON.stringify(before));

	editor.setCgEventsJson({ format: 'json', json: equivalent, documentVersion: 4 });

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(editor.getCurrentEntry()?.documentVersion, 4);
	assert.equal(editor.canUndo(), true);
	editor.undo();
	assert.equal(editor.getEventById('event_1')?.disabled, false);
	assert.equal(editor.getCurrentEntry()?.documentVersion, 4);
});

test('JSON edit history preserves the base document version token', () => {
	const editor = new CgEventsEditor();
	editor.setCgEventsJson({ format: 'json', json: createDocument(), documentVersion: 7 });
	const changed = createDocument();
	changed.events[0].disabled = true;

	assert.equal(editor.applyJsonText(JSON.stringify(changed)), null);
	assert.equal(editor.getCurrentEntry()?.documentVersion, 7);
	editor.undo();
	assert.equal(editor.getCurrentEntry()?.documentVersion, 7);
	editor.redo();
	assert.equal(editor.getCurrentEntry()?.documentVersion, 7);
});

test('external format changes still reset editor state for equivalent documents', () => {
	const editor = createEditor();
	editor.toggleEventDisabled('event_1');
	const equivalent = JSON.parse(JSON.stringify(editor.getEventsJson()));
	let documentUpdates = 0;
	editor.on(EditorChangeEvents.DOCUMENT_UPDATED, () => { documentUpdates += 1; });

	editor.setCgEventsJson({ format: 'lz', json: equivalent });

	assert.equal(editor.getEventsFormat(), 'lz');
	assert.equal(editor.canUndo(), false);
	assert.equal(documentUpdates, 1);
	assert.equal(editor.getEventById('event_1')?.disabled, true);
});

test('external content changes still reset editor state', () => {
	const editor = createEditor();
	editor.toggleEventDisabled('event_1');
	const changed = JSON.parse(JSON.stringify(editor.getEventsJson()));
	changed.events[0].folder = 'external-change';
	let documentUpdates = 0;
	editor.on(EditorChangeEvents.DOCUMENT_UPDATED, () => { documentUpdates += 1; });

	editor.setCgEventsJson({ format: 'json', json: changed });

	assert.equal(editor.getEventById('event_1')?.folder, 'external-change');
	assert.equal(editor.canUndo(), false);
	assert.equal(documentUpdates, 1);
});

test('changed JSON documents still update and participate in undo history', () => {
	const editor = createEditor();
	const changed = createDocument();
	changed.events[0].disabled = true;

	const error = editor.applyJsonText(JSON.stringify(changed));

	assert.equal(error, null);
	assert.equal(editor.getEventById('event_1')?.disabled, true);
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.equal(editor.getEventById('event_1')?.disabled, false);
});

test('identical logic data updates are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.updateLogicData('event_1', 'action', 0, { disabled: false });

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('identical logic field updates are no-ops', () => {
	const editor = createEditor();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.updateLogicField('event_1', 'action', 0, ['disabled'], false);

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('logic boundary moves that preserve order are no-ops', () => {
	const editor = createEditor();
	editor.insertLogic('event_1', 'action', { type: 'second', data: {} });
	editor.insertLogic('event_1', 'action', { type: 'third', data: {} });
	editor.clearHistory();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.moveLogicSelectionToTop('action', [{ eventId: 'event_1', index: 0 }]);
	editor.moveLogicSelectionToBottom('action', [{ eventId: 'event_1', index: 2 }]);

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('cached logic data updates preserve values and undo history', () => {
	const editor = createEditor();
	editor.clearHistory();

	editor.updateLogicData('event_1', 'action', 0, { disabled: false, nested: { value: 2 } });
	assert.deepEqual(editor.getLogicBlock('event_1', 'action', 0)?.data, { disabled: false, nested: { value: 2 } });
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.deepEqual(editor.getLogicBlock('event_1', 'action', 0)?.data, { disabled: false });
});

test('cached logic toggles preserve disabled state and undo history', () => {
	const editor = createEditor();
	editor.clearHistory();

	editor.toggleLogicDisabled('event_1', 'action', 0);
	assert.equal(editor.getLogicBlock('event_1', 'action', 0)?.data?.disabled, true);
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.equal(editor.getLogicBlock('event_1', 'action', 0)?.data?.disabled, false);
});

test('selection disabled toggles preserve logic block UI identity', () => {
	const editor = createEditor();
	const beforeBlock = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(beforeBlock);
	const uiKey = editor.getLogicBlockUiKey(beforeBlock);

	editor.toggleLogicDisabledSelection('action', [{ eventId: 'event_1', index: 0 }]);

	const afterBlock = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(afterBlock);
	assert.notStrictEqual(afterBlock, beforeBlock);
	assert.equal(editor.getLogicBlockUiKey(afterBlock), uiKey);
	assert.equal(afterBlock.data?.disabled, true);
});

test('cached structural logic mutations preserve add, move, remove, and undo behavior', () => {
	const editor = createEditor();

	editor.addLogic('event_1', 'action', 'second');
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample', 'second']);
	assert.equal(editor.canUndo(), true);
	editor.undo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample']);
	editor.redo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample', 'second']);

	editor.clearHistory();
	editor.moveLogic('event_1', 'action', 0, 1);
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['second', 'sample']);
	editor.undo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample', 'second']);

	editor.clearHistory();
	editor.removeLogic('event_1', 'action', 1);
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample']);
	editor.undo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample', 'second']);
});

test('same-index logic moves remain no-ops', () => {
	const editor = createEditor();
	editor.insertLogic('event_1', 'action', { type: 'second', data: {} });
	editor.clearHistory();
	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.moveLogicToIndex('event_1', 'action', 1, 1);

	assert.strictEqual(editor.getEventsJson(), before);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('cached block insertion preserves paste order and undo history', () => {
	const editor = createEditor();
	editor.clearHistory();

	editor.insertLogicBlocks('event_1', 'action', [
		{ type: 'second', data: { value: 2 } },
		{ type: 'third', data: { value: 3 } },
	], 1);
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample', 'second', 'third']);
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample']);
	editor.redo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample', 'second', 'third']);
});

test('cached cross-event logic moves preserve source, target, and undo history', () => {
	const editor = createEditor();
	editor.addEvent();
	const targetEventId = editor.getEvents()[1]?.id;
	assert.ok(targetEventId);
	editor.clearHistory();

	editor.moveLogicToEvent('event_1', 'action', 0, targetEventId, 0);
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), []);
	assert.deepEqual(editor.getLogicBlocks(targetEventId, 'action').map((block) => block.type), ['sample']);
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample']);
	assert.deepEqual(editor.getLogicBlocks(targetEventId, 'action').map((block) => block.type), []);
	editor.redo();
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), []);
	assert.deepEqual(editor.getLogicBlocks(targetEventId, 'action').map((block) => block.type), ['sample']);
});

test('cached event duplicate and remove preserve undo history', () => {
	const editor = createEditor();
	editor.clearHistory();

	editor.duplicateEvent('event_1');
	assert.deepEqual(editor.getEvents().map((event) => event.id), ['event_1', 'event_1_copy1']);
	assert.equal(editor.canUndo(), true);
	editor.undo();
	assert.deepEqual(editor.getEvents().map((event) => event.id), ['event_1']);
	editor.redo();
	assert.deepEqual(editor.getEvents().map((event) => event.id), ['event_1', 'event_1_copy1']);

	editor.clearHistory();
	editor.removeEvent('event_1_copy1');
	assert.deepEqual(editor.getEvents().map((event) => event.id), ['event_1']);
	editor.undo();
	assert.deepEqual(editor.getEvents().map((event) => event.id), ['event_1', 'event_1_copy1']);
});

test('invalid mutation target indexes are no-ops', () => {
	const editor = createEditor();
	editor.insertLogic('event_1', 'action', { type: 'second', data: {} });
	editor.addEvent();
	const secondEventId = editor.getEvents()[1]?.id;
	assert.ok(secondEventId);
	editor.clearHistory();

	const before = editor.getEventsJson();
	let changes = 0;
	editor.on(EditorChangeEvents.CHANGE, () => { changes += 1; });

	editor.moveEvent(secondEventId, Number.NaN);
	editor.moveLogic('event_1', 'action', 1, Number.NaN);
	editor.moveLogicToIndex('event_1', 'action', 0, Number.POSITIVE_INFINITY);
	editor.insertLogic('event_1', 'action', { type: 'invalid-insert', data: {} }, Number.NaN);
	editor.insertLogicBlocks('event_1', 'action', [{ type: 'invalid-block', data: {} }], Number.POSITIVE_INFINITY);
	editor.moveLogicToEvent('event_1', 'action', 0, secondEventId, Number.NaN);
	editor.moveLogicSelectionToEvent(
		'action',
		[{ eventId: 'event_1', index: 0, block: editor.getLogicBlock('event_1', 'action', 0)! }],
		secondEventId,
		Number.POSITIVE_INFINITY,
	);

	assert.strictEqual(editor.getEventsJson(), before);
	assert.deepEqual(editor.getEvents().map((event) => event.id), ['event_1', secondEventId]);
	assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), ['sample', 'second']);
	assert.deepEqual(editor.getLogicBlocks(secondEventId, 'action'), []);
	assert.equal(changes, 0);
	assert.equal(editor.canUndo(), false);
});

test('valid event toggles still participate in undo history', () => {
	const editor = createEditor();

	editor.toggleEventDisabled('event_1');
	assert.equal(editor.getEventById('event_1')?.disabled, true);
	assert.equal(editor.canUndo(), true);

	editor.undo();
	assert.equal(editor.getEventById('event_1')?.disabled, false);
});


test('parse error state exposes error format without a document', () => {
	const editor = new CgEventsEditor();
	const parseError = new Error('invalid external document');

	editor.setCgEventsJson({ format: 'error', error: parseError });

	assert.equal(editor.getEventsFormat(), 'error');
	assert.strictEqual(editor.getParseError(), parseError);
	assert.equal(editor.getEventsJson(), undefined);
});

test('JSON edit history restores parse-error format and preserves its base version token', () => {
	const editor = new CgEventsEditor();
	editor.setCgEventsJson({ format: 'error', error: undefined, documentVersion: 12 });

	assert.equal(editor.applyJsonText(JSON.stringify(createDocument())), null);
	assert.equal(editor.getEventsFormat(), 'json');
	assert.ok(editor.getEventsJson());
	assert.equal(editor.getCurrentEntry()?.documentVersion, 12);

	editor.undo();
	assert.equal(editor.getEventsFormat(), 'error');
	assert.equal(editor.getEventsJson(), undefined);

	editor.redo();
	assert.equal(editor.getEventsFormat(), 'json');
	assert.ok(editor.getEventsJson());
	assert.equal(editor.getCurrentEntry()?.documentVersion, 12);
});

test('selection moves preserve logic block UI identity across move, undo, and redo', () => {
	const editor = createEditor();
	editor.addEvent();
	const targetEventId = editor.getEvents()[1]?.id;
	assert.ok(targetEventId);

	const originalBlock = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(originalBlock);
	const originalUiKey = editor.getLogicBlockUiKey(originalBlock);
	editor.clearHistory();

	editor.moveLogicSelectionToEvent(
		'action',
		[{ eventId: 'event_1', index: 0, block: originalBlock }],
		targetEventId,
		0,
	);

	const movedBlock = editor.getLogicBlock(targetEventId, 'action', 0);
	assert.ok(movedBlock);
	assert.notStrictEqual(movedBlock, originalBlock);
	assert.equal(editor.getLogicBlockUiKey(movedBlock), originalUiKey);

	editor.undo();
	const restoredBlock = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(restoredBlock);
	assert.equal(editor.getLogicBlockUiKey(restoredBlock), originalUiKey);

	editor.redo();
	const redoneBlock = editor.getLogicBlock(targetEventId, 'action', 0);
	assert.ok(redoneBlock);
	assert.equal(editor.getLogicBlockUiKey(redoneBlock), originalUiKey);
});

test('single logic move history preserves UI identity across undo and redo', () => {
	const editor = createEditor();
	editor.addEvent();
	const targetEventId = editor.getEvents()[1]?.id;
	assert.ok(targetEventId);

	const original = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(original);
	const uiKey = editor.getLogicBlockUiKey(original);
	editor.clearHistory();

	editor.moveLogicToEvent('event_1', 'action', 0, targetEventId, 0);
	const moved = editor.getLogicBlock(targetEventId, 'action', 0);
	assert.ok(moved);
	assert.equal(editor.getLogicBlockUiKey(moved), uiKey);

	editor.undo();
	const restored = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(restored);
	assert.equal(editor.getLogicBlockUiKey(restored), uiKey);

	editor.redo();
	const redone = editor.getLogicBlock(targetEventId, 'action', 0);
	assert.ok(redone);
	assert.equal(editor.getLogicBlockUiKey(redone), uiKey);
});

test('logic add, insert, and remove history preserve UI identity', () => {
	const editor = createEditor();
	const initial = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(initial);
	const initialKey = editor.getLogicBlockUiKey(initial);

	editor.removeLogic('event_1', 'action', 0);
	editor.undo();
	const restored = editor.getLogicBlock('event_1', 'action', 0);
	assert.ok(restored);
	assert.equal(editor.getLogicBlockUiKey(restored), initialKey);

	editor.clearHistory();
	editor.addLogic('event_1', 'action', 'added');
	const added = editor.getLogicBlock('event_1', 'action', 1);
	assert.ok(added);
	const addedKey = editor.getLogicBlockUiKey(added);
	editor.undo();
	editor.redo();
	const redoneAdded = editor.getLogicBlock('event_1', 'action', 1);
	assert.ok(redoneAdded);
	assert.equal(editor.getLogicBlockUiKey(redoneAdded), addedKey);

	editor.clearHistory();
	const source = { type: 'inserted', data: { value: 1 } };
	editor.insertLogic('event_1', 'action', source, 1);
	const inserted = editor.getLogicBlock('event_1', 'action', 1);
	assert.ok(inserted);
	const insertedKey = editor.getLogicBlockUiKey(inserted);
	editor.undo();
	editor.redo();
	const redoneInserted = editor.getLogicBlock('event_1', 'action', 1);
	assert.ok(redoneInserted);
	assert.equal(editor.getLogicBlockUiKey(redoneInserted), insertedKey);
});

test('event update payload carries previous and next snapshots through undo and redo', () => {
	const editor = createEditor();
	const updates: Array<{
		previousId?: string;
		nextId?: string;
		previousFolder?: string;
		nextFolder?: string;
	}> = [];
	editor.on(EditorChangeEvents.EVENT_UPDATED, (payload: EditorChangeEventPayload | undefined) => {
		updates.push({
			previousId: payload?.previousEvent?.id,
			nextId: payload?.event?.id,
			previousFolder: payload?.previousEvent?.folder,
			nextFolder: payload?.event?.folder,
		});
	});

	editor.updateEvent('event_1', { id: 'renamed', folder: 'new-folder' });
	editor.undo();
	editor.redo();

	assert.deepEqual(updates, [
		{ previousId: 'event_1', nextId: 'renamed', previousFolder: undefined, nextFolder: 'new-folder' },
		{ previousId: 'renamed', nextId: 'event_1', previousFolder: 'new-folder', nextFolder: undefined },
		{ previousId: 'event_1', nextId: 'renamed', previousFolder: undefined, nextFolder: 'new-folder' },
	]);
});

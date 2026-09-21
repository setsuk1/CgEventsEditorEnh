import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorHistory } from '../webview/editor/EditorHistory';

test('editor history applies undo and redo in order', () => {
	const history = new EditorHistory();
	const calls: string[] = [];
	history.record({ undo: () => calls.push('undo-1'), redo: () => calls.push('redo-1') });
	history.record({ undo: () => calls.push('undo-2'), redo: () => calls.push('redo-2') });

	history.undo();
	history.undo();
	assert.deepEqual(calls, ['undo-2', 'undo-1']);
	assert.equal(history.canUndo(), false);
	assert.equal(history.canRedo(), true);

	history.redo();
	history.redo();
	assert.deepEqual(calls, ['undo-2', 'undo-1', 'redo-1', 'redo-2']);
	assert.equal(history.canUndo(), true);
	assert.equal(history.canRedo(), false);
});

test('editor history ignores records created while applying history', () => {
	const history = new EditorHistory();
	let nestedRedoCalls = 0;
	let originalRedoCalls = 0;
	history.record({
		undo: () => {
			history.record({ undo: () => undefined, redo: () => { nestedRedoCalls += 1; } });
		},
		redo: () => { originalRedoCalls += 1; },
	});

	history.undo();
	assert.equal(history.canUndo(), false);
	assert.equal(history.canRedo(), true);
	history.redo();
	assert.equal(originalRedoCalls, 1);
	assert.equal(nestedRedoCalls, 0);
});

test('failed undo keeps the cursor on the same history entry', () => {
	const history = new EditorHistory();
	history.record({
		undo: () => { throw new Error('undo failed'); },
		redo: () => undefined,
	});

	assert.throws(() => history.undo(), /undo failed/);
	assert.equal(history.canUndo(), true);
	assert.equal(history.canRedo(), false);

	let secondUndoCalls = 0;
	history.record({ undo: () => { secondUndoCalls += 1; }, redo: () => undefined });
	history.undo();
	assert.equal(secondUndoCalls, 1);
});

test('failed redo keeps the cursor before the failed history entry', () => {
	const history = new EditorHistory();
	history.record({
		undo: () => undefined,
		redo: () => { throw new Error('redo failed'); },
	});
	history.undo();

	assert.throws(() => history.redo(), /redo failed/);
	assert.equal(history.canUndo(), false);
	assert.equal(history.canRedo(), true);
});

test('editor history retains at most the newest 200 entries', () => {
	const history = new EditorHistory();
	let undoCalls = 0;
	for (let i = 0; i < 205; i++) {
		history.record({ undo: () => { undoCalls += 1; }, redo: () => undefined });
	}
	while (history.canUndo()) history.undo();
	assert.equal(undoCalls, 200);
});

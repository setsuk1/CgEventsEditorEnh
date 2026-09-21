import assert from 'node:assert/strict';
import test from 'node:test';
import {
	resolveFormUndoRedoShortcut,
	shouldHandleFormEnterCommit,
	type FormShortcutContext,
} from '../webview/ui/utils/formUndoRedo';

function context(overrides: Partial<FormShortcutContext> = {}): FormShortcutContext {
	return {
		key: '',
		isComposing: false,
		defaultPrevented: false,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		inContainer: true,
		inMonaco: false,
		isInput: false,
		isContentEditable: false,
		...overrides,
	};
}

test('form undo redo policy resolves supported shortcuts inside the form', () => {
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true })), 'undo');
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', metaKey: true })), 'undo');
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true, shiftKey: true })), 'redo');
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'y', ctrlKey: true })), 'redo');
});

test('form undo redo policy preserves existing modifier and Monaco gating', () => {
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true, altKey: true })), undefined);
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true, inContainer: false })), undefined);
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true, isComposing: true })), undefined);
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true, defaultPrevented: true })), undefined);
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true, inMonaco: true })), undefined);
	assert.equal(resolveFormUndoRedoShortcut(context({ key: 'z', ctrlKey: true, inMonaco: true }), { allowInMonaco: true }), 'undo');
});

test('form Enter commit policy preserves input, modifier, and Monaco gating', () => {
	assert.equal(shouldHandleFormEnterCommit(context({ key: 'Enter', isInput: true })), true);
	assert.equal(shouldHandleFormEnterCommit(context({ key: 'Enter', isInput: false })), false);
	assert.equal(shouldHandleFormEnterCommit(context({ key: 'Enter', isInput: true, isContentEditable: true })), false);
	assert.equal(shouldHandleFormEnterCommit(context({ key: 'Enter', isInput: true, ctrlKey: true })), false);
	assert.equal(shouldHandleFormEnterCommit(context({ key: 'Enter', isInput: true, defaultPrevented: true })), false);
	assert.equal(shouldHandleFormEnterCommit(context({ key: 'Enter', isInput: true, inMonaco: true })), false);
	assert.equal(shouldHandleFormEnterCommit(context({ key: 'Enter', isInput: true, inMonaco: true }), { allowInMonaco: true }), true);
});

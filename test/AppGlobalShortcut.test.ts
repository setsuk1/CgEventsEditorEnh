import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppGlobalShortcut } from '../webview/ui/AppInteraction';

function shortcut(overrides: Partial<Parameters<typeof resolveAppGlobalShortcut>[0]> = {}) {
	return resolveAppGlobalShortcut({
		key: '',
		isComposing: false,
		defaultPrevented: false,
		ctrlKey: true,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		panelOpen: false,
		editableTarget: false,
		...overrides,
	});
}

test('app global shortcut resolves save, undo, and redo combinations', () => {
	assert.equal(shortcut({ key: 's' }), 'save');
	assert.equal(shortcut({ key: 'z' }), 'undo');
	assert.equal(shortcut({ key: 'z', shiftKey: true }), 'redo');
	assert.equal(shortcut({ key: 'y' }), 'redo');
	assert.equal(shortcut({ key: 'S' }), 'save');
});

test('app global shortcut keeps text-editor undo redo local while allowing save', () => {
	assert.equal(shortcut({ key: 'z', editableTarget: true }), undefined);
	assert.equal(shortcut({ key: 'y', editableTarget: true }), undefined);
	assert.equal(shortcut({ key: 's', editableTarget: true }), 'save');
});

test('app global shortcut rejects modified, consumed, composing, and panel-bound events', () => {
	assert.equal(shortcut({ key: 's', altKey: true }), undefined);
	assert.equal(shortcut({ key: 's', shiftKey: true }), undefined);
	assert.equal(shortcut({ key: 's', defaultPrevented: true }), undefined);
	assert.equal(shortcut({ key: 's', isComposing: true }), undefined);
	assert.equal(shortcut({ key: 's', panelOpen: true }), undefined);
	assert.equal(shortcut({ key: 's', ctrlKey: false, metaKey: false }), undefined);
	assert.equal(shortcut({ key: 'x' }), undefined);
});

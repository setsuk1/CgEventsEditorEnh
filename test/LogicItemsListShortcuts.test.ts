import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLogicListShortcut } from '../webview/ui/components/events/LogicItemsListShortcuts';

const base = {
	key: '',
	repeat: false,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	shiftKey: false,
	modalOpen: false,
	interactiveTarget: false,
	contextMode: undefined as 'section' | 'item' | undefined,
	hasActiveIndex: false,
};

test('logic-list Escape clears state even when modifier keys are held', () => {
	assert.deepEqual(resolveLogicListShortcut({
		...base,
		key: 'Escape',
		ctrlKey: true,
		shiftKey: true,
	}), { action: 'escape', consume: false });
});

test('logic-list clipboard shortcuts require an exact command modifier', () => {
	assert.deepEqual(resolveLogicListShortcut({
		...base,
		key: 'c',
		ctrlKey: true,
		hasActiveIndex: true,
	}), { action: 'selection-copy', consume: true });
	assert.deepEqual(resolveLogicListShortcut({
		...base,
		key: 'v',
		metaKey: true,
		contextMode: 'section',
	}), { action: 'section-paste', consume: true });

	assert.equal(resolveLogicListShortcut({
		...base,
		key: 'c',
		ctrlKey: true,
		shiftKey: true,
		hasActiveIndex: true,
	}), null);
	assert.equal(resolveLogicListShortcut({
		...base,
		key: 'x',
		ctrlKey: true,
		altKey: true,
		hasActiveIndex: true,
	}), null);
});

test('logic-list plain context shortcuts ignore Alt and Shift modified keys', () => {
	assert.deepEqual(resolveLogicListShortcut({
		...base,
		key: 'r',
		contextMode: 'item',
	}), { action: 'item-remove', consume: true });
	assert.equal(resolveLogicListShortcut({
		...base,
		key: 'r',
		altKey: true,
		contextMode: 'item',
	}), null);
	assert.equal(resolveLogicListShortcut({
		...base,
		key: 'd',
		shiftKey: true,
		contextMode: 'item',
	}), null);
});

test('logic-list section and item menu shortcuts map to distinct actions', () => {
	assert.deepEqual(resolveLogicListShortcut({
		...base,
		key: 'c',
		contextMode: 'section',
	}), { action: 'section-toggle', consume: true });
	assert.deepEqual(resolveLogicListShortcut({
		...base,
		key: 'c',
		contextMode: 'item',
	}), { action: 'item-toggle-section', consume: true });
	assert.deepEqual(resolveLogicListShortcut({
		...base,
		key: 'n',
		contextMode: 'section',
	}), { action: 'section-add', consume: true });
});

test('logic-list shortcuts are disabled for repeated, modal, or interactive events', () => {
	for (const patch of [
		{ repeat: true },
		{ modalOpen: true },
		{ interactiveTarget: true },
	]) {
		assert.equal(resolveLogicListShortcut({
			...base,
			key: 'r',
			contextMode: 'item',
			...patch,
		}), null);
	}
});

test('logic section shortcuts are blocked while a modal is open', () => {
	assert.equal(resolveLogicListShortcut({
		...base,
		key: 'r',
		modalOpen: true,
		contextMode: 'section',
	}), null);
	assert.equal(resolveLogicListShortcut({
		...base,
		key: 'c',
		ctrlKey: true,
		modalOpen: true,
		contextMode: 'section',
	}), null);
});

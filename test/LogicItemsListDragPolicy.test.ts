import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventLogicBlock } from '../shared/events';
import type { DraggedItem } from '../webview/ui/components/events/DragState';
import { resolveLogicDragSelection } from '../webview/ui/components/events/LogicItemsListInteraction';
import type { SelectedItem } from '../webview/ui/components/events/SelectionState';

function block(type: string): ICgEventLogicBlock {
	return { type, data: {} };
}

const clicked: DraggedItem = {
	eventId: 'event-a',
	blockType: 'action',
	index: 1,
	block: block('clicked'),
};

test('logic drag keeps the full selection when the clicked row is already selected', () => {
	const selection: SelectedItem[] = [
		{ eventId: 'event-a', blockType: 'action', index: 0, block: block('first') },
		clicked,
		{ eventId: 'event-b', blockType: 'action', index: 2, block: block('third') },
	];
	const plan = resolveLogicDragSelection(selection, clicked);
	assert.deepEqual(plan.entries, selection);
	assert.equal(plan.clearExistingSelectionOnStart, false);
});

test('logic drag uses only the clicked row and clears an unrelated prior selection on drag start', () => {
	const selection: SelectedItem[] = [
		{ eventId: 'event-b', blockType: 'action', index: 0, block: block('other') },
	];
	assert.deepEqual(resolveLogicDragSelection(selection, clicked), {
		entries: [clicked],
		clearExistingSelectionOnStart: true,
	});
});

test('logic drag uses only the clicked row when there is no existing selection', () => {
	assert.deepEqual(resolveLogicDragSelection([], clicked), {
		entries: [clicked],
		clearExistingSelectionOnStart: false,
	});
});

test('logic drag ignores incomplete selected entries and missing clicked blocks', () => {
	const incomplete: SelectedItem[] = [
		{ eventId: 'event-a', blockType: 'action', index: 1 },
	];
	assert.deepEqual(resolveLogicDragSelection(incomplete, clicked), {
		entries: [clicked],
		clearExistingSelectionOnStart: false,
	});
	assert.deepEqual(resolveLogicDragSelection(incomplete, null), {
		entries: [],
		clearExistingSelectionOnStart: false,
	});
});

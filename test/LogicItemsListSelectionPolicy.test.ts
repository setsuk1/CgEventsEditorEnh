import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventLogicBlock } from '../shared/events';
import {
	areLogicSelectionSetsEqual,
	resolveLogicActiveIndex,
	resolveLogicSelectionEntries,
} from '../webview/ui/components/events/LogicItemsListInteraction';
import type { SelectedItem } from '../webview/ui/components/events/SelectionState';

test('logic selection set comparison ignores insertion order', () => {
	assert.equal(
		areLogicSelectionSetsEqual(new Set([1, 2]), new Set([2, 1])),
		true,
	);
	assert.equal(
		areLogicSelectionSetsEqual(new Set([1]), new Set([1, 2])),
		false,
	);
});

test('logic active index prefers context, then local selection, then matching global selection', () => {
	assert.equal(resolveLogicActiveIndex(7, new Set([1, 2]), [0]), 7);
	assert.equal(resolveLogicActiveIndex(undefined, new Set([4, 2, 3]), [0]), 2);
	assert.equal(resolveLogicActiveIndex(undefined, new Set(), [5, 1, 3]), 1);
	assert.equal(resolveLogicActiveIndex(undefined, new Set(), []), undefined);
});

test('logic selection entries preserve the current selection before using a fallback row', () => {
	const selected: SelectedItem = {
		eventId: 'event-a',
		blockType: 'check',
		index: 0,
		block: { type: 'selected' } as ICgEventLogicBlock,
	};
	const fallback: SelectedItem = {
		eventId: 'event-a',
		blockType: 'check',
		index: 2,
		block: { type: 'fallback' } as ICgEventLogicBlock,
	};

	assert.deepEqual(resolveLogicSelectionEntries([selected], fallback), [selected]);
	assert.deepEqual(resolveLogicSelectionEntries([], fallback), [fallback]);
	assert.deepEqual(resolveLogicSelectionEntries([]), []);
});

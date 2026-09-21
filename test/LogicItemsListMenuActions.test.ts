import assert from 'node:assert/strict';
import test from 'node:test';
import {
	extractAllowedBlocks,
	getLogicSelectionTargets,
	getToggleDisableLabel,
	removeLogicEntries,
	toggleDisabledForEntries,
} from '../webview/ui/components/events/LogicItemsListMenuActions';
import type { SelectedItem } from '../webview/ui/components/events/SelectionState';
import { selectionStateManager } from '../webview/ui/components/events/SelectionState';

test('logic selection targets keep only entries from the requested block type', () => {
	const entries: SelectedItem[] = [
		{ eventId: 'event-a', blockType: 'action', index: 2 },
		{ eventId: 'event-b', blockType: 'check', index: 1 },
		{ eventId: 'event-c', blockType: 'action', index: 0 },
	];

	assert.deepEqual(getLogicSelectionTargets('action', entries), [
		{ eventId: 'event-a', index: 2 },
		{ eventId: 'event-c', index: 0 },
	]);
});

test('irrelevant remove and toggle actions do not clear an existing selection', () => {
	selectionStateManager.clearSelection();
	selectionStateManager.toggleIndex('event-a', 'check', 1);
	const checkEntries: SelectedItem[] = [
		{ eventId: 'event-a', blockType: 'check', index: 1 },
	];

	assert.equal(removeLogicEntries('action', checkEntries), false);
	assert.equal(selectionStateManager.hasSelection(), true);
	assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-a', 'check')), [1]);

	assert.equal(toggleDisabledForEntries('action', checkEntries), false);
	assert.equal(selectionStateManager.hasSelection(), true);
	assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-a', 'check')), [1]);

	selectionStateManager.clearSelection();
});

test('toggle disabled label follows the same truthiness semantics as the editor mutation', () => {
	const makeEntry = (disabled: unknown): SelectedItem => ({
		eventId: 'event-a',
		blockType: 'action',
		index: 0,
		block: { type: 'sample', data: { disabled } },
	});

	const enabledLabel = getToggleDisableLabel([makeEntry(false)], false);
	const truthyBooleanLabel = getToggleDisableLabel([makeEntry(true)], false);
	const truthyNumberLabel = getToggleDisableLabel([makeEntry(1)], false);
	const falsyNumberLabel = getToggleDisableLabel([makeEntry(0)], false);

	assert.equal(truthyNumberLabel, truthyBooleanLabel);
	assert.equal(falsyNumberLabel, enabledLabel);
	assert.notEqual(truthyBooleanLabel, enabledLabel);
});


test('clipboard block extraction reuses validation without normalizing output type text', () => {
	const blocks = extractAllowedBlocks(
		JSON.stringify([{ type: ' action ', data: { value: 1 } }, { type: 'second' }]),
		'action',
	);

	assert.deepEqual(blocks, [
		{ type: ' action ', data: { value: 1 } },
		{ type: 'second', data: {} },
	]);
});

test('clipboard block extraction rejects unsafe block data through shared validation', () => {
	const text = '[{"type":"action","data":{"__proto__":{"polluted":true}}}]';
	assert.deepEqual(extractAllowedBlocks(text, 'action'), []);
	assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});


test('clipboard block extraction rejects unsafe extra block keys before normalization', () => {
	const text = '[{"type":"action","__proto__":{"polluted":true}}]';
	assert.deepEqual(extractAllowedBlocks(text, 'action'), []);
	assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

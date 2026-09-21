import assert from 'node:assert/strict';
import test from 'node:test';
import { SelectionStateManager, selectionStateManager } from '../webview/ui/components/events/SelectionState';

test('empty selection index sets are isolated across callers', () => {
	selectionStateManager.clearSelection();

	const first = selectionStateManager.getSelectedIndicesForList('event-a', 'action');
	first.add(42);
	const second = selectionStateManager.getSelectedIndicesForList('event-b', 'action');

	assert.notStrictEqual(first, second);
	assert.deepEqual(Array.from(second), []);
});

test('selected index sets are snapshots of manager state', () => {
	selectionStateManager.clearSelection();
	selectionStateManager.toggleIndex('event-a', 'action', 1);

	const snapshot = selectionStateManager.getSelectedIndicesForList('event-a', 'action');
	snapshot.add(42);
	snapshot.delete(1);
	const current = selectionStateManager.getSelectedIndicesForList('event-a', 'action');

	assert.notStrictEqual(snapshot, current);
	assert.deepEqual(Array.from(current), [1]);
	selectionStateManager.clearSelection();
});

test('selecting an already fully selected list is a no-op', () => {
	selectionStateManager.clearSelection();
	let changes = 0;
	const onChange = () => { changes += 1; };
	selectionStateManager.on('change', onChange);
	try {
		selectionStateManager.selectAllForList('event-a', 'action', 3);
		assert.equal(changes, 1);
		assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-a', 'action')), [0, 1, 2]);

		selectionStateManager.selectAllForList('event-a', 'action', 3);
		assert.equal(changes, 1);

		selectionStateManager.selectAllForList('event-a', 'action', 2);
		assert.equal(changes, 2);
		assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-a', 'action')), [0, 1]);
	} finally {
		selectionStateManager.off('change', onChange);
		selectionStateManager.clearSelection();
	}
});

test('invalid selection indexes and counts do not create ghost state', () => {
	selectionStateManager.clearSelection();
	let changes = 0;
	const onChange = () => { changes += 1; };
	selectionStateManager.on('change', onChange);
	try {
		selectionStateManager.toggleIndex('event-a', 'action', Number.NaN);
		selectionStateManager.toggleIndex('event-a', 'action', Number.POSITIVE_INFINITY);
		selectionStateManager.toggleIndex('event-a', 'action', -1);
		selectionStateManager.selectAllForList('event-a', 'action', Number.NaN);
		selectionStateManager.selectAllForList('event-a', 'action', Number.POSITIVE_INFINITY);

		assert.equal(changes, 0);
		assert.equal(selectionStateManager.hasSelection(), false);
		assert.equal(selectionStateManager.getActiveSection(), undefined);

		selectionStateManager.toggleIndex('event-a', 'action', 1.9);
		assert.equal(changes, 1);
		assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-a', 'action')), [1]);

		selectionStateManager.selectAllForList('event-a', 'action', 0);
		assert.equal(changes, 2);
		assert.equal(selectionStateManager.hasSelection(), false);
	} finally {
		selectionStateManager.off('change', onChange);
		selectionStateManager.clearSelection();
	}
});


test('event rename preserves logic selection under the new event id', () => {
	selectionStateManager.clearSelection();
	selectionStateManager.toggleIndex('event-old', 'check', 2);
	selectionStateManager.renameEvent('event-old', 'event-new');

	assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-old', 'check')), []);
	assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-new', 'check')), [2]);
	assert.equal(selectionStateManager.getActiveSection(), 'check');
	selectionStateManager.clearSelection();
});

test('event pruning removes ghost selections and keeps surviving selection state', () => {
	selectionStateManager.clearSelection();
	selectionStateManager.toggleIndex('event-a', 'action', 0);
	selectionStateManager.toggleIndex('event-b', 'action', 1);

	selectionStateManager.pruneEvents(['event-b']);
	assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-a', 'action')), []);
	assert.deepEqual(Array.from(selectionStateManager.getSelectedIndicesForList('event-b', 'action')), [1]);
	assert.equal(selectionStateManager.getActiveSection(), 'action');

	selectionStateManager.pruneEvents([]);
	assert.equal(selectionStateManager.hasSelection(), false);
	assert.equal(selectionStateManager.getActiveSection(), undefined);
});


test('clearing a logic section only affects selection from that section', () => {
	selectionStateManager.clearSelection();
	selectionStateManager.toggleIndex('event-a', 'check', 1);

	selectionStateManager.clearSection('action');
	assert.equal(selectionStateManager.hasSelection(), true);
	assert.equal(selectionStateManager.getActiveSection(), 'check');

	selectionStateManager.clearSection('check');
	assert.equal(selectionStateManager.hasSelection(), false);
	assert.equal(selectionStateManager.getActiveSection(), undefined);
});


test('event reconciliation renames before pruning old event ids', () => {
	const selection = new SelectionStateManager();
	selection.toggleIndex('event-old', 'action', 2);
	selection.reconcileEvents(
		{ previousEventId: 'event-old', eventId: 'event-new' },
		['event-new'],
	);
	assert.deepEqual(Array.from(selection.getSelectedIndicesForList('event-new', 'action')), [2]);
	assert.equal(selection.hasSelection(), true);
});

test('event reconciliation prunes removed events without a rename', () => {
	const selection = new SelectionStateManager();
	selection.toggleIndex('event-a', 'check', 0);
	selection.toggleIndex('event-b', 'check', 1);
	selection.reconcileEvents(undefined, ['event-b']);
	assert.deepEqual(Array.from(selection.getSelectedIndicesForList('event-a', 'check')), []);
	assert.deepEqual(Array.from(selection.getSelectedIndicesForList('event-b', 'check')), [1]);
});

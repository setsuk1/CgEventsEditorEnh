import assert from 'node:assert/strict';
import test from 'node:test';
import { createLogicContextMenuId } from '../webview/ui/components/events/ContextMenuState';

test('logic context menu ids separate header, list, and item owners', () => {
	const header = createLogicContextMenuId('section-header', 'event-a', 'action');
	const list = createLogicContextMenuId('list-section', 'event-a', 'action');
	const item = createLogicContextMenuId('list-item', 'event-a', 'action', 0);

	assert.notEqual(header, list);
	assert.notEqual(header, item);
	assert.notEqual(list, item);
});

test('logic context menu item ids distinguish indexes without ambiguous concatenation', () => {
	assert.notEqual(
		createLogicContextMenuId('list-item', 'event-1', 'check', 2),
		createLogicContextMenuId('list-item', 'event-1', 'check', 12),
	);
});

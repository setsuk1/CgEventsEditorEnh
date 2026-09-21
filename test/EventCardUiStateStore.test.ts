import assert from 'node:assert/strict';
import test from 'node:test';
import { EventCardUiStateStore } from '../webview/ui/components/events/EventCardUiStateStore';

test('event card UI state rename preserves collapsed state', () => {
	const store = new EventCardUiStateStore();
	store.setCollapsed('before', true);
	store.setBlockCollapsed('before', 'check', true);

	store.rename('before', 'after');

	assert.equal(store.get('before'), undefined);
	assert.equal(store.get('after')?.collapsed, true);
	assert.equal(store.get('after')?.blockCollapsed.check, true);
	assert.equal(store.get('after')?.blockCollapsed.action, false);
});

test('event card UI state rename is a no-op for missing or identical IDs', () => {
	const store = new EventCardUiStateStore();
	store.setCollapsed('event-a', true);

	store.rename('missing', 'event-b');
	store.rename('event-a', 'event-a');

	assert.equal(store.get('event-b'), undefined);
	assert.equal(store.get('event-a')?.collapsed, true);
});

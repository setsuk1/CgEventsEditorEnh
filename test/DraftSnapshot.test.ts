import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneDraftSnapshot, isDraftSnapshotCurrent } from '../webview/ui/utils/draftSnapshot';

test('draft snapshots compare semantic content instead of object identity', () => {
	const initial = { stage: { width: 800 }, preload: { sources: ['a'] } };
	assert.equal(isDraftSnapshotCurrent(initial, { stage: { width: 800 }, preload: { sources: ['a'] } }), true);
	assert.equal(isDraftSnapshotCurrent(initial, { stage: { width: 1024 }, preload: { sources: ['a'] } }), false);
});

test('cloned draft snapshots are isolated from later mutations', () => {
	const source = { nested: { value: 1 } };
	const snapshot = cloneDraftSnapshot(source);
	source.nested.value = 2;
	assert.deepEqual(snapshot, { nested: { value: 1 } });
});

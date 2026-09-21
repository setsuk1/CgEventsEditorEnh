import assert from 'node:assert/strict';
import test from 'node:test';
import { collectLogicDataChanges, hasLogicDataConflict, isLogicDataObject, isLogicListSnapshotCurrent } from '../webview/ui/components/events/LogicDataDraft';

test('logic data drafts require JSON objects', () => {
	assert.equal(isLogicDataObject({}), true);
	assert.equal(isLogicDataObject({ value: 1 }), true);
	assert.equal(isLogicDataObject([]), false);
	assert.equal(isLogicDataObject(null), false);
	assert.equal(isLogicDataObject('value'), false);
	assert.equal(isLogicDataObject(1), false);
});

test('logic data changes treat removed prototype-like keys as missing own values', () => {
	const previous = { toString: 'custom', nested: { value: 1 } };
	const next = { nested: { value: 2 } };

	assert.deepEqual(collectLogicDataChanges(previous, next), [
		{ path: ['toString'], value: undefined },
		{ path: ['nested', 'value'], value: 2 },
	]);
});

test('logic data changes ignore inherited values when an own key is removed', () => {
	const previous = { valueOf: 'custom' };
	const next = Object.create({ valueOf: 'inherited' });

	assert.deepEqual(collectLogicDataChanges(previous, next), [
		{ path: ['valueOf'], value: undefined },
	]);
});

test('logic list snapshot comparison detects external content changes', () => {
	const initial = [{ type: 'sample', data: { value: 1 } }];
	assert.equal(isLogicListSnapshotCurrent(initial, [{ type: 'sample', data: { value: 1 } }]), true);
	assert.equal(isLogicListSnapshotCurrent(initial, [{ type: 'sample', data: { value: 2 } }]), false);
	assert.equal(isLogicListSnapshotCurrent(initial, [...initial, { type: 'other', data: {} }]), false);
});

test('logic data conflict detection rejects only overlapping external edits', () => {
	const initial = { left: 1, right: 1, toString: 'initial' };
	const draft = { left: 2, right: 1 };
	const changes = collectLogicDataChanges(initial, draft);

	assert.equal(hasLogicDataConflict(initial, { left: 1, right: 9, toString: 'initial' }, changes), false);
	assert.equal(hasLogicDataConflict(initial, { left: 3, right: 1, toString: 'initial' }, changes), true);
	assert.equal(hasLogicDataConflict(initial, { left: 1, right: 1 }, changes), true);
});

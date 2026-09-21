import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDocumentSaveAction } from '../src/utils/documentSavePlan';

function plan(overrides: Partial<Parameters<typeof resolveDocumentSaveAction>[0]> = {}) {
	return resolveDocumentSaveAction({
		baseVersion: 5,
		currentVersion: 5,
		serializedText: 'next',
		currentText: 'current',
		isDirty: false,
		...overrides,
	});
}

test('document save plan sends an unchanged clean document without writing', () => {
	assert.equal(plan({ serializedText: 'same', currentText: 'same' }), 'send-current');
});

test('document save plan saves an unchanged dirty document before syncing', () => {
	assert.equal(
		plan({ serializedText: 'same', currentText: 'same', isDirty: true }),
		'save-current',
	);
});

test('document save plan applies current and accepted queued snapshots', () => {
	assert.equal(plan(), 'apply-edit');
	assert.equal(plan({
		baseVersion: 4,
		currentVersion: 5,
		acceptedBaseVersion: 4,
		lastAppliedVersion: 5,
	}), 'apply-edit');
});

test('document save plan rejects stale, versionless, and mismatched queued replacements', () => {
	assert.equal(plan({ baseVersion: 4, currentVersion: 5 }), 'reject-stale');
	assert.equal(plan({ baseVersion: undefined, currentVersion: 5 }), 'reject-stale');
	assert.equal(plan({
		baseVersion: 4,
		currentVersion: 6,
		acceptedBaseVersion: 4,
		lastAppliedVersion: 5,
	}), 'reject-stale');
	assert.equal(plan({
		baseVersion: 3,
		currentVersion: 5,
		acceptedBaseVersion: 4,
		lastAppliedVersion: 5,
	}), 'reject-stale');
});

test('document save plan allows text-identical snapshots even with stale versions', () => {
	assert.equal(plan({
		baseVersion: 1,
		currentVersion: 9,
		serializedText: 'same',
		currentText: 'same',
	}), 'send-current');
});

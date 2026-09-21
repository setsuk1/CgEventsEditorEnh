import assert from 'node:assert/strict';
import test from 'node:test';
import { createSafeRecord, getOrCreateOwn } from '../webview/ui/utils/safeRecord';

test('safe records support Object prototype-like keys without inheritance collisions', () => {
	const record = createSafeRecord<{ name: string }>();

	for (const key of ['__proto__', 'constructor', 'toString']) {
		const value = getOrCreateOwn(record, key, () => ({ name: key }));
		assert.equal(value.name, key);
		assert.equal(Object.prototype.hasOwnProperty.call(record, key), true);
		assert.strictEqual(getOrCreateOwn(record, key, () => ({ name: 'replacement' })), value);
	}

	assert.strictEqual(Object.getPrototypeOf(record), null);
	assert.deepEqual(Object.keys(record), ['__proto__', 'constructor', 'toString']);
});

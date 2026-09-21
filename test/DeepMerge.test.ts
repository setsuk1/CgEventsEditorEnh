import assert from 'node:assert/strict';
import test from 'node:test';
import { deepMergeDefined } from '../webview/ui/utils/deepMerge';

test('defined deep merge recursively merges objects and replaces arrays', () => {
	const target = {
		nested: { keep: 1, replace: 2 },
		list: [1, 2],
		keepUndefined: 3,
	};
	const source = {
		nested: { replace: 4, added: 5 },
		list: [9],
		keepUndefined: undefined as number | undefined,
	};

	assert.deepEqual(deepMergeDefined(target, source), {
		nested: { keep: 1, replace: 4, added: 5 },
		list: [9],
		keepUndefined: 3,
	});
	assert.deepEqual(target, {
		nested: { keep: 1, replace: 2 },
		list: [1, 2],
		keepUndefined: 3,
	});
});

test('defined deep merge preserves source replacement semantics for primitives', () => {
	assert.equal(deepMergeDefined({ value: 1 }, null), null);
	assert.equal(deepMergeDefined({ value: 1 }, 5), 5);
	assert.deepEqual(deepMergeDefined({ value: 1 }, [2, 3]), [2, 3]);
	assert.deepEqual(deepMergeDefined({ value: 1 }, undefined), { value: 1 });
});

test('defined deep merge strips prototype-sensitive keys without polluting prototypes', () => {
	const target = JSON.parse('{"safe":{"keep":1},"constructor":{"bad":true}}');
	const source = JSON.parse('{"safe":{"added":2},"__proto__":{"polluted":true},"prototype":{"bad":true}}');

	const result = deepMergeDefined(target, source);

	assert.deepEqual(result, { safe: { keep: 1, added: 2 } });
	assert.equal(Object.prototype.hasOwnProperty.call(result, '__proto__'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(result, 'constructor'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(result, 'prototype'), false);
	assert.equal((Object.prototype as any).polluted, undefined);
});

test('defined deep merge sanitizes object sources without an object target', () => {
	const source = JSON.parse('{"safe":{"value":1,"constructor":{"bad":true}},"__proto__":{"polluted":true}}');

	const result = deepMergeDefined(undefined, source);

	assert.deepEqual(result, { safe: { value: 1 } });
	assert.equal(Object.prototype.hasOwnProperty.call(result, '__proto__'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(result.safe, 'constructor'), false);
	assert.equal((Object.prototype as any).polluted, undefined);
});

test('defined deep merge still supports ordinary prototype-shadowing names', () => {
	const result = deepMergeDefined(
		{ toString: { keep: true } },
		{ toString: { added: true } },
	);

	assert.deepEqual(result, { toString: { keep: true, added: true } });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getOwnPropertyValue, getOwnValueAtPath, getOwnValueByDottedPath, setOwnValueAtPath } from '../webview/utils/ownPath';

test('own-property lookup ignores inherited and prototype-sensitive keys', () => {
	const value = Object.create({ inherited: 'bad' }) as Record<string, unknown>;
	value.safe = 'ok';
	assert.equal(getOwnPropertyValue(value, 'safe'), 'ok');
	assert.equal(getOwnPropertyValue(value, 'inherited'), undefined);
	assert.equal(getOwnPropertyValue(value, 'toString'), undefined);
	assert.equal(getOwnPropertyValue(value, '__proto__'), undefined);
	assert.equal(getOwnPropertyValue(value, 'constructor'), undefined);
});

test('array paths preserve literal dotted property names', () => {
	const value = { 'group.name': { child: 42 } };
	assert.equal(getOwnValueAtPath(value, ['group.name', 'child']), 42);
	assert.equal(getOwnValueByDottedPath(value, 'group.name.child'), undefined);
});

test('dotted paths only traverse own properties', () => {
	const nested = Object.create({ inherited: 'bad' }) as Record<string, unknown>;
	nested.child = 'ok';
	const value = { nested };
	assert.equal(getOwnValueByDottedPath(value, 'nested.child'), 'ok');
	assert.equal(getOwnValueByDottedPath(value, 'nested.inherited'), undefined);
});

test('own-safe path updates clone only the traversed containers', () => {
	const value = {
		nested: { value: 1, keep: true },
		list: [{ value: 2 }],
		'group.name': { child: 3 },
	};
	const nestedUpdate = setOwnValueAtPath(value, ['nested', 'value'], 10) as typeof value;
	assert.notStrictEqual(nestedUpdate, value);
	assert.notStrictEqual(nestedUpdate.nested, value.nested);
	assert.strictEqual(nestedUpdate.list, value.list);
	assert.equal(nestedUpdate.nested.value, 10);
	assert.equal(value.nested.value, 1);

	const arrayUpdate = setOwnValueAtPath(value, ['list', 0, 'value'], 20) as typeof value;
	assert.notStrictEqual(arrayUpdate.list, value.list);
	assert.notStrictEqual(arrayUpdate.list[0], value.list[0]);
	assert.equal(arrayUpdate.list[0].value, 20);

	const dottedKeyUpdate = setOwnValueAtPath(value, ['group.name', 'child'], 30) as typeof value;
	assert.equal(dottedKeyUpdate['group.name'].child, 30);
});

test('own-safe path updates do not traverse inherited child objects', () => {
	const inherited = { child: { value: 1 } };
	const value = Object.create(inherited) as Record<string, unknown>;
	value.safe = true;

	const updated = setOwnValueAtPath(value, ['child', 'value'], 2) as Record<string, any>;

	assert.equal(Object.prototype.hasOwnProperty.call(updated, 'child'), true);
	assert.deepEqual(updated.child, { value: 2 });
	assert.equal(inherited.child.value, 1);
});

test('own-safe path updates reject prototype-sensitive segments without cloning', () => {
	const value = { safe: { child: 1 } };
	for (const path of [
		['__proto__', 'polluted'],
		['safe', 'prototype', 'polluted'],
		['constructor', 'prototype', 'polluted'],
	] as string[][]) {
		assert.strictEqual(setOwnValueAtPath(value, path, true), value);
	}
	assert.equal((Object.prototype as any).polluted, undefined);
});

test('array paths accept only canonical non-negative integer indexes', () => {
	const value = ['zero', 'one'];
	assert.equal(getOwnValueAtPath(value, [0]), 'zero');
	assert.equal(getOwnValueAtPath(value, ['1']), 'one');

	for (const segment of ['length', '-1', '1.5', '01', 'name']) {
		assert.equal(getOwnValueAtPath(value, [segment]), undefined);
	}
});

test('array path updates reject non-index properties without cloning or mutating', () => {
	const value = { rows: ['zero', 'one'] };
	for (const segment of ['length', '-1', '1.5', '01', 'name']) {
		const updated = setOwnValueAtPath(value, ['rows', segment], 'bad');
		assert.strictEqual(updated, value);
	}
	assert.deepEqual(value, { rows: ['zero', 'one'] });

	const updated = setOwnValueAtPath(value, ['rows', '1'], 'updated') as typeof value;
	assert.notStrictEqual(updated, value);
	assert.deepEqual(updated, { rows: ['zero', 'updated'] });
});

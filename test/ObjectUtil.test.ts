import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectUtil } from '../shared/utils/ObjectUtil';

test('ObjectUtil.map maps ordinary own properties', () => {
	assert.deepEqual(
		ObjectUtil.map({ a: 1, b: 2 }, (_key, value) => value * 2),
		{ a: 2, b: 4 },
	);
});

test('ObjectUtil.map skips prototype-sensitive keys', () => {
	const source = JSON.parse('{"safe":1,"__proto__":{"polluted":true},"constructor":2,"prototype":3}');
	const visited: string[] = [];

	const result = ObjectUtil.map(source, (key, value) => {
		visited.push(key);
		return value;
	});

	assert.deepEqual(visited, ['safe']);
	assert.deepEqual(result, { safe: 1 });
	assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('ObjectUtil.forEach skips prototype-sensitive keys', () => {
	const source = JSON.parse('{"safe":1,"__proto__":{"polluted":true},"constructor":2,"prototype":3}');
	const visited: Array<[string, unknown]> = [];

	ObjectUtil.forEach(source, (key, value) => {
		visited.push([key, value]);
	});

	assert.deepEqual(visited, [['safe', 1]]);
	assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

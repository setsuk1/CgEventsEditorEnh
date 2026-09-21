import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSortingPresetsRecord } from '../src/utils/sortingPresets';

const validRules = [{ order: 'asc', target: 'id' }];

test('sorting preset sanitizer keeps valid preset records', () => {
	const result = sanitizeSortingPresetsRecord({
		Alpha: validRules,
		Beta: [{ order: 'desc', target: 'folder' }],
	});

	assert.deepEqual({ ...result }, {
		Alpha: validRules,
		Beta: [{ order: 'desc', target: 'folder' }],
	});
	assert.equal(Object.getPrototypeOf(result), null);
});

test('sorting preset sanitizer drops malformed and unsafe entries', () => {
	const input = JSON.parse(JSON.stringify({
		' padded ': validRules,
		'': validRules,
		BadRule: [{ order: 'sideways', target: 'id' }],
		Good: validRules,
	})) as Record<string, unknown>;
	Object.defineProperty(input, '__proto__', {
		value: validRules,
		enumerable: true,
		configurable: true,
	});

	const result = sanitizeSortingPresetsRecord(input);
	assert.deepEqual({ ...result }, { Good: validRules });
});

test('sorting preset sanitizer returns an empty null-prototype record for non-records', () => {
	const invalidValues: unknown[] = [undefined, null, 'text', [], 42];
	for (const value of invalidValues) {
		const result = sanitizeSortingPresetsRecord(value);
		assert.equal(Object.keys(result).length, 0);
		assert.equal(Object.getPrototypeOf(result), null);
	}
});

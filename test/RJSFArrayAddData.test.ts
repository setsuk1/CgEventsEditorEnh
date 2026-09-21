import assert from 'node:assert/strict';
import test from 'node:test';
import {
	applyRjsfArrayAddDefaults,
	createPendingRjsfArrayAdd,
} from '../webview/ui/rjsf/rjsfDefaultValues';

test('array-add registration accepts only non-negative integer indexes and record schemas', () => {
	const path: Array<string | number> = ['rows'];
	const itemSchema = { type: 'object' };
	const pending = createPendingRjsfArrayAdd(path, 1, itemSchema);
	assert.deepEqual(pending, { path: ['rows'], index: 1, itemSchema });
	assert.notStrictEqual(pending?.path, path);

	for (const index of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
		assert.equal(createPendingRjsfArrayAdd(path, index, itemSchema), undefined);
	}
	assert.equal(createPendingRjsfArrayAdd('rows', 0, itemSchema), undefined);
	assert.equal(createPendingRjsfArrayAdd(['rows', 1.5], 0, itemSchema), undefined);
	assert.equal(createPendingRjsfArrayAdd(path, 0, null), undefined);
});

test('array-add defaults merge missing object fields without overwriting the new row', () => {
	const data = {
		rows: [{ name: 'custom', nested: { keep: 2 } }],
	};
	const pending = createPendingRjsfArrayAdd(['rows'], 0, { type: 'object' })!;
	const result = applyRjsfArrayAddDefaults(
		data,
		pending,
		{ name: 'default', enabled: true, nested: { keep: 1, add: 3 } },
	);

	assert.deepEqual(result, {
		rows: [{ name: 'custom', enabled: true, nested: { keep: 2, add: 3 } }],
	});
	assert.deepEqual(data, {
		rows: [{ name: 'custom', nested: { keep: 2 } }],
	});
});

test('array-add defaults preserve primitive rows and unchanged references', () => {
	const primitiveData = { rows: ['custom'] };
	const pending = createPendingRjsfArrayAdd(['rows'], 0, { type: 'string' })!;
	assert.strictEqual(
		applyRjsfArrayAddDefaults(primitiveData, pending, 'default'),
		primitiveData,
	);

	const missing: { rows: unknown[] } = { rows: [] };
	assert.strictEqual(
		applyRjsfArrayAddDefaults(missing, pending, { value: 1 }),
		missing,
	);
	const unchanged = { rows: [{}] };
	assert.strictEqual(
		applyRjsfArrayAddDefaults(unchanged, pending, undefined),
		unchanged,
	);
});

test('array-add defaults can initialize an undefined row value', () => {
	const data: { rows: unknown[] } = { rows: [undefined] };
	const pending = createPendingRjsfArrayAdd(['rows'], 0, { type: 'object' })!;
	assert.deepEqual(
		applyRjsfArrayAddDefaults(data, pending, { enabled: true }),
		{ rows: [{ enabled: true }] },
	);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getCheckboxValueKey,
	groupCheckboxItems,
	normalizeCheckboxOptionItems,
	normalizeCheckboxValue,
	parseCheckboxValues,
	resolveCheckboxGroupValues,
	resolveCheckboxSelectAllValues,
	toggleCheckboxItemValue,
} from '../webview/ui/rjsf/widgets/CheckboxListData';

test('checkbox values preserve primitive identity while normalizing strings', () => {
	assert.equal(normalizeCheckboxValue(' value '), 'value');
	assert.equal(normalizeCheckboxValue('   '), undefined);
	assert.equal(normalizeCheckboxValue(0), 0);
	assert.equal(normalizeCheckboxValue(false), false);
	assert.equal(normalizeCheckboxValue(Number.NaN), undefined);
	assert.notEqual(getCheckboxValueKey('1'), getCheckboxValueKey(1));
});

test('checkbox value parsing supports arrays and comma-separated strings', () => {
	assert.deepEqual(parseCheckboxValues([' a ', 2, false, null]), ['a', 2, false]);
	assert.deepEqual(parseCheckboxValues(' a, b ,, c '), ['a', 'b', 'c']);
});

test('checkbox options are deduplicated by typed value key and preserve labels', () => {
	assert.deepEqual(
		normalizeCheckboxOptionItems(['a', 'a', 1, '1'], [' A ', 'duplicate', 'One', 'String One']),
		[
			{ key: 'string:a', value: 'a', displayName: 'A' },
			{ key: 'number:1', value: 1, displayName: 'One' },
			{ key: 'string:1', value: '1', displayName: 'String One' },
		],
	);
});

test('checkbox grouping supports extensions and prefixes', () => {
	const items = normalizeCheckboxOptionItems(['foo.bar', 'foo.baz', 'plain']);
	const byExtension = groupCheckboxItems(items, 'extension', 'Other');
	assert.deepEqual([...byExtension.keys()], ['bar', 'baz', 'Other']);

	const byPrefix = groupCheckboxItems(items, 'prefix', 'Other');
	assert.deepEqual([...byPrefix.keys()], ['foo', 'Other']);
	assert.deepEqual(byPrefix.get('foo')?.map((item) => item.displayName), ['bar', 'baz']);
});


test('checkbox item toggles preserve typed selected values', () => {
	const item = { key: 'string:a', value: 'a' as const, displayName: 'a' };
	assert.deepEqual(toggleCheckboxItemValue([], item), ['a']);
	assert.deepEqual(toggleCheckboxItemValue(['a', 1], item), [1]);
});

test('checkbox select-all resolves normal and inverted storage semantics', () => {
	const values = ['a', 'b'] as const;
	assert.deepEqual(resolveCheckboxSelectAllValues(values, false, false), ['a', 'b']);
	assert.deepEqual(resolveCheckboxSelectAllValues(values, true, false), []);
	assert.deepEqual(resolveCheckboxSelectAllValues(values, false, true), []);
	assert.deepEqual(resolveCheckboxSelectAllValues(values, true, true), ['a', 'b']);
});

test('checkbox group updates only the target group for normal and inverted storage', () => {
	const items = normalizeCheckboxOptionItems(['a', 'b']);
	assert.deepEqual(resolveCheckboxGroupValues(['x'], items, false, false), ['x', 'a', 'b']);
	assert.deepEqual(resolveCheckboxGroupValues(['x', 'a'], items, true, false), ['x']);
	assert.deepEqual(resolveCheckboxGroupValues(['x', 'a'], items, false, true), ['x']);
	assert.deepEqual(resolveCheckboxGroupValues(['x'], items, true, true), ['x', 'a', 'b']);
});

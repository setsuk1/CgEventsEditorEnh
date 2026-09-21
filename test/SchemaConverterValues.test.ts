import assert from 'node:assert/strict';
import test from 'node:test';
import {
	convertSchemaPropertyType,
	getEffectiveDefaultValue,
	normalizeSchemaFormat,
	normalizeDefinitionKey,
	resolveDefinitionName,
} from '../webview/ui/rjsf/schemaConverterValues';

test('definition keys normalize supported reference syntaxes', () => {
	assert.equal(normalizeDefinitionKey('#/definitions/Sample'), 'Sample');
	assert.equal(normalizeDefinitionKey('#Sample'), 'Sample');
	assert.equal(normalizeDefinitionKey('@Sample'), 'Sample');
	assert.equal(normalizeDefinitionKey(' Sample ', true), 'Sample');
	assert.equal(normalizeDefinitionKey('Sample'), null);
	assert.equal(normalizeDefinitionKey('   ', true), null);
	assert.equal(normalizeDefinitionKey(undefined, true), null);
});

test('definition resolution follows direct, type, and array item references', () => {
	assert.equal(resolveDefinitionName({ key: 'x', definition: 'Direct', type: '#Ignored' }), 'Direct');
	assert.equal(resolveDefinitionName({ key: 'x', type: '#ByType' }), 'ByType');
	assert.equal(resolveDefinitionName({ key: 'x', type: 'array', arrayItem: '@ArrayItem' }), 'ArrayItem');
	assert.equal(resolveDefinitionName({
		key: 'x',
		type: 'array',
		items: { key: 'item', definition: 'Nested' },
	}), 'Nested');
	assert.equal(resolveDefinitionName({ key: 'x', type: 'string' }), null);
});

test('definition resolution can ignore array item references', () => {
	assert.equal(resolveDefinitionName({ key: 'x', type: 'array', arrayItem: '@ArrayItem' }, false), null);
	assert.equal(resolveDefinitionName({
		key: 'x',
		type: 'array',
		items: { key: 'item', definition: 'Nested' },
	}, false), null);
	assert.equal(resolveDefinitionName({ key: 'x', definition: 'Direct' }, false), 'Direct');
	assert.equal(resolveDefinitionName({ key: 'x', type: '#ByType' }, false), 'ByType');
});

test('schema property type conversion honors explicit formats before declared types', () => {
	assert.equal(convertSchemaPropertyType({ key: 'x', type: 'string', format: ' number ' }), 'number');
	assert.equal(convertSchemaPropertyType({ key: 'x', type: 'number', format: 'INT' }), 'integer');
	assert.equal(convertSchemaPropertyType({ key: 'x', type: 'object', format: 'color' }), 'string');
	assert.equal(convertSchemaPropertyType({ key: 'x', type: '#Linked' }), 'object');
	assert.equal(convertSchemaPropertyType({ key: 'x', type: 'color' }), 'string');
	assert.equal(convertSchemaPropertyType({ key: 'x' }), 'string');
});

test('effective defaults preserve string defaults and parse non-string defaults', () => {
	const localizedNumber = { en: '42', zh: '42' };
	const localizedObject = { en: '{"enabled":true}', zh: '{"enabled":true}' };

	assert.equal(getEffectiveDefaultValue({ key: 'x', type: 'string', default: localizedNumber }, 'string'), '42');
	assert.equal(getEffectiveDefaultValue({ key: 'x', type: 'number', default: localizedNumber }, 'number'), 42);
	assert.deepEqual(
		getEffectiveDefaultValue({ key: 'x', type: 'object', default: localizedObject }, 'object'),
		{ enabled: true },
	);
});

test('schema format normalization trims and lowercases string formats only', () => {
	assert.equal(normalizeSchemaFormat(' Grid '), 'grid');
	assert.equal(normalizeSchemaFormat('CgEditorLayout'), 'cgeditorlayout');
	assert.equal(normalizeSchemaFormat(''), '');
	assert.equal(normalizeSchemaFormat(undefined), '');
	assert.equal(normalizeSchemaFormat(42), '');
});

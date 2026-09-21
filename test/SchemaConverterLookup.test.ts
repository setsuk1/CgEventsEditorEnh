import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsSchema, ICgEventsSchemaEntry } from '../shared/schema';
import { convertFullSchema } from '../webview/ui/rjsf/schemaConverter';

function entry(properties: ICgEventsSchemaEntry['properties'] = []): ICgEventsSchemaEntry {
	return {
		project: '',
		source: { path: '', filename: '' },
		toString: {},
		className: '',
		timestamp: 1,
		label: {},
		description: {},
		allpaths: {},
		properties,
	};
}

function emptySchema(): ICgEventsSchema {
	return { trigger: {}, check: {}, action: {}, definition: {} };
}

test('schema converter treats missing prototype-named entries as missing', () => {
	const schema = emptySchema();
	const converted = convertFullSchema(schema, 'toString', 'action');
	assert.deepEqual(converted.schema, { type: 'object', properties: {} });
	assert.deepEqual(converted.uiSchema, {});
});

test('schema converter ignores inherited prototype members for missing definition references', () => {
	const schema = emptySchema();
	schema.action.sample = entry([{ key: 'linked', definition: 'toString' }]);
	assert.doesNotThrow(() => convertFullSchema(schema, 'sample', 'action'));
});

test('schema converter supports own prototype-shadowing parent keys', () => {
	const schema = emptySchema();
	schema.action.sample = entry([
		{ key: 'toString', type: 'object' },
		{ key: 'child', type: 'string', parent: 'toString' },
	]);

	const converted = convertFullSchema(schema, 'sample', 'action');
	const parentSchema = converted.schema.properties?.['toString'];
	assert.equal(typeof parentSchema, 'object');
	assert.equal(Array.isArray(parentSchema), false);
	if (!parentSchema || typeof parentSchema === 'boolean') return;
	assert.equal(parentSchema.type, 'object');
	assert.equal(typeof parentSchema.properties?.child, 'object');
});

test('schema converter still resolves own prototype-shadowing entries', () => {
	const schema = emptySchema();
	schema.action['toString'] = entry([{ key: 'value', type: 'string' }]);
	const converted = convertFullSchema(schema, 'toString', 'action');
	assert.equal(typeof converted.schema.properties?.value, 'object');
});


test('schema converter uses references for known array item definitions', () => {
	const schema = emptySchema();
	schema.definition.Shared = entry([{ key: 'value', type: 'string' }]);
	schema.action.sample = entry([
		{ key: 'items', type: 'array', definition: 'Shared' },
	]);

	const converted = convertFullSchema(schema, 'sample', 'action');
	const items = converted.schema.properties?.items;
	assert.ok(items && typeof items !== 'boolean');
	assert.equal(items.type, 'array');
	assert.deepEqual(items.items, { $ref: '#/definitions/Shared' });
	assert.ok(converted.schema.definitions?.Shared);
});

test('schema converter keeps the empty-object fallback for missing array item definitions', () => {
	const schema = emptySchema();
	schema.action.sample = entry([
		{ key: 'items', type: 'array', definition: 'Missing' },
	]);

	const converted = convertFullSchema(schema, 'sample', 'action');
	const items = converted.schema.properties?.items;
	assert.ok(items && typeof items !== 'boolean');
	assert.equal(items.type, 'array');
	assert.deepEqual(items.items, { type: 'object', properties: {} });
});


test('schema converter preserves multi-level parent hierarchies', () => {
	const schema = emptySchema();
	schema.action.sample = entry([
		{ key: 'outer', type: 'object' },
		{ key: 'inner', type: 'object', parent: 'outer' },
		{ key: 'value', type: 'string', parent: 'inner', required: 1 },
	]);

	const converted = convertFullSchema(schema, 'sample', 'action');
	const outer = converted.schema.properties?.outer;
	assert.ok(outer && typeof outer !== 'boolean');
	const inner = outer.properties?.inner;
	assert.ok(inner && typeof inner !== 'boolean');
	const value = inner.properties?.value;
	assert.ok(value && typeof value !== 'boolean');
	assert.equal(value.type, 'string');
	assert.equal(value.minLength, 1);
	assert.deepEqual(inner.required, ['value']);
	assert.deepEqual(converted.uiSchema.outer?.['ui:order'], ['inner']);
	assert.deepEqual(converted.uiSchema.outer?.inner?.['ui:order'], ['value']);
});


test('schema converter preserves nested parents inside array items', () => {
	const schema = emptySchema();
	schema.action.sample = entry([
		{ key: 'rows', type: 'array' },
		{ key: 'group', type: 'object', parent: 'rows' },
		{ key: 'name', type: 'string', parent: 'group' },
	]);

	const converted = convertFullSchema(schema, 'sample', 'action');
	const rows = converted.schema.properties?.rows;
	assert.ok(rows && typeof rows !== 'boolean');
	assert.equal(rows.type, 'array');
	const rowItems = rows.items;
	assert.ok(rowItems && !Array.isArray(rowItems) && typeof rowItems !== 'boolean');
	const group = rowItems.properties?.group;
	assert.ok(group && typeof group !== 'boolean');
	assert.equal(typeof group.properties?.name, 'object');
	assert.deepEqual(converted.uiSchema.rows?.items?.['ui:order'], ['group']);
	assert.deepEqual(converted.uiSchema.rows?.items?.group?.['ui:order'], ['name']);
});

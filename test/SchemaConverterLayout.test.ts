import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsSchema, ICgEventsSchemaEntry } from '../shared/schema';
import { convertFullSchema } from '../webview/ui/rjsf/schemaConverter';
import { resolveExplicitArrayItemPolicy } from '../webview/ui/rjsf/schemaConverterValues';
import { resolveSchemaGridLayout } from '../webview/ui/rjsf/schemaConverterLayout';

test('schema grid layout defaults to full-width columns outside grid mode', () => {
	assert.deepEqual(
		resolveSchemaGridLayout({
			useGridLayout: false,
			gridColumns: 4,
			gridOptions: ['oneRow', 'fullwidth', 'noHeader'],
		}),
		{
			colClass: 'col-12',
			oneRow: false,
			fullWidth: false,
			noHeader: false,
		},
	);
});

test('schema grid layout clamps valid columns and ignores invalid values', () => {
	assert.equal(resolveSchemaGridLayout({ useGridLayout: true, gridColumns: 4 }).colClass, 'col-12 col-sm-6 col-md-4');
	assert.equal(resolveSchemaGridLayout({ useGridLayout: true, gridColumns: 8 }).colClass, 'col-12 col-sm-8');
	assert.equal(resolveSchemaGridLayout({ useGridLayout: true, gridColumns: 20 }).colClass, 'col-12');
	assert.equal(resolveSchemaGridLayout({ useGridLayout: true, gridColumns: 0 }).colClass, 'col-12');
	assert.equal(resolveSchemaGridLayout({ useGridLayout: true, gridColumns: Number.NaN }).colClass, 'col-12');
	assert.equal(resolveSchemaGridLayout({ useGridLayout: true, gridColumns: '4' }).colClass, 'col-12');
});

test('schema grid layout combines own and definition-level options', () => {
	assert.deepEqual(
		resolveSchemaGridLayout({
			useGridLayout: true,
			gridColumns: 5,
			gridOptions: ['noHeader'],
			inheritedGridOptions: ['fullwidth'],
			inheritedHasSingleField: true,
		}),
		{
			colClass: 'col-12',
			oneRow: true,
			fullWidth: true,
			noHeader: true,
		},
	);
});

test('single-field definitions imply one-row layout only when grid mode is enabled', () => {
	assert.equal(resolveSchemaGridLayout({
		useGridLayout: true,
		inheritedHasSingleField: true,
	}).oneRow, true);
	assert.equal(resolveSchemaGridLayout({
		useGridLayout: false,
		inheritedHasSingleField: true,
	}).oneRow, false);
});

function layoutEntry(properties: ICgEventsSchemaEntry['properties']): ICgEventsSchemaEntry {
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

test('schema converter emits collapsed state without obsolete collapsible metadata', () => {
	const schema: ICgEventsSchema = {
		trigger: {},
		check: {},
		action: {
			sample: layoutEntry([
				{ key: 'group', type: 'object', collapsed: 1 },
				{ key: 'child', type: 'string', parent: 'group' },
			]),
		},
		definition: {},
	};
	const converted = convertFullSchema(schema, 'sample', 'action');
	const options = converted.uiSchema.group?.['ui:options'] as Record<string, unknown> | undefined;
	assert.equal(options?.collapsed, true);
	assert.equal(Object.prototype.hasOwnProperty.call(options ?? {}, 'collapsible'), false);
});

test('explicit array-item policy normalizes aliases and JSON-like types', () => {
	assert.deepEqual(resolveExplicitArrayItemPolicy(' INT '), { type: 'integer', defaultValue: 0 });
	assert.deepEqual(resolveExplicitArrayItemPolicy('json'), { type: 'object', defaultValue: {} });
	assert.deepEqual(resolveExplicitArrayItemPolicy('array'), { type: 'array', defaultValue: [] });
	assert.deepEqual(resolveExplicitArrayItemPolicy('color'), { type: 'string', defaultValue: '#ffffff' });
	assert.equal(resolveExplicitArrayItemPolicy('#Definition'), undefined);
});

test('schema converter keeps explicit json and array item types consistent with UI policy', () => {
	const schema: ICgEventsSchema = {
		trigger: {},
		check: {},
		action: {
			sample: layoutEntry([
				{ key: 'jsonRows', type: 'array', arrayItem: 'json' },
				{ key: 'nestedArrays', type: 'array', arrayItem: 'array' },
			]),
		},
		definition: {},
	};
	const converted = convertFullSchema(schema, 'sample', 'action');
	const jsonRows = converted.schema.properties?.jsonRows;
	const nestedArrays = converted.schema.properties?.nestedArrays;
	assert.ok(jsonRows && typeof jsonRows !== 'boolean');
	assert.ok(nestedArrays && typeof nestedArrays !== 'boolean');
	assert.deepEqual(jsonRows.items, { type: 'object', default: {} });
	assert.deepEqual(nestedArrays.items, { type: 'array', default: [] });
});

test('schema converter uses null-prototype keyed containers safely', () => {
	const definitionEntries = Object.create(null) as Record<string, ICgEventsSchemaEntry>;
	definitionEntries.safeDefinition = layoutEntry([{ key: 'value', type: 'string' }]);
	const schema: ICgEventsSchema = {
		trigger: {},
		check: {},
		action: {
			sample: layoutEntry([
				{ key: 'group', type: 'object' },
				{ key: 'child', type: 'string', parent: 'group' },
			]),
		},
		definition: definitionEntries,
	};

	const converted = convertFullSchema(schema, 'sample', 'action');
	assert.equal(Object.getPrototypeOf(converted.schema.properties), null);
	assert.equal(Object.prototype.hasOwnProperty.call(converted.schema.properties ?? {}, 'group'), true);
	assert.equal(Object.getPrototypeOf(converted.uiSchema), null);
	assert.equal(Object.prototype.hasOwnProperty.call(converted.uiSchema, 'group'), true);
	assert.equal(Object.getPrototypeOf(converted.schema.definitions), null);
	assert.equal(Object.prototype.hasOwnProperty.call(converted.schema.definitions ?? {}, 'safeDefinition'), true);
});

test('fallback schemas preserve prototype-shadowing config keys as own properties', async () => {
	const { createFallbackSchema } = await import('../webview/ui/rjsf/schemaConverter');
	const data = JSON.parse('{"__proto__":1,"constructor":2,"safe":true}');
	const converted = createFallbackSchema(data);
	assert.equal(Object.getPrototypeOf(converted.schema.properties), null);
	assert.deepEqual(Object.keys(converted.schema.properties ?? {}).sort(), ['__proto__', 'constructor', 'safe'].sort());
	assert.equal(converted.schema.properties?.['__proto__'] && typeof converted.schema.properties['__proto__'] !== 'boolean'
		? converted.schema.properties['__proto__'].type
		: undefined, 'number');
});

test('schema converter supports empty-string own entry and definition keys', () => {
	const schema: ICgEventsSchema = {
		trigger: {},
		check: {},
		action: {
			'': layoutEntry([{ key: 'value', type: 'string' }]),
		},
		definition: {},
	};
	const convertedEntry = convertFullSchema(schema, '', 'action');
	assert.equal(typeof convertedEntry.schema.properties?.value, 'object');

	const definitions = Object.create(null) as Record<string, ICgEventsSchemaEntry>;
	definitions[''] = layoutEntry([{ key: 'nested', type: 'string' }]);
	const referenced: ICgEventsSchema = {
		trigger: {},
		check: {},
		action: {
			sample: layoutEntry([{ key: 'linked', definition: '' }]),
		},
		definition: definitions,
	};
	// An explicit empty definition name remains semantically absent because
	// resolveDefinitionName treats blank references as no reference.
	const linked = convertFullSchema(referenced, 'sample', 'action').schema.properties?.linked;
	assert.ok(linked && typeof linked !== 'boolean');
	assert.equal(linked.type, 'string');
});

test('schema converter normalizes grid entry format consistently', () => {
	const entry = {
		...layoutEntry([{ key: 'value', type: 'string', gridColumns: 4 }]),
		format: ' Grid ',
	};
	const schema: ICgEventsSchema = {
		trigger: {},
		check: {},
		action: { sample: entry },
		definition: {},
	};

	const converted = convertFullSchema(schema, 'sample', 'action');
	assert.equal(
		converted.uiSchema['ui:classNames'],
		'cgenh-configs-panel__grid cgenh-configs-panel__grid--12',
	);
	const options = converted.uiSchema.value?.['ui:options'] as Record<string, unknown> | undefined;
	assert.equal(options?.colClass, 'col-12 col-sm-6 col-md-4');
});

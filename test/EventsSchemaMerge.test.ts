import assert from 'node:assert/strict';
import test from 'node:test';
import { ICgEventsSchema, ICgEventsSchemaEntry } from '../shared/schema';
import { mergeEventsSchemaMap } from '../src/utils/eventsSchemaMerge';

function entry(timestamp: number, label: string): ICgEventsSchemaEntry {
	return {
		project: '',
		source: { path: '', filename: '' },
		toString: {},
		className: '',
		timestamp,
		label: { en: label },
		description: {},
		allpaths: {},
		properties: [],
	};
}

function schemaWithAction(timestamp: number, label: string): ICgEventsSchema {
	return {
		trigger: {},
		check: {},
		action: { sample: entry(timestamp, label) },
		definition: {},
	};
}

test('schema map merge is independent of async insertion order', () => {
	const a = schemaWithAction(10, 'A');
	const z = schemaWithAction(10, 'Z');
	const reverseInsertion: Record<string, ICgEventsSchema> = { '/z/events.schema.json': z, '/a/events.schema.json': a };
	const forwardInsertion: Record<string, ICgEventsSchema> = { '/a/events.schema.json': a, '/z/events.schema.json': z };

	const reverseResult = mergeEventsSchemaMap(reverseInsertion);
	const forwardResult = mergeEventsSchemaMap(forwardInsertion);

	assert.deepEqual(reverseResult, forwardResult);
	assert.equal(reverseResult.action.sample.label.en, 'Z');
});

test('schema timestamp precedence remains stronger than path tie-breaking', () => {
	const newer = schemaWithAction(20, 'newer');
	const older = schemaWithAction(10, 'older');
	const result = mergeEventsSchemaMap({
		'/a/events.schema.json': newer,
		'/z/events.schema.json': older,
	});

	assert.equal(result.action.sample.label.en, 'newer');
});

test('schema merge keeps valid entries whose names shadow Object prototype members', () => {
	const schema: ICgEventsSchema = {
		trigger: {},
		check: {},
		action: {
			toString: entry(10, 'toString entry'),
			hasOwnProperty: entry(11, 'hasOwnProperty entry'),
			valueOf: entry(12, 'valueOf entry'),
		},
		definition: {},
	};

	const result = mergeEventsSchemaMap({ '/events.schema.json': schema });
	assert.equal(Object.hasOwn(result.action, 'toString'), true);
	assert.equal(Object.hasOwn(result.action, 'hasOwnProperty'), true);
	assert.equal(Object.hasOwn(result.action, 'valueOf'), true);
	assert.equal(result.action['toString'].label.en, 'toString entry');
	assert.equal(result.action['hasOwnProperty'].label.en, 'hasOwnProperty entry');
	assert.equal(result.action['valueOf'].label.en, 'valueOf entry');
});

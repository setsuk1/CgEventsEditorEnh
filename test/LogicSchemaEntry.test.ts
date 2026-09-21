import assert from 'node:assert/strict';
import test from 'node:test';
import { getLogicSchemaEntry, hasLogicSchemaEntry } from '../webview/ui/components/events/LogicSchemaEntry';

function createSchema(): any {
	return {
		action: { KnownAction: { timestamp: 1, properties: [] } },
		check: {},
		trigger: {},
		definition: { SharedDefinition: { timestamp: 1, properties: [] } },
	};
}

test('logic schema lookup accepts section entries and definition fallbacks', () => {
	const schema = createSchema();
	assert.equal(hasLogicSchemaEntry(schema, 'action', 'KnownAction'), true);
	assert.equal(hasLogicSchemaEntry(schema, 'action', 'SharedDefinition'), true);
	assert.equal(hasLogicSchemaEntry(schema, 'action', 'MissingType'), false);
});

test('logic schema lookup ignores inherited prototype names', () => {
	const schema = createSchema();
	assert.equal(hasLogicSchemaEntry(schema, 'action', 'toString'), false);
	assert.equal(hasLogicSchemaEntry(schema, 'action', 'constructor'), false);
});

test('logic schema lookup supports empty and own prototype-shadowing keys', () => {
	const action = Object.create(null);
	action[''] = { timestamp: 1, properties: [], label: {}, description: {}, allpaths: {}, project: '', source: { path: '', filename: '' }, toString: {}, className: '' };
	action.toString = { timestamp: 2, properties: [], label: {}, description: {}, allpaths: {}, project: 'own', source: { path: '', filename: '' }, toString: {}, className: '' };
	const definition = Object.create(null);
	definition.constructor = { timestamp: 3, properties: [], label: {}, description: {}, allpaths: {}, project: 'definition-own', source: { path: '', filename: '' }, toString: {}, className: '' };
	const schema = { action, check: {}, trigger: {}, definition };

	assert.equal(hasLogicSchemaEntry(schema as any, 'action', ''), true);
	assert.equal(getLogicSchemaEntry(schema as any, 'action', '')?.timestamp, 1);
	assert.equal(getLogicSchemaEntry(schema as any, 'action', 'toString')?.project, 'own');
	assert.equal(getLogicSchemaEntry(schema as any, 'action', 'constructor')?.project, 'definition-own');
});

test('logic schema lookup does not fall through inherited prototype members', () => {
	const action = Object.create({ inherited: { timestamp: 4, properties: [] } });
	const schema = { action, check: {}, trigger: {}, definition: {} };
	assert.equal(getLogicSchemaEntry(schema as any, 'action', 'inherited'), undefined);
	assert.equal(hasLogicSchemaEntry(schema as any, 'action', 'inherited'), false);
});

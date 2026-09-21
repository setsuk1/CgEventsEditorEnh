import assert from 'node:assert/strict';
import test from 'node:test';
import { isCgEventsSchema } from '../shared/schema';

function createSchema(timestamp: unknown) {
	return {
		trigger: {
			sample: {
				timestamp,
				properties: [{ key: 'value' }],
			},
		},
		check: {},
		action: {},
		definition: {},
	};
}

test('schema validation accepts finite entry timestamps', () => {
	assert.equal(isCgEventsSchema(createSchema(0)), true);
	assert.equal(isCgEventsSchema(createSchema(123456789)), true);
});

test('schema validation rejects non-numeric or non-finite entry timestamps', () => {
	assert.equal(isCgEventsSchema(createSchema(undefined)), false);
	assert.equal(isCgEventsSchema(createSchema('123')), false);
	assert.equal(isCgEventsSchema(createSchema(Number.NaN)), false);
	assert.equal(isCgEventsSchema(createSchema(Number.POSITIVE_INFINITY)), false);
	assert.equal(isCgEventsSchema(createSchema(Number.NEGATIVE_INFINITY)), false);
});

test('schema validation accepts supported Logic Library entry metadata', () => {
	for (const patch of [
		{},
		{ project: '' },
		{ project: 'Game/Combat' },
		{ deprecated: false },
		{ deprecated: true },
	]) {
		const schema: any = createSchema(1);
		Object.assign(schema.trigger.sample, patch);
		assert.equal(isCgEventsSchema(schema), true, `expected ${JSON.stringify(patch)} to be accepted`);
	}
});

test('schema validation rejects malformed Logic Library entry metadata', () => {
	for (const patch of [
		{ project: 123 },
		{ project: {} },
		{ project: null },
		{ deprecated: 'false' },
		{ deprecated: 0 },
		{ deprecated: null },
	]) {
		const schema: any = createSchema(1);
		Object.assign(schema.trigger.sample, patch);
		assert.equal(isCgEventsSchema(schema), false, `expected ${JSON.stringify(patch)} to be rejected`);
	}
});

test('schema validation still rejects unsafe property keys', () => {
	const schema = createSchema(1);
	schema.trigger.sample.properties = [{ key: '__proto__' }];
	assert.equal(isCgEventsSchema(schema), false);
});

test('schema validation rejects unsafe or malformed parent references', () => {
	for (const parent of ['__proto__', 'prototype', 'constructor', 123]) {
		const schema: any = createSchema(1);
		schema.trigger.sample.properties = [{ key: 'child', parent }];
		assert.equal(isCgEventsSchema(schema), false, `expected parent ${JSON.stringify(parent)} to be rejected`);
	}

	const schema: any = createSchema(1);
	schema.trigger.sample.properties = [{ key: 'child', parent: 'group' }];
	assert.equal(isCgEventsSchema(schema), true);
});

test('schema validation rejects prototype-sensitive definition references', () => {
	for (const property of [
		{ key: 'value', definition: '__proto__' },
		{ key: 'value', definition: '#constructor' },
		{ key: 'value', definition: '#/definitions/prototype' },
		{ key: 'value', type: '#__proto__' },
		{ key: 'value', arrayItem: '@constructor' },
	]) {
		const schema: any = createSchema(1);
		schema.trigger.sample.properties = [property];
		assert.equal(isCgEventsSchema(schema), false, `expected ${JSON.stringify(property)} to be rejected`);
	}
});

test('schema validation rejects prototype-sensitive nested item references', () => {
	for (const items of [
		{ definition: '__proto__' },
		{ type: '#constructor' },
		{ arrayItem: '@prototype' },
		{ items: { definition: '#/definitions/constructor' } },
	]) {
		const schema: any = createSchema(1);
		schema.trigger.sample.properties = [{ key: 'values', type: 'array', items }];
		assert.equal(isCgEventsSchema(schema), false, `expected nested items ${JSON.stringify(items)} to be rejected`);
	}
});

test('schema validation preserves supported definition reference notations', () => {
	for (const property of [
		{ key: 'value', definition: 'Weapon' },
		{ key: 'value', definition: '#Weapon' },
		{ key: 'value', definition: '#/definitions/Weapon' },
		{ key: 'value', type: '#Weapon' },
		{ key: 'value', arrayItem: '@Weapon' },
		{ key: 'value', type: 'array', items: { definition: 'Weapon' } },
	]) {
		const schema: any = createSchema(1);
		schema.trigger.sample.properties = [property];
		assert.equal(isCgEventsSchema(schema), true, `expected ${JSON.stringify(property)} to be accepted`);
	}
});

test('schema validation rejects unsafe keys nested inside property metadata', () => {
	const schema: any = createSchema(1);
	schema.trigger.sample.properties[0].default = JSON.parse('{"safe":{"__proto__":{"polluted":true}}}');
	assert.equal(isCgEventsSchema(schema), false);
});

test('schema validation accepts supported array-like property metadata', () => {
	const schema: any = createSchema(1);
	schema.trigger.sample.properties = [{
		key: 'value',
		enum: ['a', 1, true],
		suggest: ['events<id>', 'items<code>'],
		gridOptions: ['oneRow', 'fullwidth'],
		items: {
			enum: ['nested'],
			suggest: ['resources'],
			gridOptions: ['noHeader'],
		},
	}];
	assert.equal(isCgEventsSchema(schema), true);
});

test('schema validation rejects malformed array-like property metadata', () => {
	for (const property of [
		{ key: 'value', enum: {} },
		{ key: 'value', enum: ['valid', {}] },
		{ key: 'value', suggest: {} },
		{ key: 'value', suggest: ['valid', 1] },
		{ key: 'value', gridOptions: {} },
		{ key: 'value', gridOptions: 'oneRow' },
		{ key: 'value', items: [] as unknown[] },
		{ key: 'value', items: { gridOptions: {} } },
		{ key: 'value', items: { suggest: ['valid', 1] } },
	]) {
		const schema: any = createSchema(1);
		schema.trigger.sample.properties = [property];
		assert.equal(isCgEventsSchema(schema), false, `expected ${JSON.stringify(property)} to be rejected`);
	}
});

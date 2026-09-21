import assert from 'node:assert/strict';
import test from 'node:test';
import type { RJSFSchema } from '@rjsf/utils';
import {
	buildRjsfDefaultValues,
	resolveRjsfDefinitionRef,
} from '../webview/ui/rjsf/rjsfDefaultValues';

test('RJSF definition references resolve only local definition refs', () => {
	const definitions: NonNullable<RJSFSchema['definitions']> = {
		Sample: { type: 'object', properties: { enabled: { type: 'boolean' } } },
	};

	assert.deepEqual(resolveRjsfDefinitionRef('#/definitions/Sample', definitions), definitions.Sample);
	assert.equal(resolveRjsfDefinitionRef('#/definitions/Missing', definitions), undefined);
	assert.equal(resolveRjsfDefinitionRef('#/other/Sample', definitions), undefined);
	assert.equal(resolveRjsfDefinitionRef('', definitions), undefined);
});

test('RJSF defaults derive primitive and enum fallbacks', () => {
	const schema: RJSFSchema = {
		type: 'object',
		properties: {
			explicit: { type: 'string', default: 'custom' },
			choice: { type: 'string', enum: ['first', 'second'] },
			flag: { type: 'boolean' },
			count: { type: 'number' },
			name: { type: 'string' },
			ignored: true,
		},
	};

	assert.deepEqual(buildRjsfDefaultValues(schema), {
		explicit: 'custom',
		choice: 'first',
		flag: false,
		count: 0,
		name: '',
	});
});

test('RJSF defaults recursively merge object defaults with property defaults', () => {
	const schema: RJSFSchema = {
		type: 'object',
		properties: {
			nested: {
				type: 'object',
				properties: {
					keep: { type: 'number', default: 1 },
					override: { type: 'number', default: 2 },
				},
				default: '{"override":9,"added":true}',
			},
		},
	};

	assert.deepEqual(buildRjsfDefaultValues(schema), {
		nested: {
			keep: 1,
			override: 9,
			added: true,
		},
	});
});

test('RJSF defaults resolve referenced object schemas while preserving local overrides', () => {
	const schema: RJSFSchema = {
		type: 'object',
		definitions: {
			Base: {
				type: 'object',
				properties: {
					enabled: { type: 'boolean' },
					label: { type: 'string', default: 'base' },
				},
			},
		},
		properties: {
			settings: {
				$ref: '#/definitions/Base',
				properties: {
					label: { type: 'string', default: 'local' },
				},
			},
		},
	};

	assert.deepEqual(buildRjsfDefaultValues(schema), {
		settings: {
			label: 'local',
		},
	});
});

test('RJSF defaults parse JSON-like array defaults and otherwise use empty arrays', () => {
	const schema: RJSFSchema = {
		type: 'object',
		properties: {
			values: { type: 'array', default: '[1,2,3]' },
			empty: { type: 'array' },
		},
	};

	assert.deepEqual(buildRjsfDefaultValues(schema), {
		values: [1, 2, 3],
		empty: [],
	});
});

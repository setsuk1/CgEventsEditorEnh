import assert from 'node:assert/strict';
import test from 'node:test';
import type { RJSFSchema } from '@rjsf/utils';
import { coerceToSchema, parseJsonLike } from '../webview/ui/rjsf/utils/formDataCoercion';

test('RJSF coercion does not materialize inherited Object members as form fields', () => {
	const schema: RJSFSchema = {
		type: 'object',
		properties: {
			toString: { type: 'string' as const },
			hasOwnProperty: { type: 'string' as const },
			valueOf: { type: 'string' as const },
		},
	};

	const result = coerceToSchema({}, schema);
	assert.equal(Object.prototype.hasOwnProperty.call(result, 'toString'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(result, 'hasOwnProperty'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(result, 'valueOf'), false);
});

test('RJSF coercion still processes own fields that shadow Object members', () => {
	const schema: RJSFSchema = {
		type: 'object',
		properties: {
			toString: { type: 'string' as const },
		},
	};

	const result = coerceToSchema({ toString: 123 }, schema);
	assert.equal(Object.prototype.hasOwnProperty.call(result, 'toString'), true);
	assert.equal(result['toString'], '123');
});

test('RJSF coercion resolves only own definition references', () => {
	const inheritedDefinitions = Object.create({ inherited: { type: 'number' as const } }) as Record<string, RJSFSchema>;
	const inheritedResult = coerceToSchema('12', { $ref: '#/definitions/inherited' }, inheritedDefinitions);
	assert.equal(inheritedResult, '12');

	const ownDefinitions: Record<string, RJSFSchema> = { inherited: { type: 'number' as const } };
	const ownResult = coerceToSchema('12', { $ref: '#/definitions/inherited' }, ownDefinitions);
	assert.equal(ownResult, 12);
});

test('JSON-like coercion only parses complete object or array strings', () => {
	assert.deepEqual(parseJsonLike('{"value":1}'), { value: 1 });
	assert.deepEqual(parseJsonLike('[1,2]'), [1, 2]);
	assert.equal(parseJsonLike('plain text'), undefined);
	assert.equal(parseJsonLike('{ broken'), undefined);
});

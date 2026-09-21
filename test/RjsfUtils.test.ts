import assert from 'node:assert/strict';
import test from 'node:test';
import { getValueByPath, hasClassToken } from '../webview/ui/rjsf/utils/rjsfUtils';

test('getValueByPath only traverses safe own properties', () => {
	const inherited = Object.create({ inherited: { value: 'unsafe' } });
	inherited.own = { nested: 42 };

	assert.equal(getValueByPath(inherited, ['own', 'nested']), 42);
	assert.equal(getValueByPath(inherited, ['inherited', 'value']), undefined);

	for (const unsafeKey of ['__proto__', 'prototype', 'constructor']) {
		assert.equal(getValueByPath(inherited, [unsafeKey]), undefined);
		assert.equal(getValueByPath({ safe: {} }, ['safe', unsafeKey]), undefined);
	}
});

test('hasClassToken matches complete whitespace-delimited class names only', () => {
	assert.equal(hasClassToken('a cgenh-config-field--inline b', 'cgenh-config-field--inline'), true);
	assert.equal(hasClassToken('prefix-cgenh-config-field--inline', 'cgenh-config-field--inline'), false);
	assert.equal(hasClassToken('cgenh-config-field--inline-extra', 'cgenh-config-field--inline'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getOwnRjsfConfigEntry } from '../webview/ui/rjsf/utils/rjsfUtils';

test('RJSF config lookup ignores inherited prototype members', () => {
	const configs = Object.create({ inherited: { unsafe: true } }) as Record<string, unknown>;
	configs.safe = { value: 1 };

	assert.deepEqual(getOwnRjsfConfigEntry(configs, 'safe'), { value: 1 });
	assert.deepEqual(getOwnRjsfConfigEntry(configs, 'inherited'), {});
	assert.deepEqual(getOwnRjsfConfigEntry({}, 'toString'), {});
	assert.deepEqual(getOwnRjsfConfigEntry({}, 'constructor'), {});
});

test('RJSF config lookup preserves own prototype-shadowing and empty keys', () => {
	const configs = JSON.parse('{"toString":{"value":1},"constructor":{"value":2},"__proto__":{"value":3},"":{"value":4}}');
	assert.deepEqual(getOwnRjsfConfigEntry(configs, 'toString'), { value: 1 });
	assert.deepEqual(getOwnRjsfConfigEntry(configs, 'constructor'), { value: 2 });
	assert.deepEqual(getOwnRjsfConfigEntry(configs, '__proto__'), { value: 3 });
	assert.deepEqual(getOwnRjsfConfigEntry(configs, ''), { value: 4 });
});

test('RJSF config lookup supports array indexes and keeps nullish fallback behavior', () => {
	assert.equal(getOwnRjsfConfigEntry(['zero', 'one'], '1'), 'one');
	assert.deepEqual(getOwnRjsfConfigEntry({ value: null }, 'value'), {});
	assert.deepEqual(getOwnRjsfConfigEntry(undefined, 'value'), {});
});

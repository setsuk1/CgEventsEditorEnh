import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getBaseConfigDefinitionLabel,
	getBaseConfigEntryValue,
	hasBaseConfigEditKey,
	mergeBaseConfigPatch,
	resolveBaseConfigLabel,
	resolveBaseConfigSchema,
} from '../webview/ui/components/base/BaseSettingsData';

test('base settings treats an empty string as a valid config edit key', () => {
	assert.equal(hasBaseConfigEditKey(''), true);
	assert.equal(hasBaseConfigEditKey('0'), true);
	assert.equal(hasBaseConfigEditKey(undefined), false);
});

test('base settings reads object config values by safe own key', () => {
	const configs = Object.create({ inherited: 'unsafe' }) as Record<string, unknown>;
	configs[''] = 'empty-key';
	configs.own = 'safe';

	assert.equal(getBaseConfigEntryValue(configs, ''), 'empty-key');
	assert.equal(getBaseConfigEntryValue(configs, 'own'), 'safe');
	assert.equal(getBaseConfigEntryValue(configs, 'inherited'), undefined);
});

test('base settings reads array config values only from non-negative integer keys', () => {
	const configs = ['zero', 'one'];
	assert.equal(getBaseConfigEntryValue(configs, '0'), 'zero');
	assert.equal(getBaseConfigEntryValue(configs, '1'), 'one');
	assert.equal(getBaseConfigEntryValue(configs, '-1'), undefined);
	assert.equal(getBaseConfigEntryValue(configs, '1.5'), undefined);
	assert.equal(getBaseConfigEntryValue(configs, 'name'), undefined);
});

test('base settings gives empty config keys a visible fallback label', () => {
	assert.equal(resolveBaseConfigLabel('', undefined, 'Config'), 'Config');
	assert.equal(resolveBaseConfigLabel('', '   ', 'Config'), 'Config');
	assert.equal(resolveBaseConfigLabel('named', undefined, 'Config'), 'named');
	assert.equal(resolveBaseConfigLabel('named', 'Localized Name', 'Config'), 'Localized Name');
});

test('base settings uses fallback schema for unknown config keys', () => {
	const schema: any = {
		trigger: {},
		check: {},
		action: {},
		definition: {
			known: { properties: [] },
			'': { properties: [] },
		},
	};
	assert.strictEqual(resolveBaseConfigSchema(schema, 'known'), schema);
	assert.strictEqual(resolveBaseConfigSchema(schema, ''), schema);
	assert.equal(resolveBaseConfigSchema(schema, 'missing'), undefined);
	assert.equal(resolveBaseConfigSchema(schema, undefined), undefined);

	const inheritedDefinition = Object.create({ inherited: { properties: [] } });
	const inheritedSchema = { ...schema, definition: inheritedDefinition };
	assert.equal(resolveBaseConfigSchema(inheritedSchema, 'inherited'), undefined);
});

test('base settings config patch preserves prototype-shadowing object keys safely', () => {
	const current = JSON.parse('{"safe":{"value":1},"__proto__":{"old":true}}');
	const patch = JSON.parse('{"__proto__":{"new":true},"constructor":{"value":2}}');
	const merged = mergeBaseConfigPatch(current, patch) as Record<string, unknown>;

	assert.equal(Object.getPrototypeOf(merged), null);
	assert.deepEqual(merged.safe, { value: 1 });
	assert.deepEqual(merged['__proto__'], { new: true });
	assert.deepEqual(merged['constructor'], { value: 2 });
	assert.equal(Object.prototype.hasOwnProperty.call(merged, '__proto__'), true);
});

test('base settings config patch keeps array configs as arrays', () => {
	const merged = mergeBaseConfigPatch(['zero', 'one'], { '1': 'updated' });
	assert.equal(Array.isArray(merged), true);
	assert.deepEqual(merged, ['zero', 'updated']);
});

test('base settings definition labels use own schema entries only', () => {
	const definition = Object.create({ inherited: { label: { en: 'unsafe' } } });
	definition[''] = { label: { en: 'empty' } };
	definition.constructor = { label: { en: 'constructor-own' } };
	const schema: any = { trigger: {}, check: {}, action: {}, definition };

	assert.deepEqual(getBaseConfigDefinitionLabel(schema, ''), { en: 'empty' });
	assert.deepEqual(getBaseConfigDefinitionLabel(schema, 'constructor'), { en: 'constructor-own' });
	assert.equal(getBaseConfigDefinitionLabel(schema, 'inherited'), undefined);
});

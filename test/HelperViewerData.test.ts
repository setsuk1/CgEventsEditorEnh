import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHelperPayload, normalizeHelperSelection } from '../webview/ui/components/helpers/HelperViewerData';

test('helper selection normalization parses JSON-like strings and unwraps nested values', () => {
	assert.deepEqual(normalizeHelperSelection('{"code":"hero"}'), { code: 'hero' });
	assert.equal(normalizeHelperSelection({ data: { value: 'hero' } }), 'hero');
	assert.equal(normalizeHelperSelection({ _overwrite: true, json: { value: 'map' } }), 'map');
});

test('helper selection normalization chooses one meaningful item unless arrays are preserved', () => {
	const values = [{ code: 'a' }, { code: 'b' }];
	assert.deepEqual(normalizeHelperSelection(values), { code: 'a' });
	assert.strictEqual(normalizeHelperSelection(values, true), values);
});

test('helper selection normalization preserves ordinary strings and malformed JSON-like text', () => {
	assert.equal(normalizeHelperSelection(' plain '), ' plain ');
	assert.equal(normalizeHelperSelection('{bad json}'), '{bad json}');
});


test('helper selection normalization does not recurse forever on cyclic payloads', () => {
	const payload: Record<string, any> = { code: 'cyclic' };
	payload.data = payload;

	assert.strictEqual(normalizeHelperSelection(payload), payload);
});


test('helper payload parses layout and map JSON text', () => {
	assert.deepEqual(
		buildHelperPayload('{"x":1}', { helperName: 'CgEditorLayout' }),
		{ json: { x: 1 }, raw: { x: 1 } },
	);
	assert.deepEqual(
		buildHelperPayload('{"map":"a"}', { helperName: 'TwMapCgEditor' }),
		{ json: { map: 'a' }, raw: { map: 'a' } },
	);
});

test('helper payload adapts role and code selectors', () => {
	assert.deepEqual(
		buildHelperPayload('hero', { helperType: 'selectRole' }),
		{ json: { dr: 'hero' }, raw: { dr: 'hero' } },
	);
	assert.deepEqual(
		buildHelperPayload({ code: 'sword' }, { helperType: 'selectWeapon' }),
		{ json: 'sword', raw: 'sword' },
	);
	const configuredWeapon = { code: 'sword', config: {} };
	assert.deepEqual(
		buildHelperPayload(configuredWeapon, { helperType: 'selectWeapon' }),
		{ json: configuredWeapon, raw: configuredWeapon },
	);
});

test('helper payload builds custom weapon and object editor shapes', () => {
	assert.deepEqual(
		buildHelperPayload('sword', {
			helperType: 'customWeapon',
			defaultValue: { code: 'fallback', config: { power: 2 } },
		}),
		{
			json: { power: 2 },
			raw: { code: 'sword', config: { power: 2 } },
		},
	);
	assert.deepEqual(
		buildHelperPayload('item-a', { helperName: 'ItemEditor' }),
		{
			json: { code: 'item-a', name: 'item-a' },
			raw: { code: 'item-a', name: 'item-a' },
		},
	);
});

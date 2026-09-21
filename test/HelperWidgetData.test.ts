import assert from 'node:assert/strict';
import test from 'node:test';
import {
	coerceHelperWidgetSelection,
	normalizeHelperWidgetOptions,
	parseHelperInfo,
	parseHelperWidgetValue,
	resolveHelperPreviewLayout,
	shouldPreserveHelperArraySelection,
} from '../webview/ui/rjsf/widgets/HelperWidgetData';

test('helper widget options retain only supported typed metadata', () => {
	assert.deepEqual(
		normalizeHelperWidgetOptions({
			helper: 'Weapon:selectWeapon(type=melee)',
			format: 'Weapon:view',
			editorOptions: { compact: true },
			compact: true,
			entryType: 'action',
			entryKey: 'attack',
			propKey: 'weapon',
		}),
		{
			helper: 'Weapon:selectWeapon(type=melee)',
			format: 'Weapon:view',
			editorOptions: { compact: true },
			compact: true,
			entryType: 'action',
			entryKey: 'attack',
			propKey: 'weapon',
		},
	);
	assert.deepEqual(normalizeHelperWidgetOptions({ entryType: 'invalid', compact: 'yes' }), {
		helper: undefined,
		format: undefined,
		editorOptions: undefined,
		compact: false,
		entryType: undefined,
		entryKey: undefined,
		propKey: undefined,
	});
});

test('helper descriptors parse typed and simple editor forms', () => {
	const options = normalizeHelperWidgetOptions({
		editorOptions: { mode: 'full' },
		entryType: 'action',
		entryKey: 'attack',
		propKey: 'weapon',
	});
	assert.deepEqual(
		parseHelperInfo(' Weapon:selectWeapon(type=melee, width=320px) ', 'helper', options),
		{
			name: 'Weapon',
			helperType: 'selectWeapon',
			args: { type: 'melee', width: '320px' },
			raw: 'Weapon:selectWeapon(type=melee, width=320px)',
			source: 'helper',
			editorOptions: { mode: 'full' },
			entryType: 'action',
			entryKey: 'attack',
			propKey: 'weapon',
		},
	);
	assert.deepEqual(
		parseHelperInfo('CgEditorLayout(height=640px)', 'format', {}),
		{
			name: 'CgEditorLayout',
			helperType: 'edit',
			args: { height: '640px' },
			raw: 'CgEditorLayout(height=640px)',
			source: 'format',
			editorOptions: undefined,
			entryType: undefined,
			entryKey: undefined,
			propKey: undefined,
		},
	);
	assert.equal(parseHelperInfo('plain', 'format', {}), null);
});

test('helper widget values parse JSON string defaults without coercing non-string schemas', () => {
	assert.deepEqual(parseHelperWidgetValue(' {"code":"hero"} ', undefined, 'string'), { code: 'hero' });
	assert.equal(parseHelperWidgetValue('{bad json}', undefined, 'string'), '{bad json}');
	assert.equal(parseHelperWidgetValue(undefined, 'fallback', 'string'), 'fallback');
	assert.equal(parseHelperWidgetValue('{"code":"hero"}', undefined, 'object'), '{"code":"hero"}');
});

test('helper widget selections serialize objects and coerce primitive schema types', () => {
	assert.equal(coerceHelperWidgetSelection({ code: 'hero' }, 'string'), '{"code":"hero"}');
	assert.equal(coerceHelperWidgetSelection('true', 'boolean'), true);
	assert.equal(coerceHelperWidgetSelection('42', 'integer'), 42);
	assert.equal(coerceHelperWidgetSelection('4.2', 'integer'), '4.2');
	const cyclic: Record<string, any> = { code: 'cyclic' };
	cyclic.self = cyclic;
	assert.equal(coerceHelperWidgetSelection(cyclic, 'string', 'existing'), 'existing');
	assert.equal(shouldPreserveHelperArraySelection('array', undefined), true);
	assert.equal(shouldPreserveHelperArraySelection('string', ['a']), true);
	assert.equal(shouldPreserveHelperArraySelection('string', 'a'), false);
});

test('helper preview layout keeps editor-layout sizing and helper styling', () => {
	const layoutInfo = parseHelperInfo(
		'CgEditorLayout(height=640px,border=1px solid,borderRadius=8px)',
		'format',
		{},
	);
	assert.deepEqual(resolveHelperPreviewLayout(layoutInfo), {
		widthValue: '100%',
		heightValue: '640px',
		helperName: 'cgeditorlayout',
		style: {
			width: '100%',
			height: '640px',
			border: '1px solid',
			borderRadius: '8px',
		},
	});
	assert.deepEqual(resolveHelperPreviewLayout(null), {
		widthValue: '100%',
		heightValue: '64px',
		helperName: '',
		style: { width: '100%', height: '64px' },
	});
});

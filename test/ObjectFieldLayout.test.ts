import assert from 'node:assert/strict';
import test from 'node:test';
import {
	resolveNextObjectFieldCollapsedState,
	resolveObjectFieldLayoutOptions,
} from '../webview/ui/rjsf/templates/FieldLayout';

test('object field layout resolves inline and hidden-header policies consistently', () => {
	assert.deepEqual(
		resolveObjectFieldLayoutOptions({
			'ui:classNames': 'outer cgenh-config-field--inline',
			'ui:options': {
				classNames: 'inner',
				collapsed: true,
			},
		}),
		{
			uiOptions: { classNames: 'inner', collapsed: true },
			uiClassNames: 'outer cgenh-config-field--inline',
			optionClassNames: 'inner',
			hasInlineLayout: true,
			hideHeader: true,
			collapsed: true,
		},
	);

	assert.equal(resolveObjectFieldLayoutOptions({
		'ui:options': { classNames: 'cgenh-config-field--inline' },
	}).hideHeader, true);
	assert.equal(resolveObjectFieldLayoutOptions({
		'ui:options': { oneRow: true },
	}).hideHeader, true);
	assert.equal(resolveObjectFieldLayoutOptions({
		'ui:options': { noHeader: true },
	}).hideHeader, true);
});

test('object field collapsed option does not depend on the legacy collapsible flag', () => {
	assert.equal(resolveObjectFieldLayoutOptions({
		'ui:options': { collapsed: true },
	}).collapsed, true);
	assert.equal(resolveObjectFieldLayoutOptions({
		'ui:options': { collapsed: false, collapsible: true },
	}).collapsed, false);
});

test('object field collapse state restores configured state when a hidden header returns', () => {
	const visibleCollapsed = resolveObjectFieldLayoutOptions({
		'ui:options': { collapsed: true },
	});
	const hiddenCollapsed = resolveObjectFieldLayoutOptions({
		'ui:options': { collapsed: true, noHeader: true },
	});

	assert.equal(
		resolveNextObjectFieldCollapsedState(true, visibleCollapsed, hiddenCollapsed),
		false,
	);
	assert.equal(
		resolveNextObjectFieldCollapsedState(false, hiddenCollapsed, visibleCollapsed),
		true,
	);
});

test('object field collapse state preserves user toggles when layout policy is unchanged', () => {
	const layout = resolveObjectFieldLayoutOptions({
		'ui:options': { collapsed: false },
	});
	assert.equal(resolveNextObjectFieldCollapsedState(true, layout, layout), true);
	assert.equal(resolveNextObjectFieldCollapsedState(false, layout, layout), false);
});

test('object field layout requires an exact inline class token', () => {
	for (const uiSchema of [
		{ 'ui:classNames': 'not-cgenh-config-field--inline-x' },
		{ 'ui:options': { classNames: 'cgenh-config-field--inline-extra' } },
	]) {
		const layout = resolveObjectFieldLayoutOptions(uiSchema);
		assert.equal(layout.hasInlineLayout, false);
		assert.equal(layout.hideHeader, false);
	}
});

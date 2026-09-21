import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveArrayFieldLayoutOptions, resolveNextArrayFieldCollapsedState } from '../webview/ui/rjsf/templates/FieldLayout';

test('array field layout resolves inline markers from every supported class source', () => {
	for (const input of [
		{ uiSchema: { 'ui:options': { oneRow: true } } },
		{ uiSchema: { 'ui:classNames': 'foo cgenh-config-field--inline bar' } },
		{ uiSchema: { 'ui:options': { classNames: 'cgenh-config-field--inline' } } },
		{ uiSchema: {}, className: 'cgenh-config-field--inline' },
	]) {
		const layout = resolveArrayFieldLayoutOptions(input.uiSchema, input.className);
		assert.equal(layout.hasInlineLayout, true);
		assert.equal(layout.hideHeader, true);
	}
});

test('array field layout combines no-header and collapsed options', () => {
	const hidden = resolveArrayFieldLayoutOptions({
		'ui:options': { noHeader: true, collapsed: true },
	});
	assert.equal(hidden.hasInlineLayout, false);
	assert.equal(hidden.hideHeader, true);
	assert.equal(hidden.collapsed, true);

	const regular = resolveArrayFieldLayoutOptions({
		'ui:options': { collapsed: true },
	});
	assert.equal(regular.hideHeader, false);
	assert.equal(regular.collapsed, true);
});


test('array field collapse state is restored when a hidden header becomes visible', () => {
	const hidden = resolveArrayFieldLayoutOptions({
		'ui:options': { noHeader: true, collapsed: true },
	});
	const visible = resolveArrayFieldLayoutOptions({
		'ui:options': { collapsed: true },
	});

	assert.equal(resolveNextArrayFieldCollapsedState(false, hidden, visible), true);
});

test('array field collapse state follows explicit schema changes and stays open without a header', () => {
	const visibleOpen = resolveArrayFieldLayoutOptions({
		'ui:options': { collapsed: false },
	});
	const visibleClosed = resolveArrayFieldLayoutOptions({
		'ui:options': { collapsed: true },
	});
	const hiddenClosed = resolveArrayFieldLayoutOptions({
		'ui:options': { noHeader: true, collapsed: true },
	});

	assert.equal(resolveNextArrayFieldCollapsedState(false, visibleOpen, visibleClosed), true);
	assert.equal(resolveNextArrayFieldCollapsedState(true, visibleClosed, hiddenClosed), false);
});

test('array field layout requires an exact inline class token', () => {
	for (const input of [
		{ uiSchema: { 'ui:classNames': 'not-cgenh-config-field--inline-x' } },
		{ uiSchema: { 'ui:options': { classNames: 'prefix-cgenh-config-field--inline' } } },
		{ uiSchema: {}, className: 'cgenh-config-field--inline-extra' },
	]) {
		const layout = resolveArrayFieldLayoutOptions(input.uiSchema, input.className);
		assert.equal(layout.hasInlineLayout, false);
		assert.equal(layout.hideHeader, false);
	}
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { isLogicInteractiveElement } from '../webview/ui/components/events/LogicItemsListInteraction';

function createElement(closestMatch: Element | null): Element {
	return {
		closest: () => closestMatch,
	} as unknown as Element;
}

test('logic interactive target recognizes descendants of controls', () => {
	const button = {} as Element;
	const svgIcon = createElement(button);
	assert.equal(isLogicInteractiveElement(svgIcon), true);
});

test('logic interactive target ignores ordinary row content', () => {
	const rowContent = createElement(null);
	assert.equal(isLogicInteractiveElement(rowContent), false);
});

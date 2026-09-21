import assert from 'node:assert/strict';
import test from 'node:test';
import { isLogicLibraryDropdownTarget } from '../webview/ui/components/events/LogicLibraryModel';

function targetWithClosest(match: boolean): EventTarget {
	return {
		closest: () => match ? ({} as Element) : null,
	} as unknown as EventTarget;
}

test('logic library dropdown target recognizes element-like descendants including SVG targets', () => {
	assert.equal(isLogicLibraryDropdownTarget(targetWithClosest(true)), true);
	assert.equal(isLogicLibraryDropdownTarget(targetWithClosest(false)), false);
});

test('logic library dropdown target treats non-element targets as outside clicks', () => {
	assert.equal(isLogicLibraryDropdownTarget(null), false);
	assert.equal(isLogicLibraryDropdownTarget({} as EventTarget), false);
});

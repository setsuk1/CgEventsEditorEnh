import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEvent } from '../shared';
import type { EventCardUiState } from '../webview/ui/components/events/EventCardUiStateStore';
import {
	estimateVirtualEventHeight,
	resolveVirtualResizeBaselineHeight,
	VIRTUAL_EVENT_HEIGHT_ESTIMATE,
} from '../webview/ui/components/events/VirtualListMath';

function createEvent(): ICgEvent {
	return {
		id: 'event-a',
		triggers: [{ type: 't' }],
		checks: [{ type: 'c1' }, { type: 'c2' }],
		actions: [{ type: 'a1' }, { type: 'a2' }, { type: 'a3' }],
	};
}

function createUiState(overrides: Partial<EventCardUiState> = {}): EventCardUiState {
	return {
		collapsed: false,
		blockCollapsed: { trigger: false, check: false, action: false },
		...overrides,
	};
}

test('virtual event height estimate collapses to the event header', () => {
	assert.equal(
		estimateVirtualEventHeight(createEvent(), createUiState({ collapsed: true })),
		VIRTUAL_EVENT_HEIGHT_ESTIMATE.eventHeader,
	);
});

test('virtual event height estimate counts only expanded section bodies and items', () => {
	const ui = createUiState({
		blockCollapsed: { trigger: false, check: true, action: false },
	});
	const expected =
		VIRTUAL_EVENT_HEIGHT_ESTIMATE.eventHeader
		+ 3 * VIRTUAL_EVENT_HEIGHT_ESTIMATE.sectionHeader
		+ 2 * VIRTUAL_EVENT_HEIGHT_ESTIMATE.sectionBody
		+ 4 * VIRTUAL_EVENT_HEIGHT_ESTIMATE.logicItem;

	assert.equal(estimateVirtualEventHeight(createEvent(), ui), expected);
});

test('virtual event height estimate treats missing UI state as fully expanded', () => {
	const expected =
		VIRTUAL_EVENT_HEIGHT_ESTIMATE.eventHeader
		+ 3 * VIRTUAL_EVENT_HEIGHT_ESTIMATE.sectionHeader
		+ 3 * VIRTUAL_EVENT_HEIGHT_ESTIMATE.sectionBody
		+ 6 * VIRTUAL_EVENT_HEIGHT_ESTIMATE.logicItem;

	assert.equal(estimateVirtualEventHeight(createEvent(), undefined), expected);
});


test('virtual resize baseline prefers the previous measured height across collapse state changes', () => {
	assert.equal(resolveVirtualResizeBaselineHeight(480, 72), 480);
	assert.equal(resolveVirtualResizeBaselineHeight(undefined, 72), 72);
	assert.equal(resolveVirtualResizeBaselineHeight(-20, 72), 0);
	assert.equal(resolveVirtualResizeBaselineHeight(undefined, Number.NaN), 0);
});

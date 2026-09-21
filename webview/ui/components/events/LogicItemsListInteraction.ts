import { isEventBlockType, type EventBlockType } from '../../../editor/eventBlockTypes';
import type { DraggedItem } from './DragState';
import type { SelectedItem } from './SelectionState';

const INTERACTIVE_TARGET_SELECTOR = [
	'input',
	'textarea',
	'select',
	'option',
	'button',
	'[contenteditable]',
	'.monaco-editor',
	'.cgenh-json-editor',
	'.cgenh-config-field',
	'.cgenh-configs-panel__panel',
	'.cgenh-base-settings__panel',
	'.selector-panel',
].join(', ');

export function isLogicInteractiveElement(element: Element): boolean {
	if (
		typeof HTMLElement !== 'undefined'
		&& element instanceof HTMLElement
		&& element.isContentEditable
	) {
		return true;
	}
	return Boolean(element.closest(INTERACTIVE_TARGET_SELECTOR));
}

export function isLogicInteractiveTarget(target: EventTarget | null): boolean {
	return typeof Element !== 'undefined'
		&& target instanceof Element
		&& isLogicInteractiveElement(target);
}

export function areLogicSelectionSetsEqual<T>(
	a: ReadonlySet<T>,
	b: ReadonlySet<T>,
): boolean {
	if (a.size !== b.size) return false;
	for (const item of a) {
		if (!b.has(item)) return false;
	}
	return true;
}

function getMinimumIndex(indices: Iterable<number>): number | undefined {
	let minimum = Number.MAX_SAFE_INTEGER;
	for (const index of indices) {
		if (index < minimum) minimum = index;
	}
	return minimum === Number.MAX_SAFE_INTEGER ? undefined : minimum;
}

export function resolveLogicActiveIndex(
	contextIndex: number | undefined,
	selectedIndices: ReadonlySet<number>,
	matchingSelectionIndices: readonly number[],
): number | undefined {
	if (contextIndex !== undefined) return contextIndex;
	if (selectedIndices.size > 0) return getMinimumIndex(selectedIndices);
	return getMinimumIndex(matchingSelectionIndices);
}

export function resolveLogicSelectionEntries(
	selectionEntries: readonly SelectedItem[],
	fallbackEntry?: SelectedItem,
): SelectedItem[] {
	if (selectionEntries.length > 0) return [...selectionEntries];
	return fallbackEntry ? [fallbackEntry] : [];
}

export interface LogicDragSelectionPlan {
	entries: DraggedItem[];
	clearExistingSelectionOnStart: boolean;
}

function hasDraggedBlock(entry: SelectedItem): entry is DraggedItem {
	return entry.block !== undefined;
}

export function resolveLogicDragSelection(
	selectionEntries: readonly SelectedItem[],
	clickedEntry: DraggedItem | null,
): LogicDragSelectionPlan {
	if (!clickedEntry) {
		return { entries: [], clearExistingSelectionOnStart: false };
	}

	const draggableSelection = selectionEntries.filter(hasDraggedBlock);
	const clickedIsSelected = draggableSelection.some((entry) =>
		entry.eventId === clickedEntry.eventId
		&& entry.blockType === clickedEntry.blockType
		&& entry.index === clickedEntry.index
	);

	if (draggableSelection.length > 0 && clickedIsSelected) {
		return {
			entries: draggableSelection,
			clearExistingSelectionOnStart: false,
		};
	}

	return {
		entries: [clickedEntry],
		clearExistingSelectionOnStart: draggableSelection.length > 0,
	};
}

export interface LogicSectionMetadata {
	eventId: string;
	blockType: EventBlockType;
}

export interface LogicDropSection extends LogicSectionMetadata {
	itemsElement: Element;
}

export function resolveLogicSectionMetadata(sectionElement: Element): LogicSectionMetadata | undefined {
	const eventId = sectionElement.getAttribute('data-event-id');
	const rawBlockType = sectionElement.getAttribute('data-block-type');
	if (!eventId || !isEventBlockType(rawBlockType)) return undefined;
	return { eventId, blockType: rawBlockType };
}

export function resolveLogicDropSection(elementsAtPoint: readonly Element[]): LogicDropSection | undefined {
	for (const element of elementsAtPoint) {
		const itemsElement = element.classList.contains('cgenh-event-section__items')
			? element
			: element.closest('.cgenh-event-section__items');
		if (!itemsElement) continue;

		const sectionElement = itemsElement.closest('.cgenh-event-section');
		if (!sectionElement) continue;
		const metadata = resolveLogicSectionMetadata(sectionElement);
		if (!metadata) return undefined;

		return { itemsElement, ...metadata };
	}
	return undefined;
}


export interface VerticalScrollBounds {
	top: number;
	bottom: number;
}

const AUTO_SCROLL_EDGE = 80;
const AUTO_SCROLL_MIN_SPEED = 4;
const AUTO_SCROLL_MAX_SPEED = 20;

export function computeLogicDragAutoScrollDelta(
	clientY: number,
	bounds: VerticalScrollBounds,
): number {
	if (
		!Number.isFinite(clientY)
		|| !Number.isFinite(bounds.top)
		|| !Number.isFinite(bounds.bottom)
		|| bounds.bottom < bounds.top
	) {
		return 0;
	}
	if (clientY < bounds.top || clientY > bounds.bottom) return 0;

	if (clientY < bounds.top + AUTO_SCROLL_EDGE) {
		const intensity = Math.min(1, (bounds.top + AUTO_SCROLL_EDGE - clientY) / AUTO_SCROLL_EDGE);
		return -Math.max(AUTO_SCROLL_MIN_SPEED, Math.round(intensity * AUTO_SCROLL_MAX_SPEED));
	}
	if (clientY > bounds.bottom - AUTO_SCROLL_EDGE) {
		const intensity = Math.min(1, (clientY - (bounds.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
		return Math.max(AUTO_SCROLL_MIN_SPEED, Math.round(intensity * AUTO_SCROLL_MAX_SPEED));
	}
	return 0;
}

function getLogicRowDataIndex(row: HTMLElement, fallback: number): number {
	const rawIndex = row.getAttribute('data-logic-index');
	if (!rawIndex) return fallback;
	const index = Number.parseInt(rawIndex, 10);
	return Number.isFinite(index) ? index : fallback;
}

export function computeLogicRowInsertIndex(
	itemsElement: Element,
	elementsAtPoint: Element[],
	clientY: number,
): number {
	for (const element of elementsAtPoint) {
		if (!(element instanceof HTMLElement)) continue;
		const row = element.classList.contains('cgenh-logic-row')
			? element
			: element.closest?.('.cgenh-logic-row');
		if (!(row instanceof HTMLElement) || !itemsElement.contains(row)) continue;
		const index = getLogicRowDataIndex(row, 0);
		const rect = row.getBoundingClientRect();
		return clientY < rect.top + rect.height / 2 ? index : index + 1;
	}

	const logicRows = itemsElement.querySelectorAll('.cgenh-logic-row');
	const length = logicRows.length;
	if (length === 0) return 0;

	let low = 0;
	let high = length - 1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const row = logicRows[mid];
		if (!(row instanceof HTMLElement)) {
			low = mid + 1;
			continue;
		}
		const rect = row.getBoundingClientRect();
		if (clientY < rect.top + rect.height / 2) high = mid - 1;
		else low = mid + 1;
	}

	if (low < length) {
		const row = logicRows[low];
		return row instanceof HTMLElement ? getLogicRowDataIndex(row, low) : low;
	}
	const last = logicRows[length - 1];
	return last instanceof HTMLElement ? getLogicRowDataIndex(last, length - 1) + 1 : length;
}

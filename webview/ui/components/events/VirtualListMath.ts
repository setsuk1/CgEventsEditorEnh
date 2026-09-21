import type { ICgEvent } from '@shared';
import type { EventCardUiState } from './EventCardUiStateStore';

export const VIRTUAL_EVENT_HEIGHT_ESTIMATE = {
	eventHeader: 72,
	sectionHeader: 54,
	sectionBody: 56,
	logicItem: 64,
} as const;

export function estimateVirtualEventHeight(
	event: ICgEvent | undefined,
	ui: EventCardUiState | undefined,
): number {
	if (ui?.collapsed) return VIRTUAL_EVENT_HEIGHT_ESTIMATE.eventHeader;

	const blockCollapsed = ui?.blockCollapsed;
	const sections = [
		{ collapsed: blockCollapsed?.trigger ?? false, count: event?.triggers?.length ?? 0 },
		{ collapsed: blockCollapsed?.check ?? false, count: event?.checks?.length ?? 0 },
		{ collapsed: blockCollapsed?.action ?? false, count: event?.actions?.length ?? 0 },
	];

	let expandedSections = 0;
	let totalItems = 0;
	for (const section of sections) {
		if (section.collapsed) continue;
		expandedSections += 1;
		totalItems += section.count;
	}

	return VIRTUAL_EVENT_HEIGHT_ESTIMATE.eventHeader
		+ sections.length * VIRTUAL_EVENT_HEIGHT_ESTIMATE.sectionHeader
		+ expandedSections * VIRTUAL_EVENT_HEIGHT_ESTIMATE.sectionBody
		+ totalItems * VIRTUAL_EVENT_HEIGHT_ESTIMATE.logicItem;
}

export function resolveVirtualResizeBaselineHeight(
	previousMeasuredHeight: number | undefined,
	currentEstimatedHeight: number,
): number {
	if (previousMeasuredHeight !== undefined && Number.isFinite(previousMeasuredHeight)) {
		return Math.max(0, previousMeasuredHeight);
	}
	return Number.isFinite(currentEstimatedHeight) ? Math.max(0, currentEstimatedHeight) : 0;
}

export interface VirtualListLayout {
	prefixSums: number[];
	totalHeight: number;
}

export interface VirtualListRange {
	start: number;
	end: number;
}

export interface VirtualListPadding {
	top: number;
	bottom: number;
}

function normalizeDimension(value: number): number {
	return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function buildVirtualListLayout(
	itemCount: number,
	getItemHeight: (index: number) => number,
	gapPx: number,
): VirtualListLayout {
	const count = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
	const gap = normalizeDimension(gapPx);
	const prefixSums = new Array<number>(count + 1);
	prefixSums[0] = 0;

	for (let index = 0; index < count; index++) {
		const itemHeight = normalizeDimension(getItemHeight(index));
		const outerHeight = itemHeight + (index < count - 1 ? gap : 0);
		prefixSums[index + 1] = prefixSums[index] + outerHeight;
	}

	return {
		prefixSums,
		totalHeight: prefixSums[count] ?? 0,
	};
}

export function findVirtualListIndexAtOffset(
	prefixSums: readonly number[],
	totalHeight: number,
	itemCount: number,
	offset: number,
): number {
	const count = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
	if (count <= 1) {
		return 0;
	}

	const safeOffset = Number.isFinite(offset) ? offset : 0;
	if (safeOffset <= 0) {
		return 0;
	}

	const safeTotalHeight = normalizeDimension(totalHeight);
	if (safeOffset >= safeTotalHeight) {
		return count - 1;
	}

	let low = 0;
	let high = count - 1;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		const nextStart = prefixSums[mid + 1] ?? 0;
		if (nextStart <= safeOffset) {
			low = mid + 1;
		} else {
			high = mid;
		}
	}
	return low;
}

export function computeVirtualListRange(
	prefixSums: readonly number[],
	totalHeight: number,
	itemCount: number,
	viewTop: number,
	viewportHeight: number,
	overscanCount: number,
): VirtualListRange {
	const count = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
	if (count === 0) {
		return { start: 0, end: 0 };
	}

	const safeViewTop = normalizeDimension(viewTop);
	const safeViewportHeight = normalizeDimension(viewportHeight);
	const overscan = Number.isFinite(overscanCount) ? Math.max(0, Math.floor(overscanCount)) : 0;
	const viewBottom = safeViewTop + safeViewportHeight;

	const startIndex = findVirtualListIndexAtOffset(prefixSums, totalHeight, count, safeViewTop);
	const endIndex = findVirtualListIndexAtOffset(prefixSums, totalHeight, count, viewBottom) + 1;

	return {
		start: Math.max(0, startIndex - overscan),
		end: Math.min(count, endIndex + overscan),
	};
}

export function computeVirtualListPadding(
	prefixSums: readonly number[],
	totalHeight: number,
	itemCount: number,
	rangeStart: number,
	rangeEnd: number,
	gapPx: number,
): VirtualListPadding {
	const count = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
	const start = Number.isFinite(rangeStart) ? Math.max(0, Math.min(Math.floor(rangeStart), count)) : 0;
	const end = Number.isFinite(rangeEnd)
		? Math.max(start, Math.min(Math.floor(rangeEnd), count))
		: start;
	const gap = normalizeDimension(gapPx);
	const safeTotalHeight = normalizeDimension(totalHeight);
	const top = prefixSums[start] ?? 0;
	const baseBottom = Math.max(0, safeTotalHeight - (prefixSums[end] ?? 0));
	const missingGap = end > 0 && end < count ? gap : 0;

	return {
		top,
		bottom: baseBottom + missingGap,
	};
}

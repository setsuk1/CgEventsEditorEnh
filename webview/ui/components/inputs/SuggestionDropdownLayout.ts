export interface SuggestionDropdownAnchorRect {
	left: number;
	top: number;
	bottom: number;
	width: number;
}

export interface SuggestionDropdownViewport {
	width: number;
	height: number;
}

export interface SuggestionDropdownLayout {
	left: number;
	width: number;
	maxHeight: number;
	placeBelow: boolean;
}

function finiteNonNegative(value: number): number {
	return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function resolveSuggestionDropdownLayout(
	anchor: SuggestionDropdownAnchorRect,
	viewport: SuggestionDropdownViewport,
	viewportPadding = 8,
	dropdownMaxHeight = 200,
): SuggestionDropdownLayout {
	const viewportWidth = finiteNonNegative(viewport.width);
	const viewportHeight = finiteNonNegative(viewport.height);
	const padding = finiteNonNegative(viewportPadding);
	const horizontalPadding = Math.min(padding, viewportWidth / 2);
	const verticalPadding = Math.min(padding, viewportHeight / 2);
	const availableWidth = Math.max(0, viewportWidth - horizontalPadding * 2);
	const width = Math.min(finiteNonNegative(anchor.width), availableWidth);
	const maxLeft = Math.max(horizontalPadding, viewportWidth - horizontalPadding - width);
	const rawLeft = Number.isFinite(anchor.left) ? anchor.left : horizontalPadding;
	const left = clamp(rawLeft, horizontalPadding, maxLeft);

	const top = Number.isFinite(anchor.top) ? anchor.top : 0;
	const bottom = Number.isFinite(anchor.bottom) ? anchor.bottom : top;
	const spaceBelow = Math.max(0, viewportHeight - bottom - verticalPadding);
	const spaceAbove = Math.max(0, top - verticalPadding);
	const maxHeightLimit = finiteNonNegative(dropdownMaxHeight);
	const placeBelow = spaceBelow >= maxHeightLimit || spaceBelow >= spaceAbove;
	const availableHeight = placeBelow ? spaceBelow : spaceAbove;
	const maxHeight = Math.min(maxHeightLimit, availableHeight);

	return { left, width, maxHeight, placeBelow };
}

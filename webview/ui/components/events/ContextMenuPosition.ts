import { clampViewportCoordinate } from '../../utils/viewportPosition';

export interface ContextMenuPosition {
	left: number;
	top: number;
}

export function computeContextMenuPosition(
	anchorX: number,
	anchorY: number,
	width: number,
	height: number,
	padding: number,
	viewportWidth: number,
	viewportHeight: number,
): ContextMenuPosition {
	const candidates = [
		{ left: anchorX, top: anchorY },
		{ left: anchorX, top: anchorY - height },
		{ left: anchorX - width, top: anchorY - height },
		{ left: anchorX - width, top: anchorY },
	];

	const fits = (left: number, top: number) =>
		left >= padding &&
		top >= padding &&
		left + width <= viewportWidth - padding &&
		top + height <= viewportHeight - padding;

	for (const candidate of candidates) {
		if (fits(candidate.left, candidate.top)) {
			return candidate;
		}
	}

	return {
		left: clampViewportCoordinate(anchorX, width, padding, viewportWidth),
		top: clampViewportCoordinate(anchorY, height, padding, viewportHeight),
	};
}

export function clampViewportCoordinate(
	value: number,
	size: number,
	padding: number,
	viewportSize: number,
): number {
	const max = viewportSize - padding - size;
	return Math.min(Math.max(value, padding), Math.max(padding, max));
}

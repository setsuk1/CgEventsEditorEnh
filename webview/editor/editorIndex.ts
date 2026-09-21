export function normalizeClampedIndex(
	value: number,
	maxInclusive: number,
): number | undefined {
	if (!Number.isFinite(value) || !Number.isFinite(maxInclusive) || maxInclusive < 0) {
		return undefined;
	}
	return Math.max(0, Math.min(Math.floor(value), Math.floor(maxInclusive)));
}

export function resolveRelativeIndex(
	index: number,
	delta: number,
	length: number,
): number | undefined {
	if (!Number.isFinite(index) || !Number.isFinite(delta) || !Number.isFinite(length) || length <= 0) {
		return undefined;
	}
	const sourceIndex = Math.floor(index);
	const targetIndex = Math.floor(sourceIndex + delta);
	if (sourceIndex < 0 || sourceIndex >= length || targetIndex < 0 || targetIndex >= length) {
		return undefined;
	}
	return targetIndex;
}

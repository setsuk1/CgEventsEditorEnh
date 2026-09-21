export interface LogicSelectionMoveEntry {
	eventId: string;
	index: number;
}

export interface LogicSelectionMovePlan {
	targetIndex: number;
}

export function planLogicSelectionMove(
	selection: readonly LogicSelectionMoveEntry[],
	targetEventId: string,
	targetIndex: number,
): LogicSelectionMovePlan | undefined {
	if (!selection.length || !targetEventId || !Number.isFinite(targetIndex)) {
		return undefined;
	}

	const normalizedTargetIndex = Math.max(0, Math.floor(targetIndex));
	const targetIndices = new Set<number>();
	let allEntriesTargetCurrentEvent = true;

	for (const entry of selection) {
		if (entry.eventId !== targetEventId) {
			allEntriesTargetCurrentEvent = false;
			continue;
		}
		if (!Number.isFinite(entry.index)) {
			allEntriesTargetCurrentEvent = false;
			continue;
		}
		const index = Math.floor(entry.index);
		if (index < 0) {
			allEntriesTargetCurrentEvent = false;
			continue;
		}
		targetIndices.add(index);
	}

	if (targetIndices.size === 0) {
		return { targetIndex: normalizedTargetIndex };
	}

	const sortedTargetIndices = [...targetIndices].sort((a, b) => a - b);
	const removedBeforeTarget = sortedTargetIndices.reduce(
		(count, index) => count + (index < normalizedTargetIndex ? 1 : 0),
		0,
	);
	const adjustedTargetIndex = Math.max(0, normalizedTargetIndex - removedBeforeTarget);

	const selectionIsOnlyTargetEvent =
		allEntriesTargetCurrentEvent && targetIndices.size === selection.length;
	if (selectionIsOnlyTargetEvent) {
		const contiguous = sortedTargetIndices.every(
			(index, position) => position === 0 || index === sortedTargetIndices[position - 1] + 1,
		);
		if (contiguous) {
			const first = sortedTargetIndices[0];
			const last = sortedTargetIndices[sortedTargetIndices.length - 1];
			if (normalizedTargetIndex >= first && normalizedTargetIndex <= last + 1) {
				return undefined;
			}
		}
	}

	return { targetIndex: adjustedTargetIndex };
}

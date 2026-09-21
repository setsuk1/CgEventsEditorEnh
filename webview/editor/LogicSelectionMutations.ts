import { ICgEvent, ICgEventLogicBlock } from '@shared';
import { normalizeClampedIndex } from './editorIndex';
import type { LogicBlockKey } from './eventBlockTypes';

export interface LogicSelectionEntry {
	eventId: string;
	index: number;
}

export interface LogicBlockReplacement {
	previous: ICgEventLogicBlock;
	next: ICgEventLogicBlock;
}

export interface LogicSelectionMutationResult {
	previousEvents: ICgEvent[];
	nextEvents: ICgEvent[];
	affectedEventIds: string[];
	blockReplacements: LogicBlockReplacement[];
}

function groupSelectionIndices(
	selection: readonly LogicSelectionEntry[],
): Map<string, Set<number>> {
	const grouped = new Map<string, Set<number>>();
	for (const entry of selection) {
		if (!entry?.eventId || !Number.isFinite(entry.index)) {
			continue;
		}
		const index = Math.floor(entry.index);
		if (index < 0) {
			continue;
		}
		let indices = grouped.get(entry.eventId);
		if (!indices) {
			indices = new Set<number>();
			grouped.set(entry.eventId, indices);
		}
		indices.add(index);
	}
	return grouped;
}

function getSelectedIndices(
	grouped: Map<string, Set<number>>,
	eventId: string,
	sectionLength: number,
): Set<number> | undefined {
	const indices = grouped.get(eventId);
	if (!indices || indices.size === 0) {
		return undefined;
	}
	const valid = new Set<number>();
	for (const index of indices) {
		if (index < sectionLength) {
			valid.add(index);
		}
	}
	return valid.size > 0 ? valid : undefined;
}

function createMutationResult(
	previousEvents: ICgEvent[],
	nextEvents: ICgEvent[],
	affectedEventIds: string[],
	blockReplacements: LogicBlockReplacement[] = [],
): LogicSelectionMutationResult | undefined {
	if (affectedEventIds.length === 0) {
		return undefined;
	}
	return { previousEvents, nextEvents, affectedEventIds, blockReplacements };
}

export function removeLogicSelection(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	selection: readonly LogicSelectionEntry[],
): LogicSelectionMutationResult | undefined {
	const grouped = groupSelectionIndices(selection);
	if (grouped.size === 0) {
		return undefined;
	}

	const affectedEventIds: string[] = [];
	const nextEvents = events.map((event) => {
		const section = event[blockKey];
		const selected = getSelectedIndices(grouped, event.id, section.length);
		if (!selected) {
			return event;
		}

		affectedEventIds.push(event.id);
		return {
			...event,
			[blockKey]: section.filter((_, index) => !selected.has(index)),
		};
	});

	return createMutationResult(events, nextEvents, affectedEventIds);
}

export function toggleLogicSelectionDisabled(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	selection: readonly LogicSelectionEntry[],
): LogicSelectionMutationResult | undefined {
	const grouped = groupSelectionIndices(selection);
	if (grouped.size === 0) {
		return undefined;
	}

	const affectedEventIds: string[] = [];
	const blockReplacements: LogicBlockReplacement[] = [];
	const nextEvents = events.map((event) => {
		const section = event[blockKey];
		const selected = getSelectedIndices(grouped, event.id, section.length);
		if (!selected) {
			return event;
		}

		const nextSection = section.map((block, index) => {
			if (!selected.has(index)) {
				return block;
			}
			const data = block.data ?? {};
			const nextBlock: ICgEventLogicBlock = {
				...block,
				data: { ...data, disabled: !data.disabled },
			};
			blockReplacements.push({ previous: block, next: nextBlock });
			return nextBlock;
		});
		affectedEventIds.push(event.id);
		return { ...event, [blockKey]: nextSection };
	});

	return createMutationResult(events, nextEvents, affectedEventIds, blockReplacements);
}

export function moveLogicSelectionToBoundary(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	selection: readonly LogicSelectionEntry[],
	target: 'top' | 'bottom',
): LogicSelectionMutationResult | undefined {
	const grouped = groupSelectionIndices(selection);
	if (grouped.size === 0) {
		return undefined;
	}

	const affectedEventIds: string[] = [];
	const nextEvents = events.map((event) => {
		const section = event[blockKey];
		const selected = getSelectedIndices(grouped, event.id, section.length);
		if (!selected || selected.size === section.length) {
			return event;
		}

		const selectedBlocks: ICgEventLogicBlock[] = [];
		const remainingBlocks: ICgEventLogicBlock[] = [];
		for (let index = 0; index < section.length; index++) {
			const block = section[index];
			if (selected.has(index)) {
				selectedBlocks.push(block);
			} else {
				remainingBlocks.push(block);
			}
		}

		const nextSection = target === 'top'
			? [...selectedBlocks, ...remainingBlocks]
			: [...remainingBlocks, ...selectedBlocks];
		if (nextSection.every((block, index) => block === section[index])) {
			return event;
		}

		affectedEventIds.push(event.id);
		return { ...event, [blockKey]: nextSection };
	});

	return createMutationResult(events, nextEvents, affectedEventIds);
}

export interface LogicSelectionMoveEntry extends LogicSelectionEntry {
	block: ICgEventLogicBlock;
}

export function moveLogicSelectionToEvent(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	selection: readonly LogicSelectionMoveEntry[],
	targetEventId: string,
	targetIndex: number,
): LogicSelectionMutationResult | undefined {
	if (selection.length === 0) {
		return undefined;
	}

	const eventById = new Map(events.map((event) => [event.id, event] as const));
	const targetEvent = eventById.get(targetEventId);
	const targetSection = targetEvent?.[blockKey];
	if (!Array.isArray(targetSection)) {
		return undefined;
	}

	const removalsByEvent = new Map<string, number[]>();
	const affectedEventIds: string[] = [];
	const blocksToInsert: ICgEventLogicBlock[] = [];
	const blockReplacements: LogicBlockReplacement[] = [];
	const selectedKeys = new Set<string>();

	for (const entry of selection) {
		if (!entry?.eventId || !Number.isFinite(entry.index)) {
			return undefined;
		}
		const index = Math.floor(entry.index);
		if (index < 0) {
			return undefined;
		}
		const sourceEvent = eventById.get(entry.eventId);
		const sourceSection = sourceEvent?.[blockKey];
		const currentBlock = Array.isArray(sourceSection) ? sourceSection[index] : undefined;
		if (!currentBlock || currentBlock !== entry.block) {
			return undefined;
		}

		const selectionKey = `${entry.eventId}\u0000${index}`;
		if (selectedKeys.has(selectionKey)) {
			continue;
		}
		selectedKeys.add(selectionKey);
		blocksToInsert.push(currentBlock);
		const indices = removalsByEvent.get(entry.eventId);
		if (indices) {
			indices.push(index);
		} else {
			removalsByEvent.set(entry.eventId, [index]);
			affectedEventIds.push(entry.eventId);
		}
	}

	if (!removalsByEvent.has(targetEventId)) {
		affectedEventIds.push(targetEventId);
	}

	for (const indices of removalsByEvent.values()) {
		indices.sort((a, b) => b - a);
	}

	const insertAtTarget = normalizeClampedIndex(targetIndex, targetSection.length);
	if (insertAtTarget === undefined) {
		return undefined;
	}

	const nextEvents = events.map((event) => {
		const isTarget = event.id === targetEventId;
		const removalIndices = removalsByEvent.get(event.id);
		if (!isTarget && (!removalIndices || removalIndices.length === 0)) {
			return event;
		}

		const section = event[blockKey];
		if (!Array.isArray(section)) {
			return event;
		}

		let nextSection = section;
		if (removalIndices && removalIndices.length > 0) {
			const cloned = [...nextSection];
			for (const index of removalIndices) {
				if (index >= 0 && index < cloned.length) {
					cloned.splice(index, 1);
				}
			}
			nextSection = cloned;
		}

		if (isTarget) {
			const base = nextSection === section ? [...nextSection] : nextSection;
			const insertAt = Math.max(0, Math.min(insertAtTarget, base.length));
			for (let index = 0; index < blocksToInsert.length; index++) {
				const block = blocksToInsert[index];
				const insertedBlock: ICgEventLogicBlock = {
					type: block.type ?? '',
					data: block.data ? { ...block.data } : {},
				};
				base.splice(insertAt + index, 0, insertedBlock);
				blockReplacements.push({ previous: block, next: insertedBlock });
			}
			nextSection = base;
		}

		if (nextSection === section) {
			return event;
		}
		return { ...event, [blockKey]: nextSection };
	});

	return createMutationResult(events, nextEvents, affectedEventIds, blockReplacements);
}

export function insertLogicBlocks(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	eventIndex: number,
	blocks: readonly ICgEventLogicBlock[],
	targetIndex: number,
): LogicSelectionMutationResult | undefined {
	if (
		blocks.length === 0
		|| !Number.isInteger(eventIndex)
		|| eventIndex < 0
		|| eventIndex >= events.length
	) {
		return undefined;
	}

	const event = events[eventIndex];
	const section = event?.[blockKey];
	if (!event || !Array.isArray(section)) {
		return undefined;
	}

	const toInsert: ICgEventLogicBlock[] = [];
	for (const block of blocks) {
		if (!block) {
			continue;
		}
		toInsert.push({
			type: typeof block.type === 'string' ? block.type : '',
			data: block.data ? { ...block.data } : {},
		});
	}
	if (toInsert.length === 0) {
		return undefined;
	}

	const insertAt = normalizeClampedIndex(targetIndex, section.length);
	if (insertAt === undefined) {
		return undefined;
	}

	const nextSection = [...section];
	nextSection.splice(insertAt, 0, ...toInsert);
	const nextEvents = [...events];
	nextEvents[eventIndex] = { ...event, [blockKey]: nextSection };
	return createMutationResult(events, nextEvents, [event.id]);
}

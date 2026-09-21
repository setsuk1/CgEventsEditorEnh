import type { ICgEvent, ICgEventLogicBlock } from '@shared';
import { normalizeClampedIndex, resolveRelativeIndex } from './editorIndex';
import type { LogicBlockKey } from './eventBlockTypes';

export interface LogicBlockMoveResult {
	previousEvents: ICgEvent[];
	nextEvents: ICgEvent[];
	sourceEventId: string;
	targetEventId: string;
	sourceIndex: number;
	targetIndex: number;
	block: ICgEventLogicBlock;
}

interface LogicSectionTarget {
	eventIndex: number;
	event: ICgEvent;
	section: ICgEventLogicBlock[];
}

function getLogicSectionTarget(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	eventIndex: number,
): LogicSectionTarget | undefined {
	if (!Number.isInteger(eventIndex) || eventIndex < 0 || eventIndex >= events.length) {
		return undefined;
	}
	const event = events[eventIndex];
	const section = event?.[blockKey];
	if (!event || !Array.isArray(section)) {
		return undefined;
	}
	return { eventIndex, event, section };
}

export function moveLogicBlockToIndex(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	eventIndex: number,
	index: number,
	targetIndex: number,
): LogicBlockMoveResult | undefined {
	const source = getLogicSectionTarget(events, blockKey, eventIndex);
	if (!source || !Number.isInteger(index) || index < 0 || index >= source.section.length) {
		return undefined;
	}

	const nextSection = [...source.section];
	const [block] = nextSection.splice(index, 1);
	if (!block) {
		return undefined;
	}
	const insertAt = normalizeClampedIndex(targetIndex, nextSection.length);
	if (insertAt === undefined || insertAt === index) {
		return undefined;
	}
	nextSection.splice(insertAt, 0, block);

	const nextEvents = [...events];
	nextEvents[source.eventIndex] = { ...source.event, [blockKey]: nextSection };
	return {
		previousEvents: events,
		nextEvents,
		sourceEventId: source.event.id,
		targetEventId: source.event.id,
		sourceIndex: index,
		targetIndex: insertAt,
		block,
	};
}

export function moveLogicBlockByDelta(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	eventIndex: number,
	index: number,
	delta: number,
): LogicBlockMoveResult | undefined {
	const source = getLogicSectionTarget(events, blockKey, eventIndex);
	if (!source) {
		return undefined;
	}
	const targetIndex = resolveRelativeIndex(index, delta, source.section.length);
	if (targetIndex === undefined || targetIndex === index) {
		return undefined;
	}
	return moveLogicBlockToIndex(events, blockKey, eventIndex, index, targetIndex);
}

export function moveLogicBlockToEvent(
	events: ICgEvent[],
	blockKey: LogicBlockKey,
	sourceEventIndex: number,
	index: number,
	targetEventIndex: number,
	targetIndex?: number,
): LogicBlockMoveResult | undefined {
	const source = getLogicSectionTarget(events, blockKey, sourceEventIndex);
	if (!source || !Number.isInteger(index) || index < 0 || index >= source.section.length) {
		return undefined;
	}

	if (sourceEventIndex === targetEventIndex) {
		return moveLogicBlockToIndex(
			events,
			blockKey,
			sourceEventIndex,
			index,
			targetIndex ?? source.section.length - 1,
		);
	}

	const target = getLogicSectionTarget(events, blockKey, targetEventIndex);
	if (!target) {
		return undefined;
	}
	const insertAt = targetIndex === undefined
		? target.section.length
		: normalizeClampedIndex(targetIndex, target.section.length);
	if (insertAt === undefined) {
		return undefined;
	}

	const block = source.section[index];
	if (!block) {
		return undefined;
	}
	const sourceSection = [...source.section];
	sourceSection.splice(index, 1);
	const targetSection = [...target.section];
	targetSection.splice(insertAt, 0, block);

	const nextEvents = [...events];
	nextEvents[source.eventIndex] = { ...source.event, [blockKey]: sourceSection };
	nextEvents[target.eventIndex] = { ...target.event, [blockKey]: targetSection };
	return {
		previousEvents: events,
		nextEvents,
		sourceEventId: source.event.id,
		targetEventId: target.event.id,
		sourceIndex: index,
		targetIndex: insertAt,
		block,
	};
}

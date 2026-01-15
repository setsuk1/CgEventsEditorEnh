import { ICgEventLogicBlock } from '@shared';
import { isRecord } from '../../rjsf/utils/rjsfUtils';

export interface LoopIndicatorState {
	isLoop: boolean;
	showSigma: boolean;
}

export interface CheckSectionMeta {
	hasHierarchy: boolean;
	levels: number[];
	breaks: number[];
	loopDisabledByIndex: boolean[];
	loopStates: LoopIndicatorState[];
	elseEventIdByIndex: Array<string | undefined>;
	normalizedAndOrByIndex: string[];
	andLineLevelsByRow: number[][];
	andStartByIndex: boolean[];
	andEndByIndex: boolean[];
	hasNotByIndex: boolean[];
	showOrByIndex: boolean[];
}

function getLogiRecord(data?: Record<string, unknown>): Record<string, unknown> | null {
	if (!data) return null;
	const logi = data['_logi'];
	return isRecord(logi) ? logi : null;
}

function getStringValue(record: Record<string, unknown>, key: string): string | undefined {
	const raw = record[key];
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	return trimmed ? trimmed : undefined;
}

function getBooleanValue(record: Record<string, unknown>, key: string): boolean {
	return record[key] === true;
}

function getElseEventId(data?: Record<string, unknown>): string | undefined {
	if (!data) return undefined;
	return getStringValue(data, '_elseEventId');
}

function getLoopBreaks(data?: Record<string, unknown>): number {
	if (!data) return 0;
	const raw = data['_loopBreaks'];
	if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
	return Math.max(0, Math.floor(raw));
}

function getLoopState(data?: Record<string, unknown>): LoopIndicatorState {
	if (!data) return { isLoop: false, showSigma: false };
	const raw = data['donotActOnEachPass'];
	if (typeof raw === 'boolean') {
		return { isLoop: true, showSigma: raw };
	}
	return { isLoop: false, showSigma: false };
}

function getBlockingLoopLevel(data: Record<string, unknown> | undefined, level: number): number | null {
	if (!data) return null;
	return data['donotActOnEachPass'] === false ? level : null;
}

function isAndValue(value: string): boolean {
	return value !== '' && value !== 'OR';
}

export function computeCheckSectionMeta(items: ICgEventLogicBlock[]): CheckSectionMeta {
	const levels: number[] = [];
	const breaks: number[] = [];
	const loopDisabledByIndex: boolean[] = [];
	const loopStates: LoopIndicatorState[] = [];
	const elseEventIdByIndex: Array<string | undefined> = [];
	const allowAndOr: boolean[] = [];
	const prevSameLevelIndex: number[] = [];
	const nextSameLevelIndex: number[] = [];

	let hasHierarchy = false;
	let nextLevel = 0;
	let prevIsLoop = false;
	let prevLevel = 0;
	const lastLevelIndex = new Map<number, number>();
	let maxBlockingLevel: number | null = null;
	let loopDisabledActive = false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const data = item?.data;
		const loopState = getLoopState(data);
		const loopBreaks = getLoopBreaks(data);
		const incomingLevel = nextLevel;
		const level = Math.max(0, incomingLevel - loopBreaks);

		const prevIndex = lastLevelIndex.get(level);
		prevSameLevelIndex[i] = typeof prevIndex === 'number' ? prevIndex : -1;

		const minAllowedLevel = maxBlockingLevel !== null ? maxBlockingLevel + 1 : 0;
		const hasPrevSameLevel = lastLevelIndex.has(level);
		const isFirstUnderLoop = prevIsLoop && loopBreaks === 0 && level === prevLevel + 1;
		const isLoopDisabled = minAllowedLevel > 0 && level < minAllowedLevel;
		if (isLoopDisabled) {
			loopDisabledActive = true;
		}

		levels[i] = level;
		breaks[i] = loopBreaks;
		loopDisabledByIndex[i] = loopDisabledActive;
		allowAndOr[i] = hasPrevSameLevel && !isFirstUnderLoop;
		loopStates[i] = loopState;
		elseEventIdByIndex[i] = getElseEventId(data);

		lastLevelIndex.set(level, i);
		if (level > 0 || loopState.isLoop || loopBreaks > 0) {
			hasHierarchy = true;
		}

		const blockingLevel = getBlockingLoopLevel(data, level);
		if (blockingLevel !== null) {
			if (maxBlockingLevel === null || blockingLevel > maxBlockingLevel) {
				maxBlockingLevel = blockingLevel;
			}
		}

		nextLevel = level + (loopState.isLoop ? 1 : 0);
		prevIsLoop = loopState.isLoop;
		prevLevel = level;
	}

	const nextLevelIndex = new Map<number, number>();
	for (let i = items.length - 1; i >= 0; i--) {
		const level = levels[i] ?? 0;
		const nextIndex = nextLevelIndex.get(level);
		nextSameLevelIndex[i] = typeof nextIndex === 'number' ? nextIndex : -1;
		nextLevelIndex.set(level, i);
	}

	const normalizedAndOrByIndex: string[] = [];
	const hasNotByIndex: boolean[] = [];
	const showOrByIndex: boolean[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const logi = getLogiRecord(item?.data);
		const raw = logi ? getStringValue(logi, '_and_or') : undefined;
		const effective = allowAndOr[i] ? raw : undefined;
		const normalized = effective ? effective.toUpperCase() : '';
		normalizedAndOrByIndex[i] = normalized;
		showOrByIndex[i] = normalized === 'OR';
		hasNotByIndex[i] = logi ? getBooleanValue(logi, '_not') : false;
	}

	const andLineLevelsByRow: number[][] = new Array(items.length);
	const startsAt: number[][] = Array.from({ length: items.length }, () => []);
	const endsAt: number[][] = Array.from({ length: items.length }, () => []);
	for (let i = 0; i < items.length; i++) {
		const normalized = normalizedAndOrByIndex[i] ?? '';
		if (isAndValue(normalized) && prevSameLevelIndex[i] !== -1) {
			const startIndex = prevSameLevelIndex[i];
			const level = levels[i] ?? 0;
			startsAt[startIndex].push(level);
			endsAt[i].push(level);
		}
	}
	const activeLevels = new Map<number, number>();
	for (let i = 0; i < items.length; i++) {
		for (const level of startsAt[i]) {
			activeLevels.set(level, (activeLevels.get(level) ?? 0) + 1);
		}
		const currentLevel = levels[i] ?? 0;
		const rowLevels: number[] = [];
		for (const [level, count] of activeLevels.entries()) {
			if (count > 0 && level <= currentLevel) {
				rowLevels.push(level);
			}
		}
		rowLevels.sort((a, b) => a - b);
		andLineLevelsByRow[i] = rowLevels;
		for (const level of endsAt[i]) {
			const nextCount = (activeLevels.get(level) ?? 0) - 1;
			if (nextCount <= 0) {
				activeLevels.delete(level);
			} else {
				activeLevels.set(level, nextCount);
			}
		}
	}

	const andStartByIndex: boolean[] = new Array(items.length);
	const andEndByIndex: boolean[] = new Array(items.length);
	for (let i = 0; i < items.length; i++) {
		const normalized = normalizedAndOrByIndex[i] ?? '';
		const hasAndToPrev = isAndValue(normalized) && prevSameLevelIndex[i] !== -1;
		const nextSameLevel = nextSameLevelIndex[i] ?? -1;
		const hasAndToNext =
			nextSameLevel !== -1 && isAndValue(normalizedAndOrByIndex[nextSameLevel] ?? '');
		const hasAndNode = hasAndToPrev || hasAndToNext;
		andStartByIndex[i] = hasAndNode && !hasAndToPrev;
		andEndByIndex[i] = hasAndNode && !hasAndToNext;
	}

	return {
		hasHierarchy,
		levels,
		breaks,
		loopDisabledByIndex,
		loopStates,
		elseEventIdByIndex,
		normalizedAndOrByIndex,
		andLineLevelsByRow,
		andStartByIndex,
		andEndByIndex,
		hasNotByIndex,
		showOrByIndex,
	};
}


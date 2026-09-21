import type { ICgEvent } from '@shared';
import { DEFAULT_EVENT_VALUES } from '../../../editor/EventDefaults';

export interface EventHeaderSummary {
	showStart: boolean;
	showCheck: boolean;
	showDev: boolean;
	repeatChipOff: boolean;
	repeatSummary: string;
	startSummary: string;
	checkSummary: string;
}

function pad2(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

export function formatClockTimeSeconds(totalSeconds: number): string {
	const clamped = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
	const hours = Math.floor(clamped / 3600);
	const minutes = Math.floor((clamped % 3600) / 60);
	const seconds = clamped % 60;
	return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function buildEventHeaderSummary(event: ICgEvent): EventHeaderSummary {
	const startTime = event.startTime ?? DEFAULT_EVENT_VALUES.startTime;
	const checkInterval = event.checkInterval ?? DEFAULT_EVENT_VALUES.checkInterval;
	const repeats = event.repeats ?? DEFAULT_EVENT_VALUES.repeats;
	const repeatInterval = event.repeatInterval ?? DEFAULT_EVENT_VALUES.repeatInterval;
	const showStart = startTime !== DEFAULT_EVENT_VALUES.startTime;
	const showCheck = checkInterval !== DEFAULT_EVENT_VALUES.checkInterval;
	const showInterval = repeatInterval !== DEFAULT_EVENT_VALUES.repeatInterval;
	const showDev = event.devOnly === true;
	const repeatDisplay = repeats === -1 ? '∞' : repeats;
	const repeatChipOff = repeats === 0;
	const repeatParts: string[] = repeatChipOff ? [] : [`x ${repeatDisplay}`];
	if (!repeatChipOff && showInterval) {
		repeatParts.push(`${repeatInterval}ms`);
	}
	return {
		showStart,
		showCheck,
		showDev,
		repeatChipOff,
		repeatSummary: repeatParts.join(' / '),
		startSummary: formatClockTimeSeconds(startTime),
		checkSummary: `${checkInterval}ms`,
	};
}

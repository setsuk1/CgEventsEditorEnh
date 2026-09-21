import type { ICgEvent } from '@shared';

export interface DefaultEventOptions {
	folder?: string;
}

export const DEFAULT_EVENT_VALUES = {
	folder: '',
	disabled: false,
	startTime: 0,
	checkInterval: 10,
	repeatInterval: 0,
	repeats: 0,
	devOnly: false,
	referenceOnly: false,
	color: '#ffffff',
} as const;

export function createDefaultEvent(
	id: string,
	options: DefaultEventOptions = {},
): ICgEvent {
	return {
		id,
		...DEFAULT_EVENT_VALUES,
		folder: options.folder ?? DEFAULT_EVENT_VALUES.folder,
		actions: [],
		checks: [],
		triggers: [],
	};
}

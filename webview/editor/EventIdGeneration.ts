import type { ICgEvent } from '@shared';

export function formatGeneratedEventId(index: number): string {
	return `event_${String(index).padStart(4, '0')}`;
}

export function generateEventId(events: readonly ICgEvent[]): string {
	const existing = new Set(events.map((event) => event.id));
	let index = 1;
	let candidate = formatGeneratedEventId(index);
	while (existing.has(candidate)) {
		index += 1;
		candidate = formatGeneratedEventId(index);
	}
	return candidate;
}

export function generateDuplicateEventId(
	baseId: string,
	events: readonly ICgEvent[],
): string {
	const existing = new Set(events.map((event) => event.id));
	let index = 1;
	let candidate = `${baseId}_copy${index}`;
	while (existing.has(candidate)) {
		index += 1;
		candidate = `${baseId}_copy${index}`;
	}
	return candidate;
}

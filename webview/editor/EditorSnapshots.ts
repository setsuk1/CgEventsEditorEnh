import type { ICgEventsParseSuccess } from '@shared';

export function cloneEditorValue<T>(value: T): T {
	try {
		if (typeof structuredClone === 'function') {
			return structuredClone(value);
		}
	} catch {
		// Fall back to JSON cloning for serializable editor data.
	}
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return value;
	}
}

export function cloneEditorEntry(
	entry?: ICgEventsParseSuccess,
): ICgEventsParseSuccess | undefined {
	if (!entry) {
		return undefined;
	}
	const json = cloneEditorValue(entry.json) ?? entry.json;
	return { ...entry, json };
}

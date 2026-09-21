import {
	isSortingPreset,
	type ISortingPresetsRecord,
} from '@shared';

export function sanitizeSortingPresetsRecord(value: unknown): ISortingPresetsRecord {
	const result: ISortingPresetsRecord = Object.create(null);
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return result;
	}
	for (const [name, rules] of Object.entries(value)) {
		const preset = { name, rules };
		if (isSortingPreset(preset)) {
			result[name] = preset.rules;
		}
	}
	return result;
}

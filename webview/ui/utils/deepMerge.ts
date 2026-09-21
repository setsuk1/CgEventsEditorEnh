const UNSAFE_MERGE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isMergeableObject(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively merges defined object values from source into target.
 * Arrays and primitive values replace the target value.
 */
export function deepMergeDefined(target: any, source: any): any {
	if (!isMergeableObject(source)) {
		return source !== undefined ? source : target;
	}

	const targetObject = isMergeableObject(target) ? target : {};
	const result: Record<string, any> = {};
	for (const key of Object.keys(targetObject)) {
		if (!UNSAFE_MERGE_KEYS.has(key)) {
			result[key] = targetObject[key];
		}
	}
	for (const key of Object.keys(source)) {
		if (UNSAFE_MERGE_KEYS.has(key)) {
			continue;
		}
		const sourceValue = source[key];
		if (sourceValue === undefined) {
			continue;
		}
		const targetValue = targetObject[key];
		if (isMergeableObject(sourceValue)) {
			result[key] = deepMergeDefined(
				isMergeableObject(targetValue) ? targetValue : {},
				sourceValue,
			);
		} else {
			result[key] = sourceValue;
		}
	}
	return result;
}

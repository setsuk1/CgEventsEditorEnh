import { ICgEventsSchema } from '../../shared';

const SCHEMA_CATEGORIES = ['trigger', 'check', 'action', 'definition'] as const;
const UNSAFE_SCHEMA_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function createEmptySchema(): ICgEventsSchema {
	return { trigger: {}, check: {}, action: {}, definition: {} };
}

export function mergeEventsSchemaMap(schemaMap: Record<string, ICgEventsSchema>): ICgEventsSchema {
	const target = createEmptySchema();
	for (const key of Object.keys(schemaMap).sort()) {
		const source = schemaMap[key];
		for (const category of SCHEMA_CATEGORIES) {
			const targetCategory = target[category];
			const sourceCategory = source?.[category] ?? {};
			for (const type of Object.keys(sourceCategory)) {
				if (UNSAFE_SCHEMA_KEYS.has(type)) continue;
				const current = Object.hasOwn(targetCategory, type)
					? targetCategory[type]
					: undefined;
				const incoming = sourceCategory[type];
				if (!current || current.timestamp <= incoming.timestamp) targetCategory[type] = incoming;
			}
		}
	}
	return target;
}

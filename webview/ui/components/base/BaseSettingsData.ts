import type { ICgEventsSchema } from '@shared';
import { createSafeRecord } from '../../utils/safeRecord';

export function hasBaseConfigEditKey(
	configEditKey: string | undefined,
): configEditKey is string {
	return configEditKey !== undefined;
}

export function getBaseConfigEntryValue(
	configs: unknown,
	configKey: string,
): unknown {
	if (Array.isArray(configs)) {
		const index = Number(configKey);
		return Number.isInteger(index) && index >= 0 ? configs[index] : undefined;
	}
	if (!configs || typeof configs !== 'object') return undefined;
	return Object.hasOwn(configs, configKey)
		? (configs as Record<string, unknown>)[configKey]
		: undefined;
}

export function resolveBaseConfigLabel(
	configKey: string,
	localizedLabel: unknown,
	fallbackLabel: string,
): string {
	if (typeof localizedLabel === 'string' && localizedLabel.trim()) {
		return localizedLabel;
	}
	return configKey || fallbackLabel;
}

export function resolveBaseConfigSchema(
	schema: ICgEventsSchema | undefined,
	configKey: string | undefined,
): ICgEventsSchema | undefined {
	if (!schema || configKey === undefined) return undefined;
	return Object.hasOwn(schema.definition, configKey)
		? schema
		: undefined;
}

export function getBaseConfigDefinitionLabel(
	schema: ICgEventsSchema | undefined,
	configKey: string,
): Record<string, string> | undefined {
	if (!schema || !Object.hasOwn(schema.definition, configKey)) {
		return undefined;
	}
	return schema.definition[configKey]?.label;
}

function defineOwnValue(target: object, key: string, value: unknown): void {
	Object.defineProperty(target, key, {
		value,
		writable: true,
		enumerable: true,
		configurable: true,
	});
}

export function mergeBaseConfigPatch(
	currentConfigs: unknown,
	patchConfigs: Record<string, unknown>,
): Record<string, any> | any[] {
	if (Array.isArray(currentConfigs)) {
		const next = [...currentConfigs];
		for (const [key, value] of Object.entries(patchConfigs)) {
			defineOwnValue(next, key, value);
		}
		return next;
	}

	const next = createSafeRecord<unknown>();
	if (currentConfigs && typeof currentConfigs === 'object') {
		for (const [key, value] of Object.entries(currentConfigs)) {
			next[key] = value;
		}
	}
	for (const [key, value] of Object.entries(patchConfigs)) {
		next[key] = value;
	}
	return next;
}


export interface BasePreloadSummaryCounts {
	includedResources: number;
	sourcesCount: number;
}

export function getBasePreloadSummaryCounts(
	preload: any,
	resources: readonly string[],
): BasePreloadSummaryCounts {
	const excludedResources = new Set(
		Array.isArray(preload?.resourcesExclude)
			? preload.resourcesExclude.filter((value: unknown): value is string => typeof value === 'string')
			: [],
	);
	const knownResources = new Set(resources);
	let includedResources = 0;
	for (const resource of knownResources) {
		if (!excludedResources.has(resource)) includedResources += 1;
	}
	const sourcesCount = Array.isArray(preload?.sources) ? preload.sources.length : 0;
	return { includedResources, sourcesCount };
}

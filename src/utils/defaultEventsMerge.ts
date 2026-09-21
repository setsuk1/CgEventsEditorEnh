import { ICgEventsDocument, ObjectUtil } from '../../shared';

export type CgConfigsValue = Record<string, any> | any[];

export interface DefaultEventSourceOrder {
	mtime: number;
	key: string;
}

export function compareDefaultEventSourceOrder(a: DefaultEventSourceOrder, b: DefaultEventSourceOrder): number {
	const byTime = a.mtime - b.mtime;
	return byTime !== 0 ? byTime : a.key.localeCompare(b.key);
}

export function filterDefaultConfigs(
	configs: CgConfigsValue | undefined,
	definitions: Record<string, any> | undefined,
): CgConfigsValue | undefined {
	if (!configs || Array.isArray(configs)) return configs;
	for (const defType of Object.keys(configs)) {
		if (definitions?.[defType]?.use !== 'config') delete configs[defType];
	}
	return configs;
}

export function mergeDefaultConfigs(
	target: CgConfigsValue | undefined,
	source: CgConfigsValue,
): CgConfigsValue {
	const base = target ?? (Array.isArray(source) ? [] : {});
	ObjectUtil.removeKeysWithSameValue(base, source);
	return ObjectUtil.safeAssign(base, source);
}

export function mergeDefaultEvents(target: ICgEventsDocument, source: ICgEventsDocument): ICgEventsDocument {
	if (!target || !source) return target;
	const { config: { stage: sourceStage, preload: sourcePreload, configs: sourceConfigs } = {}, events: sourceEvents = [] } = source;
	const { config: { stage: targetStage, preload: targetPreload, configs: targetConfigs }, events: targetEvents } = target;

	if (sourceStage) ObjectUtil.safeAssign(targetStage, sourceStage);
	if (sourcePreload?.sources) {
		targetPreload.sources = Array.from(new Set(targetPreload.sources.concat(sourcePreload.sources)));
	}
	if (sourcePreload?.resourcesExclude) {
		targetPreload.resourcesExclude = Array.from(new Set(targetPreload.resourcesExclude.concat(sourcePreload.resourcesExclude)));
	}
	if (sourceConfigs) target.config.configs = mergeDefaultConfigs(targetConfigs, sourceConfigs);

	const eventIds = new Set(targetEvents.map((event) => event.id));
	for (const sourceEvent of sourceEvents) {
		if (eventIds.has(sourceEvent.id)) continue;
		eventIds.add(sourceEvent.id);
		targetEvents.push(sourceEvent);
	}
	return target;
}

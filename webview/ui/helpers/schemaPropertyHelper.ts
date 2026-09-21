import { ICgEventsSchemaProperty } from '@shared';

interface DedupedEntry {
	prop: ICgEventsSchemaProperty;
	firstIndex: number;
}

const UNSAFE_SCHEMA_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeSchemaKey(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && !UNSAFE_SCHEMA_KEYS.has(value);
}

function getPropertyIdentity(prop: ICgEventsSchemaProperty): string {
	return JSON.stringify([prop.parent || '', prop.key]);
}

function applyPropertyOrder(entries: DedupedEntry[]): ICgEventsSchemaProperty[] {
	if (entries.length <= 1) {
		return entries.map((item) => item.prop);
	}

	const withOrder: Array<{ entry: DedupedEntry; order: number }> = [];
	const withoutOrder: DedupedEntry[] = [];

	for (const item of entries) {
		const rawOrder = item.prop.propertyOrder;
		if (typeof rawOrder === 'number' && Number.isFinite(rawOrder)) {
			withOrder.push({ entry: item, order: Math.floor(rawOrder) });
		} else {
			withoutOrder.push(item);
		}
	}

	if (withOrder.length === 0) {
		return entries.map((item) => item.prop);
	}

	withOrder.sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return a.entry.firstIndex - b.entry.firstIndex;
	});

	const result: DedupedEntry[] = withoutOrder.slice();
	const orderCounts = new Map<number, number>();
	const total = entries.length;

	for (const item of withOrder) {
		const normalizedOrder = Math.max(0, Math.min(item.order, total));
		const offset = orderCounts.get(normalizedOrder) ?? 0;
		const baseIndex = Math.min(normalizedOrder, result.length);
		const insertIndex = Math.min(baseIndex + offset, result.length);
		result.splice(insertIndex, 0, item.entry);
		orderCounts.set(normalizedOrder, offset + 1);
	}

	return result.map((item) => item.prop);
}

export function dedupeSchemaProperties(props: ICgEventsSchemaProperty[]): ICgEventsSchemaProperty[] {
	const orderedIds: string[] = [];
	const latestByIdentity = new Map<string, { prop: ICgEventsSchemaProperty; firstIndex: number }>();

	for (let i = 0; i < props.length; i++) {
		const prop = props[i];
		if (!prop || !isSafeSchemaKey(prop.key) || (prop.parent && !isSafeSchemaKey(prop.parent))) {
			continue;
		}
		const identity = getPropertyIdentity(prop);
		const existing = latestByIdentity.get(identity);
		if (!existing) {
			orderedIds.push(identity);
			latestByIdentity.set(identity, { prop, firstIndex: i });
		} else {
			existing.prop = prop;
		}
	}

	const topLevel: DedupedEntry[] = [];
	const childGroups = new Map<string, DedupedEntry[]>();
	const childGroupOrder: string[] = [];

	for (const identity of orderedIds) {
		const entry = latestByIdentity.get(identity);
		if (!entry) {
			continue;
		}
		const item: DedupedEntry = { prop: entry.prop, firstIndex: entry.firstIndex };
		const parentKey = entry.prop.parent;
		if (parentKey) {
			const existingGroup = childGroups.get(parentKey);
			if (existingGroup) {
				existingGroup.push(item);
			} else {
				childGroups.set(parentKey, [item]);
				childGroupOrder.push(parentKey);
			}
		} else {
			topLevel.push(item);
		}
	}

	const result: ICgEventsSchemaProperty[] = [];
	result.push(...applyPropertyOrder(topLevel));
	for (const parentKey of childGroupOrder) {
		const group = childGroups.get(parentKey);
		if (group && group.length > 0) {
			result.push(...applyPropertyOrder(group));
		}
	}
	return result;
}

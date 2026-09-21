export type CheckboxValue = string | number | boolean;

export interface CheckboxOptionItem {
	key: string;
	value: CheckboxValue;
	displayName: string;
}

export type CheckboxGroupBy = 'extension' | 'prefix' | 'none';

export function normalizeCheckboxValue(value: unknown): CheckboxValue | undefined {
	if (typeof value === 'string') {
		const normalized = value.trim();
		return normalized || undefined;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}
	return typeof value === 'boolean' ? value : undefined;
}

export function getCheckboxValueKey(value: CheckboxValue): string {
	return `${typeof value}:${String(value)}`;
}

export function parseCheckboxValues(value: unknown): CheckboxValue[] {
	if (Array.isArray(value)) {
		const normalized: CheckboxValue[] = [];
		for (const item of value) {
			const next = normalizeCheckboxValue(item);
			if (next !== undefined) normalized.push(next);
		}
		return normalized;
	}
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}
	return [];
}

export function normalizeCheckboxOptionItems(
	values: readonly unknown[],
	labels?: readonly unknown[],
): CheckboxOptionItem[] {
	const normalized: CheckboxOptionItem[] = [];
	const seen = new Set<string>();
	values.forEach((value, index) => {
		const normalizedValue = normalizeCheckboxValue(value);
		if (normalizedValue === undefined) return;
		const key = getCheckboxValueKey(normalizedValue);
		if (seen.has(key)) return;
		seen.add(key);
		const labelValue = labels?.[index];
		const normalizedLabel = typeof labelValue === 'string' ? labelValue.trim() : '';
		normalized.push({
			key,
			value: normalizedValue,
			displayName: normalizedLabel || String(normalizedValue),
		});
	});
	return normalized;
}

export function groupCheckboxItems(
	items: readonly CheckboxOptionItem[],
	groupBy: Exclude<CheckboxGroupBy, 'none'>,
	otherLabel: string,
): Map<string, CheckboxOptionItem[]> {
	const grouped = new Map<string, CheckboxOptionItem[]>();
	for (const item of items) {
		const valueText = String(item.value);
		let groupKey = otherLabel;
		let displayName = item.displayName;

		if (groupBy === 'extension') {
			const dotIdx = valueText.lastIndexOf('.');
			if (dotIdx >= 0) {
				groupKey = valueText.slice(dotIdx + 1) || otherLabel;
			}
		} else {
			const dotIdx = valueText.indexOf('.');
			if (dotIdx > 0) {
				groupKey = valueText.slice(0, dotIdx);
				const prefix = `${groupKey}.`;
				if (displayName.startsWith(prefix)) {
					displayName = displayName.slice(prefix.length);
				}
			}
		}

		const groupedItem = { ...item, displayName };
		const group = grouped.get(groupKey);
		if (group) group.push(groupedItem);
		else grouped.set(groupKey, [groupedItem]);
	}
	return grouped;
}


export function toggleCheckboxItemValue(
	currentValue: unknown,
	item: CheckboxOptionItem,
): CheckboxValue[] {
	const selected = new Map(
		parseCheckboxValues(currentValue).map((value) => [getCheckboxValueKey(value), value]),
	);
	if (selected.has(item.key)) selected.delete(item.key);
	else selected.set(item.key, item.value);
	return Array.from(selected.values());
}

export function resolveCheckboxSelectAllValues(
	availableValues: readonly CheckboxValue[],
	allSelected: boolean,
	invertSelection: boolean,
): CheckboxValue[] {
	if (invertSelection) {
		return allSelected ? [...availableValues] : [];
	}
	return allSelected ? [] : [...availableValues];
}

export function resolveCheckboxGroupValues(
	currentValue: unknown,
	items: readonly CheckboxOptionItem[],
	allSelectedInGroup: boolean,
	invertSelection: boolean,
): CheckboxValue[] {
	const nextValue = new Map(
		parseCheckboxValues(currentValue).map((value) => [getCheckboxValueKey(value), value]),
	);

	if (invertSelection) {
		if (allSelectedInGroup) items.forEach((item) => nextValue.set(item.key, item.value));
		else items.forEach((item) => nextValue.delete(item.key));
	} else if (allSelectedInGroup) {
		items.forEach((item) => nextValue.delete(item.key));
	} else {
		items.forEach((item) => nextValue.set(item.key, item.value));
	}

	return Array.from(nextValue.values());
}

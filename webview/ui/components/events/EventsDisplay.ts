import type { ICgEvent, ISortingRule } from '@shared';

const FOLDER_FILTER_VALUE_PREFIX = 'folder:';

export function encodeEventFolderFilterValue(folder: string): string {
	return `${FOLDER_FILTER_VALUE_PREFIX}${encodeURIComponent(folder)}`;
}

export function decodeEventFolderFilterValue(value: string): string | undefined {
	if (!value.startsWith(FOLDER_FILTER_VALUE_PREFIX)) return undefined;
	try {
		return decodeURIComponent(value.slice(FOLDER_FILTER_VALUE_PREFIX.length));
	} catch {
		return undefined;
	}
}

export function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index++) {
		if (a[index] !== b[index]) return false;
	}
	return true;
}

export function haveSameUniqueStringSet(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	const aSet = new Set(a);
	const bSet = new Set(b);
	if (aSet.size !== a.length || bSet.size !== b.length || aSet.size !== bSet.size) return false;
	for (const value of aSet) {
		if (!bSet.has(value)) return false;
	}
	return true;
}

export function computeEventFolderOptions(events: readonly ICgEvent[]): string[] {
	const folders = new Set<string>();
	for (const event of events) {
		const folder = (event.folder ?? '').trim();
		if (folder) {
			folders.add(folder);
		}
	}
	return [...folders].sort((a, b) => a.localeCompare(b));
}

export interface EventFolderOptionRename {
	previousFolder: string;
	nextFolder: string;
}

export function reconcileEventFolderFilter(
	previousOptions: readonly string[],
	nextOptions: readonly string[],
	currentFilter: readonly string[],
	allFoldersValue: string,
	noFolderValue: string,
	rename?: EventFolderOptionRename,
): string[] {
	const specialValues = new Set([allFoldersValue, noFolderValue]);
	const previousValues = previousOptions.map(encodeEventFolderFilterValue);
	const nextValues = nextOptions.map(encodeEventFolderFilterValue);
	const nextValueSet = new Set(nextValues);
	const previousValueSet = new Set(previousValues);

	let mapped = [...currentFilter];
	if (rename) {
		const previousValue = encodeEventFolderFilterValue(rename.previousFolder);
		const nextValue = encodeEventFolderFilterValue(rename.nextFolder);
		const previousRemoved = previousValueSet.has(previousValue) && !nextValueSet.has(previousValue);
		const nextAdded = nextValueSet.has(nextValue) && !previousValueSet.has(nextValue);
		if (previousRemoved && nextAdded) {
			mapped = mapped.map((value) => value === previousValue ? nextValue : value);
		}
	}

	const filtered = mapped.filter((value) => specialValues.has(value) || nextValueSet.has(value));
	const deduped = [...new Set(filtered)];
	return deduped.length > 0 ? deduped : [allFoldersValue];
}
export function resolveEventNavigationFolderFilter(
	currentFilter: readonly string[],
	targetEvent: ICgEvent | undefined,
	allFoldersValue: string,
	noFolderValue: string,
): string[] | undefined {
	if (!targetEvent || currentFilter.length === 0 || currentFilter.includes(allFoldersValue)) {
		return undefined;
	}
	const folder = (targetEvent.folder ?? '').trim();
	const targetValue = folder ? encodeEventFolderFilterValue(folder) : noFolderValue;
	if (currentFilter.includes(targetValue)) {
		return undefined;
	}
	return [...new Set([...currentFilter, targetValue])];
}

export function filterEventIdsByFolder(
	eventIds: string[],
	folderFilter: readonly string[],
	getEventById: (eventId: string) => ICgEvent | undefined,
	allFoldersValue: string,
	noFolderValue: string,
): string[] {
	const selectedFolders = new Set(folderFilter);
	if (!selectedFolders.size || selectedFolders.has(allFoldersValue)) {
		return eventIds;
	}

	const showNoFolder = selectedFolders.has(noFolderValue);
	const filtered: string[] = [];
	for (const eventId of eventIds) {
		const event = getEventById(eventId);
		const folder = (event?.folder ?? '').trim();
		if (!folder) {
			if (showNoFolder) {
				filtered.push(eventId);
			}
			continue;
		}
		if (selectedFolders.has(encodeEventFolderFilterValue(folder))) {
			filtered.push(eventId);
		}
	}
	return filtered;
}

function compareValues(aValue: unknown, bValue: unknown): number {
	if (typeof aValue === 'string' && typeof bValue === 'string') {
		return aValue.localeCompare(bValue);
	}
	if (typeof aValue === 'number' && typeof bValue === 'number') {
		return aValue - bValue;
	}
	if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
		return aValue === bValue ? 0 : (aValue ? 1 : -1);
	}
	return String(aValue ?? '').localeCompare(String(bValue ?? ''));
}

export function compareEventsBySortingRules(
	a: ICgEvent | undefined,
	b: ICgEvent | undefined,
	sortingRules: readonly ISortingRule[],
	getEventIndex: (eventId: string) => number,
): number {
	if (!a || !b) {
		return 0;
	}

	for (const rule of sortingRules) {
		const { target, order } = rule;
		let aValue: unknown = a[target];
		let bValue: unknown = b[target];

		if (target === 'actions') {
			aValue = a.actions?.length ?? 0;
			bValue = b.actions?.length ?? 0;
		} else if (target === 'checks') {
			aValue = a.checks?.length ?? 0;
			bValue = b.checks?.length ?? 0;
		} else if (target === 'triggers') {
			aValue = a.triggers?.length ?? 0;
			bValue = b.triggers?.length ?? 0;
		} else if (target === 'index') {
			aValue = getEventIndex(a.id);
			bValue = getEventIndex(b.id);
		}

		const comparison = compareValues(aValue, bValue);
		if (comparison !== 0) {
			return order === 'desc' ? -comparison : comparison;
		}
	}
	return 0;
}

export function getSortedEventIdsForDisplay(
	eventIds: string[],
	folderFilter: readonly string[],
	sortingRules: readonly ISortingRule[],
	getEventById: (eventId: string) => ICgEvent | undefined,
	getEventIndex: (eventId: string) => number,
	allFoldersValue: string,
	noFolderValue: string,
): string[] {
	const filteredIds = filterEventIdsByFolder(
		eventIds,
		folderFilter,
		getEventById,
		allFoldersValue,
		noFolderValue,
	);

	if (
		sortingRules.length === 0 ||
		(sortingRules.length === 1 && sortingRules[0].target === 'index' && sortingRules[0].order === 'asc')
	) {
		return filteredIds;
	}

	const ids = filteredIds === eventIds ? [...eventIds] : filteredIds;
	const eventById = new Map<string, ICgEvent | undefined>();
	for (const id of ids) {
		eventById.set(id, getEventById(id));
	}
	return ids.sort((idA, idB) =>
		compareEventsBySortingRules(
			eventById.get(idA),
			eventById.get(idB),
			sortingRules,
			getEventIndex,
		)
	);
}


export function resolveNewEventFolder(
	folderFilter: readonly string[],
	allFoldersValue: string,
	noFolderValue: string,
): string | undefined {
	if (folderFilter.length !== 1) {
		return undefined;
	}
	const [selected] = folderFilter;
	if (selected === noFolderValue) {
		return '';
	}
	if (selected === allFoldersValue) {
		return undefined;
	}
	return decodeEventFolderFilterValue(selected);
}

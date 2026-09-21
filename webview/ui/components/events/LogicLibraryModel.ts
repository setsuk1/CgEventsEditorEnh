import { ICgEventsSchemaEntry, translateSchema } from '@shared';
import { createSafeRecord, getOrCreateOwn } from '../../utils/safeRecord';

export interface LogicLibraryItem {
	key: string;
	label: string;
	path: string[];
}

export interface LogicLibraryFolderNode {
	name: string;
	children: Record<string, LogicLibraryFolderNode>;
	items: LogicLibraryItem[];
}

export interface LogicLibraryHistory {
	history: string[][];
	historyIdx: number;
}

export interface LogicLibraryHistoryTarget {
	path: string[];
	historyIdx: number;
}

export interface LogicLibraryBreadcrumbStepInput {
	totalSegments: number;
	currentStartIndex: number;
	overflow: boolean;
	clientWidth: number;
	lastMeasuredWidth: number;
}

export interface LogicLibraryBreadcrumbStep {
	nextStartIndex: number;
	nextMeasuredWidth: number;
}

export interface LogicLibraryBreadcrumbSegment {
	index: number;
	label: string;
	path: string[];
	isCurrent: boolean;
}

export interface LogicLibraryBreadcrumbModel {
	displayStartIndex: number;
	hiddenSegments: Array<{ label: string; path: string[] }>;
	visibleSegments: LogicLibraryBreadcrumbSegment[];
}

export interface LogicLibraryFolderNodeLike<T> {
	children: Record<string, T>;
}

export interface ResolvedLogicLibraryPath<T> {
	node: T;
	path: string[];
}

interface ClosestCapableTarget {
	closest(selector: string): Element | null;
}

function parseFirstFolderPath(value: unknown): string[] | undefined {
	if (!Array.isArray(value) || !value.length) {
		return undefined;
	}
	const firstArray = value.find(
		(entry) => Array.isArray(entry) && entry.every((segment) => typeof segment === 'string'),
	);
	if (firstArray && firstArray.length) {
		return firstArray.filter(Boolean);
	}
	const firstString = value.find((entry) => typeof entry === 'string' && entry.trim());
	return typeof firstString === 'string'
		? firstString.split('/').filter(Boolean)
		: undefined;
}

function hasClosest(target: EventTarget | null): target is EventTarget & ClosestCapableTarget {
	return Boolean(
		target
		&& typeof (target as { closest?: unknown }).closest === 'function'
	);
}

export function getLogicLibraryEntryLabel(entry: ICgEventsSchemaEntry): string | undefined {
	const localized = translateSchema(entry.label);
	if (localized !== undefined) {
		return localized;
	}
	const fallback = entry.className;
	return fallback !== undefined ? String(fallback) : undefined;
}

export function getLogicLibraryFolderPath(entry: ICgEventsSchemaEntry): string[] {
	const rawAllpaths = entry.allpaths;
	if (rawAllpaths && typeof rawAllpaths === 'object' && !Array.isArray(rawAllpaths)) {
		const allpathsMap = createSafeRecord<string[]>();
		for (const [key, value] of Object.entries(rawAllpaths)) {
			const parsed = parseFirstFolderPath(value);
			if (parsed?.length) {
				allpathsMap[key] = parsed;
			}
		}
		const preferred = Object.keys(allpathsMap).length > 0 ? translateSchema(allpathsMap) : undefined;
		if (preferred?.length) {
			return preferred;
		}
		const fallback = Object.values(allpathsMap).find((path) => path.length > 0);
		if (fallback) {
			return fallback;
		}
	}

	const directPath = parseFirstFolderPath(rawAllpaths);
	if (directPath) {
		return directPath;
	}
	if (entry.project) {
		return [entry.project];
	}
	return ['root'];
}

export function buildLogicLibraryTree(
	entries: Record<string, ICgEventsSchemaEntry> | undefined,
): LogicLibraryFolderNode {
	const root: LogicLibraryFolderNode = {
		name: 'root',
		children: createSafeRecord<LogicLibraryFolderNode>(),
		items: [],
	};
	if (!entries) {
		return root;
	}

	for (const [key, entry] of Object.entries(entries)) {
		if (entry.deprecated) {
			continue;
		}
		const path = getLogicLibraryFolderPath(entry);
		const label = getLogicLibraryEntryLabel(entry) ?? key;
		let node = root;
		for (const segment of path) {
			node = getOrCreateOwn(
				node.children,
				segment,
				(): LogicLibraryFolderNode => ({
					name: segment,
					children: createSafeRecord<LogicLibraryFolderNode>(),
					items: [],
				}),
			);
		}
		node.items.push({ key, label, path });
	}

	return root;
}

export function searchLogicLibraryFolders(
	node: LogicLibraryFolderNode,
	basePath: readonly string[],
	search: string,
): Array<{ name: string; path: string[] }> {
	const term = search.trim().toLowerCase();
	if (!term) {
		return [];
	}

	const visited = new Set<LogicLibraryFolderNode>();
	const results: Array<{ name: string; path: string[] }> = [];
	const traverse = (current: LogicLibraryFolderNode, currentPath: string[]) => {
		if (visited.has(current)) {
			return;
		}
		visited.add(current);
		if (current.name !== 'root' && current.name.toLowerCase().includes(term)) {
			results.push({ name: current.name, path: currentPath });
		}
		for (const [name, child] of Object.entries(current.children)) {
			traverse(child, [...currentPath, name]);
		}
	};

	for (const [name, child] of Object.entries(node.children)) {
		traverse(child, [...basePath, name]);
	}
	return results;
}

export function searchLogicLibraryItems(
	node: LogicLibraryFolderNode,
	search: string,
): LogicLibraryItem[] {
	const term = search.trim().toLowerCase();
	const items = [...node.items];
	const visited = new Set<LogicLibraryFolderNode>([node]);
	const collect = (child: LogicLibraryFolderNode) => {
		if (visited.has(child)) {
			return;
		}
		visited.add(child);
		items.push(...child.items);
		for (const descendant of Object.values(child.children)) {
			collect(descendant);
		}
	};
	for (const child of Object.values(node.children)) {
		collect(child);
	}

	return term
		? items.filter((item) =>
			item.label.toLowerCase().includes(term) ||
			item.key.toLowerCase().includes(term)
		)
		: items;
}

export function resolveLogicLibraryPath<T extends LogicLibraryFolderNodeLike<T>>(
	root: T,
	path: readonly string[],
): ResolvedLogicLibraryPath<T> {
	const resolvedPath: string[] = [];
	let node = root;
	for (const segment of path) {
		if (!Object.hasOwn(node.children, segment)) {
			break;
		}
		const child = node.children[segment];
		if (!child) {
			break;
		}
		resolvedPath.push(segment);
		node = child;
	}
	return { node, path: resolvedPath };
}

export function getLogicLibraryChildNamesAtPathIndex<T extends LogicLibraryFolderNodeLike<T>>(
	root: T,
	path: readonly string[],
	index: number,
): string[] {
	const normalizedIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
	const prefix = path.slice(0, normalizedIndex);
	const resolved = resolveLogicLibraryPath(root, prefix);
	if (resolved.path.length !== prefix.length) {
		return [];
	}
	return Object.keys(resolved.node.children).sort();
}

export function logicLibraryPathsEqual(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function appendLogicLibraryHistory(
	state: LogicLibraryHistory,
	path: readonly string[],
): LogicLibraryHistory {
	const nextPath = [...path];
	const history = [...state.history.slice(0, state.historyIdx + 1), nextPath];
	return { history, historyIdx: history.length - 1 };
}

export function getLogicLibraryHistoryTarget(
	state: LogicLibraryHistory,
	delta: -1 | 1,
): LogicLibraryHistoryTarget | undefined {
	const historyIdx = state.historyIdx + delta;
	if (historyIdx < 0 || historyIdx >= state.history.length) {
		return undefined;
	}
	const path = state.history[historyIdx];
	return path ? { path, historyIdx } : undefined;
}

export function resolveLogicLibraryBreadcrumbStep(
	input: LogicLibraryBreadcrumbStepInput,
): LogicLibraryBreadcrumbStep {
	const maxStartIndex = Math.max(0, input.totalSegments - 1);
	const currentStartIndex = Math.min(
		maxStartIndex,
		Math.max(0, Math.floor(input.currentStartIndex)),
	);

	if (input.totalSegments <= 1) {
		return {
			nextStartIndex: 0,
			nextMeasuredWidth: input.clientWidth,
		};
	}

	if (input.overflow && currentStartIndex < maxStartIndex) {
		return {
			nextStartIndex: currentStartIndex + 1,
			nextMeasuredWidth: input.clientWidth,
		};
	}

	if (
		!input.overflow
		&& currentStartIndex > 0
		&& input.clientWidth > input.lastMeasuredWidth
	) {
		return {
			nextStartIndex: currentStartIndex - 1,
			nextMeasuredWidth: input.lastMeasuredWidth,
		};
	}

	return {
		nextStartIndex: currentStartIndex,
		nextMeasuredWidth: input.clientWidth,
	};
}

export function buildLogicLibraryBreadcrumbModel(
	path: readonly string[],
	requestedStartIndex: number,
	rootLabel: string,
): LogicLibraryBreadcrumbModel {
	const totalSegments = path.length + 1;
	const maxStartIndex = Math.max(0, totalSegments - 1);
	const normalizedStart = Number.isFinite(requestedStartIndex)
		? Math.floor(requestedStartIndex)
		: 0;
	const displayStartIndex = Math.min(maxStartIndex, Math.max(0, normalizedStart));

	const createSegment = (index: number): LogicLibraryBreadcrumbSegment => ({
		index,
		label: index === 0 ? rootLabel : path[index - 1],
		path: index === 0 ? [] : path.slice(0, index),
		isCurrent: index === totalSegments - 1,
	});

	const hiddenSegments: Array<{ label: string; path: string[] }> = [];
	for (let index = 0; index < displayStartIndex; index++) {
		const segment = createSegment(index);
		hiddenSegments.push({ label: segment.label, path: segment.path });
	}

	const visibleSegments: LogicLibraryBreadcrumbSegment[] = [];
	for (let index = displayStartIndex; index < totalSegments; index++) {
		visibleSegments.push(createSegment(index));
	}

	return { displayStartIndex, hiddenSegments, visibleSegments };
}

export function isLogicLibraryDropdownTarget(target: EventTarget | null): boolean {
	return hasClosest(target)
		&& Boolean(target.closest('.breadcrumb-item-custom.dropdown'));
}

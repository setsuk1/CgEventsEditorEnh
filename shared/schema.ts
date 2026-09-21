export type ICgEventsSchemaTypeSimple = 'number' | 'boolean' | 'string' | 'object' | 'color' | `#${string}`;

export interface ICgEventsSchemaPropertyBase {
	key: string;
	type?: ICgEventsSchemaTypeSimple | 'array';
	format?: string;
	label?: Record<string, string>;
	unit?: Record<string, string>;
	line?: number;
	description?: Record<string, string>;
	enum?: Array<string | number | boolean>;
	enumTitles?: Record<string, string[]>;
	default?: Record<string, any>;
	helper?: string;
	visible?: string;
	indent?: number;
	required?: number;
	items?: ICgEventsSchemaProperty;
	multiple?: boolean;
	collection?: 'array';
	suggest?: string[];
	suggestFilter?: 'none';
	suggestTitles?: Record<string, any>;
	definition?: string;
	gridColumns?: number;
	gridOptions?: string[];
	parent?: string;
	editorOptions?: Record<string, any>;
	collapsed?: number;
	uniqueItems?: number;
	propertyOrder?: number;
	params?: {
		minimum?: number,
		maximum?: number
		[key: string]: any;
	};
	[key: string]: any;
}

export interface ICgEventsSchemaPropertyArray extends ICgEventsSchemaPropertyBase {
	arrayItem?: string;
	type: 'array';
}

export interface ICgEventsSchemaPropertySingle extends ICgEventsSchemaPropertyBase {
	type?: ICgEventsSchemaTypeSimple;
}

export type ICgEventsSchemaProperty = ICgEventsSchemaPropertySingle | ICgEventsSchemaPropertyArray;

export interface ICgEventsSchemaEntry {
	project: string;
	source: { path: string; filename: string };
	toString: {};
	className: string;
	timestamp: number;
	label: Record<string, string>;
	description: Record<string, string>;
	allpaths: Record<string, string[][]>;
	properties: ICgEventsSchemaProperty[];
	format?: string;
	helper?: string;
	editorOptions?: Record<string, any>;
	use?: 'config';
	gridOptions?: string[];
	deprecated?: boolean;
}

export interface ICgEventsSchema {
	action: Record<string, ICgEventsSchemaEntry>;
	trigger: Record<string, ICgEventsSchemaEntry>;
	check: Record<string, ICgEventsSchemaEntry>;
	definition: Record<string, ICgEventsSchemaEntry>;
}

const UNSAFE_SCHEMA_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isSchemaEnum(value: unknown): value is Array<string | number | boolean> {
	return Array.isArray(value) && value.every((entry) =>
		typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
	);
}

function hasUnsafeObjectKeys(root: unknown): boolean {
	if (root === null || typeof root !== 'object') return false;
	const pending: object[] = [root as object];
	const visited = new WeakSet<object>();
	while (pending.length) {
		const current = pending.pop()!;
		if (visited.has(current)) continue;
		visited.add(current);
		if (Array.isArray(current)) {
			for (const item of current) {
				if (item !== null && typeof item === 'object') pending.push(item as object);
			}
			continue;
		}
		for (const key of Object.keys(current)) {
			if (UNSAFE_SCHEMA_KEYS.has(key)) return true;
			const child = (current as Record<string, unknown>)[key];
			if (child !== null && typeof child === 'object') pending.push(child as object);
		}
	}
	return false;
}

function getSchemaReferenceTarget(value: unknown, allowBare = false): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (trimmed.startsWith('#/definitions/')) return trimmed.slice('#/definitions/'.length);
	if (trimmed.startsWith('#') || trimmed.startsWith('@')) return trimmed.slice(1);
	return allowBare ? trimmed : undefined;
}

function hasUnsafeSchemaReference(value: unknown, allowBare = false): boolean {
	const target = getSchemaReferenceTarget(value, allowBare);
	return target !== undefined && UNSAFE_SCHEMA_KEYS.has(target);
}

function hasUnsafeSchemaPropertyReferences(value: Record<string, any>): boolean {
	if (hasUnsafeSchemaReference(value.definition, true)) return true;
	if (hasUnsafeSchemaReference(value.type)) return true;
	if (hasUnsafeSchemaReference(value.arrayItem)) return true;
	return isRecord(value.items) && hasUnsafeSchemaPropertyReferences(value.items);
}

function hasValidSchemaArrayMetadata(value: Record<string, any>): boolean {
	if (value.enum !== undefined && !isSchemaEnum(value.enum)) return false;
	if (value.suggest !== undefined && !isStringArray(value.suggest)) return false;
	if (value.gridOptions !== undefined && !isStringArray(value.gridOptions)) return false;
	if (value.items === undefined) return true;
	return isRecord(value.items) && hasValidSchemaArrayMetadata(value.items);
}

function isSchemaProperty(value: unknown): value is ICgEventsSchemaProperty {
	if (!isRecord(value) || typeof value.key !== 'string' || UNSAFE_SCHEMA_KEYS.has(value.key)) return false;
	if (value.parent !== undefined && (typeof value.parent !== 'string' || UNSAFE_SCHEMA_KEYS.has(value.parent))) return false;
	if (!hasValidSchemaArrayMetadata(value)) return false;
	if (hasUnsafeSchemaPropertyReferences(value)) return false;
	return true;
}

function isSchemaEntry(value: unknown): value is ICgEventsSchemaEntry {
	return isRecord(value) && Number.isFinite(value.timestamp) &&
		(value.project === undefined || typeof value.project === 'string') &&
		(value.deprecated === undefined || typeof value.deprecated === 'boolean') &&
		Array.isArray(value.properties) && value.properties.every(isSchemaProperty);
}

function isSchemaCategory(value: unknown): boolean {
	if (!isRecord(value)) return false;
	return Object.entries(value).every(([type, entry]) =>
		!UNSAFE_SCHEMA_KEYS.has(type) && isSchemaEntry(entry)
	);
}

export function isCgEventsSchema(value: unknown): value is ICgEventsSchema {
	if (!isRecord(value) || hasUnsafeObjectKeys(value)) return false;
	return isSchemaCategory(value.trigger) && isSchemaCategory(value.check) &&
		isSchemaCategory(value.action) && isSchemaCategory(value.definition);
}

export function parseSchemaDefault(text: string): any {
	if (text === undefined || text === null) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch { }
	try {
		return JSON.parse(`"${text}"`);
	} catch { }
}

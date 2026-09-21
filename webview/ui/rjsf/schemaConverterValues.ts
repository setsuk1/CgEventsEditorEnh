import { ICgEventsSchemaProperty, parseSchemaDefault, translateSchema } from '@shared';
import { JSONSchema7Type, JSONSchema7TypeName } from 'json-schema';
import { isRecord } from './utils/rjsfUtils';

/**
 * Get localized text from a Record<string, string> object.
 */
export function getLocalizedText(
	obj: Record<string, string> | string | undefined,
): string | undefined {
	if (typeof obj === 'string') {
		return obj;
	}
	if (!obj || typeof obj !== 'object') {
		return undefined;
	}

	const pick = (val: unknown) => val?.toString();
	const byLanguage = translateSchema(obj);
	if (byLanguage !== undefined) {
		return pick(byLanguage);
	}
	const first = Object.values(obj).find((value) => pick(value) !== undefined);
	return first;
}

/**
 * Try a list of property keys on the given object and return the first localized text found.
 */
export function getLocalizedFromProp(
	obj: any,
	keys: string[],
): string | undefined {
	for (const key of keys) {
		const value = obj ? obj[key] : undefined;
		const localized = getLocalizedText(value);
		if (localized !== undefined) {
			return localized;
		}
	}
	return undefined;
}

export function normalizeSchemaFormat(value: unknown): string {
	return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export interface ExplicitArrayItemPolicy {
	type: JSONSchema7TypeName;
	defaultValue: JSONSchema7Type;
}

export function resolveExplicitArrayItemPolicy(
	arrayItem: unknown,
): ExplicitArrayItemPolicy | undefined {
	if (typeof arrayItem !== 'string') return undefined;
	switch (arrayItem.trim().toLowerCase()) {
		case 'integer':
		case 'int':
			return { type: 'integer', defaultValue: 0 };
		case 'string':
			return { type: 'string', defaultValue: '' };
		case 'number':
			return { type: 'number', defaultValue: 0 };
		case 'boolean':
			return { type: 'boolean', defaultValue: false };
		case 'object':
		case 'json':
			return { type: 'object', defaultValue: {} };
		case 'array':
			return { type: 'array', defaultValue: [] };
		case 'color':
			return { type: 'string', defaultValue: '#ffffff' };
		default:
			return undefined;
	}
}

function hasLocaleKeys(obj: Record<string, any>): boolean {
	return Object.hasOwn(obj, 'en') || Object.hasOwn(obj, 'zh');
}

function resolveLocalizedValue(value: Record<string, any>): any {
	const translated = translateSchema(value);
	if (translated !== undefined) {
		return translated;
	}
	return Object.values(value).find((entry) => entry !== undefined);
}

export function getEffectiveDefaultValue(
	prop: ICgEventsSchemaProperty,
	schemaType: JSONSchema7TypeName,
): any {
	const defaultVal = prop.default;
	if (!isRecord(defaultVal)) {
		return undefined;
	}

	const resolvedDefault = hasLocaleKeys(defaultVal) ? resolveLocalizedValue(defaultVal) : defaultVal;
	if (resolvedDefault === undefined) {
		return undefined;
	}

	const formatRaw = normalizeSchemaFormat(prop.format);
	const skipParseDefault = schemaType === 'string' || formatRaw === 'string';
	if (skipParseDefault) {
		if (typeof resolvedDefault === 'string') {
			return resolvedDefault;
		}
		try {
			return JSON.stringify(resolvedDefault);
		} catch {
			return String(resolvedDefault);
		}
	}

	if (typeof resolvedDefault === 'string') {
		return parseSchemaDefault(resolvedDefault);
	}

	return resolvedDefault;
}

/**
 * Normalize a definition reference key.
 */
export function normalizeDefinitionKey(rawValue: unknown, allowBare = false): string | null {
	if (typeof rawValue !== 'string') {
		return null;
	}

	const trimmed = rawValue.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith('#/definitions/')) {
		return trimmed.slice('#/definitions/'.length);
	}

	if (trimmed.startsWith('#') || trimmed.startsWith('@')) {
		return trimmed.slice(1);
	}

	if (allowBare) {
		return trimmed;
	}

	return null;
}

/**
 * Check if a property references a definition.
 */
export function resolveDefinitionName(
	prop: ICgEventsSchemaProperty,
	includeArrayItems = true,
): string | null {
	const direct = normalizeDefinitionKey(prop.definition, true);
	if (direct) {
		return direct;
	}

	const fromType = normalizeDefinitionKey(prop.type, false);
	if (fromType) {
		return fromType;
	}

	if (includeArrayItems && (prop.type === 'array' || prop.arrayItem || prop.items)) {
		const fromArrayItem = normalizeDefinitionKey(prop.arrayItem, false);
		if (fromArrayItem) {
			return fromArrayItem;
		}

		if (prop.items && typeof prop.items === 'object') {
			const fromItemDef = normalizeDefinitionKey(prop.items.definition, true);
			if (fromItemDef) {
				return fromItemDef;
			}

			const fromItemType = normalizeDefinitionKey(prop.items.type, false);
			if (fromItemType) {
				return fromItemType;
			}
		}
	}

	return null;
}

/**
 * Convert ICgEventsSchemaProperty type to JSON Schema type.
 */
export function convertSchemaPropertyType(prop: ICgEventsSchemaProperty): JSONSchema7TypeName {
	const rawFormat = typeof prop.format === 'string' ? prop.format.trim() : '';
	const format = normalizeSchemaFormat(rawFormat);
	if (rawFormat && format !== 'cgeditorlayout' && !rawFormat.includes(':')) {
		if (format === 'string') {
			return 'string';
		}
		if (format === 'number') {
			return 'number';
		}
		if (format === 'integer' || format === 'int') {
			return 'integer';
		}
		if (format === 'boolean') {
			return 'boolean';
		}
		if (format === 'object' || format === 'json') {
			return 'object';
		}
		if (format === 'array') {
			return 'array';
		}
		if (format === 'color') {
			return 'string';
		}
	}

	const type = prop.type;
	if (!type) {
		return 'string';
	}

	switch (type) {
		case 'number':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'string':
		case 'color':
			return 'string';
		case 'object':
			return 'object';
		case 'array':
			return 'array';
		default:
			if (typeof type === 'string' && (type.startsWith('#') || type.startsWith('@'))) {
				return 'object';
			}
			return 'string';
	}
}

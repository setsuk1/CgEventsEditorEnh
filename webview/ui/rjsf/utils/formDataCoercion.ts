import type { RJSFSchema } from '@rjsf/utils';
import { coerceValueToSchemaType } from './rjsfUtils';

export function parseJsonLike(raw: any): any | undefined {
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return undefined;
		}
	}
	return undefined;
}

export function coerceToSchema(data: any, schema: RJSFSchema, definitions?: RJSFSchema['definitions']): any {
	if (data === undefined || data === null) return data;

	const defs = definitions || schema.definitions;
	let effectiveSchema = schema;
	if (schema.$ref) {
		const refMatch = schema.$ref.match(/^#\/definitions\/(.+)$/);
		if (refMatch && defs && Object.hasOwn(defs, refMatch[1])) {
			const resolved = defs[refMatch[1]];
			if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
				effectiveSchema = { ...resolved, ...schema };
			}
		}
	}

	const schemaType = effectiveSchema.type;
	const coercedPrimitive = coerceValueToSchemaType(data, schemaType);
	if (coercedPrimitive !== data) {
		return coercedPrimitive;
	}

	if (schemaType === 'object' && effectiveSchema.properties && data && typeof data === 'object' && !Array.isArray(data)) {
		if (typeof effectiveSchema.properties === 'object' && !Array.isArray(effectiveSchema.properties)) {
			const hasRole = Object.hasOwn(data, 'role');
			const hasDr = Object.hasOwn(data, 'dr');
			const hasDrProp = Object.hasOwn(effectiveSchema.properties, 'dr');
			if (!hasRole && hasDr && !hasDrProp) {
				const drVal = data.dr;
				const nextData: Record<string, unknown> = { ...data };
				delete nextData.dr;
				nextData.role = typeof drVal === 'object' && drVal !== null ? drVal : { dr: drVal };
				data = nextData;
			}
		}

		const result: Record<string, any> = { ...data };
		for (const [key, propSchema] of Object.entries(effectiveSchema.properties)) {
			if (typeof propSchema === 'boolean') continue;
			if (Object.hasOwn(result, key)) {
				result[key] = coerceToSchema(result[key], propSchema, defs);
			}
		}
		return result;
	}

	if (schemaType === 'object' && typeof data === 'string') {
		const parsed = parseJsonLike(data);
		if (parsed !== undefined) return parsed;
	}

	if (schemaType === 'array') {
		const itemSchema = effectiveSchema.items;
		if (!Array.isArray(data)) {
			if (data && typeof data === 'object') {
				data = [data];
			} else if (typeof data === 'string') {
				const trimmed = data.trim();
				if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
					try {
						data = JSON.parse(trimmed);
					} catch {
						data = [];
					}
				} else {
					data = [];
				}
			} else {
				data = [];
			}
		}
		if (Array.isArray(data) && itemSchema && typeof itemSchema === 'object' && !Array.isArray(itemSchema)) {
			return data.map((item) => coerceToSchema(item, itemSchema, defs));
		}
		return data;
	}

	return data;
}

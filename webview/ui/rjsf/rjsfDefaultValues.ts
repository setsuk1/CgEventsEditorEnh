import type { RJSFSchema } from '@rjsf/utils';
import { ObjectUtil } from '@shared';
import { deepMergeDefined } from '../utils/deepMerge';
import { getOwnValueAtPath, setOwnValueAtPath } from '../../utils/ownPath';
import { isRecord } from './utils/rjsfUtils';
import { parseJsonLike } from './utils/formDataCoercion';

export function resolveRjsfDefinitionRef(
	ref: string,
	definitions: RJSFSchema['definitions'],
): RJSFSchema | undefined {
	if (!ref || !definitions) {
		return undefined;
	}
	const match = ref.match(/^#\/definitions\/(.+)$/);
	if (!match) {
		return undefined;
	}
	const definition = definitions[match[1]];
	return definition && typeof definition === 'object' && !Array.isArray(definition)
		? definition
		: undefined;
}

export function buildRjsfDefaultValues(
	schema: RJSFSchema,
	definitions?: RJSFSchema['definitions'],
): Record<string, any> {
	const result: Record<string, any> = {};
	const defs = definitions || schema.definitions;
	if (!schema.properties) {
		return result;
	}

	for (const [key, prop] of Object.entries(schema.properties)) {
		if (typeof prop === 'boolean') {
			continue;
		}

		let propSchema = prop;
		if (propSchema.$ref) {
			const resolved = resolveRjsfDefinitionRef(propSchema.$ref, defs);
			if (resolved) {
				const { $ref, ...rest } = propSchema;
				propSchema = { ...resolved, ...rest };
			}
		}

		if (propSchema.type === 'object') {
			const base = propSchema.properties
				? buildRjsfDefaultValues(propSchema, defs)
				: undefined;
			if (propSchema.default !== undefined) {
				let effectiveDefault: any = propSchema.default;
				if (typeof effectiveDefault === 'string') {
					const parsed = parseJsonLike(effectiveDefault);
					if (parsed !== undefined) {
						effectiveDefault = parsed;
					}
				}
				if (
					base &&
					effectiveDefault &&
					typeof effectiveDefault === 'object' &&
					!Array.isArray(effectiveDefault)
				) {
					result[key] = ObjectUtil.safeAssign(base, effectiveDefault);
				} else if (
					effectiveDefault &&
					typeof effectiveDefault === 'object' &&
					!Array.isArray(effectiveDefault)
				) {
					result[key] = effectiveDefault;
				} else if (base) {
					result[key] = base;
				}
			} else if (base) {
				result[key] = base;
			}
			continue;
		}

		if (propSchema.type === 'array') {
			if (propSchema.default !== undefined) {
				let effectiveDefault: any = propSchema.default;
				if (typeof effectiveDefault === 'string') {
					const parsed = parseJsonLike(effectiveDefault);
					if (parsed !== undefined) {
						effectiveDefault = parsed;
					}
				}
				result[key] = effectiveDefault;
			} else {
				result[key] = [];
			}
			continue;
		}

		if (propSchema.default !== undefined) {
			result[key] = propSchema.default;
		} else if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
			result[key] = propSchema.enum[0];
		} else if (propSchema.type === 'boolean') {
			result[key] = false;
		} else if (propSchema.type === 'number') {
			result[key] = 0;
		} else if (propSchema.type === 'string') {
			result[key] = '';
		}
	}

	return result;
}


export interface PendingRjsfArrayAdd {
	path: Array<string | number>;
	index: number;
	itemSchema: Record<string, any>;
}

export function createPendingRjsfArrayAdd(
	path: unknown,
	index: unknown,
	itemSchema: unknown,
): PendingRjsfArrayAdd | undefined {
	if (
		!Array.isArray(path)
		|| !path.every((segment) =>
			typeof segment === 'string'
			|| (typeof segment === 'number' && Number.isInteger(segment) && segment >= 0)
		)
		|| typeof index !== 'number'
		|| !Number.isInteger(index)
		|| index < 0
		|| !isRecord(itemSchema)
	) {
		return undefined;
	}
	return {
		path: [...path] as Array<string | number>,
		index,
		itemSchema,
	};
}

export function applyRjsfArrayAddDefaults(
	nextData: any,
	pending: PendingRjsfArrayAdd,
	rowDefault: any,
): any {
	const arrayValue = getOwnValueAtPath(nextData, pending.path);
	if (
		!Array.isArray(arrayValue)
		|| pending.index < 0
		|| pending.index >= arrayValue.length
		|| rowDefault === undefined
	) {
		return nextData;
	}

	const existingRow = arrayValue[pending.index];
	const mergedRow = existingRow === undefined
		? rowDefault
		: isRecord(rowDefault) && isRecord(existingRow)
			? deepMergeDefined(rowDefault, existingRow)
			: existingRow;

	if (ObjectUtil.equals(existingRow, mergedRow)) return nextData;
	return setOwnValueAtPath(nextData, pending.path.concat(pending.index), mergedRow);
}

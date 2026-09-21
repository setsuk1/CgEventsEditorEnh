import type { RJSFValidationError } from '@rjsf/utils';
export function hasClassToken(classNames: string, token: string): boolean {
	return classNames
		.split(/\s+/)
		.filter(Boolean)
		.includes(token);
}

export function stripCgenhClasses(raw?: string): string {
	if (!raw) {
		return '';
	}
	return raw
		.split(/\s+/)
		.filter(Boolean)
		.filter((token) => !token.startsWith('cgenh-'))
		.join(' ');
}

export type RjsfDataPath = string | Array<string | number>;

const UNSAFE_DATA_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export function getValueByPath(target: any, path: RjsfDataPath): any {
	const parts = Array.isArray(path) ? path : path.split('.').filter(Boolean);
	if (!parts.length) return undefined;
	let cur = target;
	for (const seg of parts) {
		if (cur === undefined || cur === null) return undefined;
		if (typeof seg === 'string' && UNSAFE_DATA_PATH_SEGMENTS.has(seg)) return undefined;
		if (
			(typeof cur === 'object' || typeof cur === 'function') &&
			!Object.hasOwn(cur, seg)
		) {
			return undefined;
		}
		cur = cur[seg];
	}
	return cur;
}

export function isRecord(value: unknown): value is Record<string, any> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

const NON_HELPER_FORMATS = new Set<string>([
	'string',
	'number',
	'integer',
	'int',
	'boolean',
	'object',
	'json',
	'array',
	'color',
	'textarea',
	'enum',
	'checkbox',
	'grid',
]);

export function isHelperFormat(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const raw = value.trim();
	if (!raw) return false;
	const lower = raw.toLowerCase();
	if (NON_HELPER_FORMATS.has(lower)) return false;
	if (lower === 'cgeditorlayout') return true;
	if (raw.includes(':')) return true;

	const simple = raw.match(/^([^():]+)(?:\((.*)\))?$/);
	if (!simple) return false;
	const name = (simple[1] || '').trim();
	if (!name) return false;
	const nameLower = name.toLowerCase();
	if (NON_HELPER_FORMATS.has(nameLower)) return false;
	if (nameLower === name && !nameLower.includes('cgeditor')) return false;
	return true;
}

export function coerceValueToSchemaType(value: any, schemaType: unknown): any {
	if (schemaType === 'string') {
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		return value;
	}

	if (schemaType === 'boolean' && typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed === 'true') return true;
		if (trimmed === 'false') return false;
		return value;
	}

	if ((schemaType === 'number' || schemaType === 'integer') && typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return value;
		const num = Number(trimmed);
		if (!Number.isFinite(num)) return value;
		if (schemaType === 'integer' && !Number.isInteger(num)) return value;
		return num;
	}

	return value;
}

export function hasBooleanChange(prev: any, next: any): boolean {
	if (typeof prev === 'boolean' || typeof next === 'boolean') {
		return prev !== next;
	}

	if (Array.isArray(prev) || Array.isArray(next)) {
		if (!Array.isArray(prev) || !Array.isArray(next)) {
			return false;
		}
		const length = Math.max(prev.length, next.length);
		for (let i = 0; i < length; i++) {
			if (hasBooleanChange(prev[i], next[i])) {
				return true;
			}
		}
		return false;
	}

	const prevRecord = isRecord(prev);
	const nextRecord = isRecord(next);
	if (prevRecord || nextRecord) {
		if (!prevRecord || !nextRecord) {
			return false;
		}
		const keys = new Set<string>();
		Object.keys(prev).forEach((key) => keys.add(key));
		Object.keys(next).forEach((key) => keys.add(key));
		for (const key of keys) {
			if (hasBooleanChange(prev[key], next[key])) {
				return true;
			}
		}
	}

	return false;
}


export function getOwnRjsfConfigEntry(
	configs: unknown,
	configKey: string,
): any {
	if (
		configs === null
		|| configs === undefined
		|| (typeof configs !== 'object' && typeof configs !== 'function')
		|| !Object.hasOwn(configs, configKey)
	) {
		return {};
	}
	return (configs as Record<string, any>)[configKey] ?? {};
}


function hasValidationLimit(params: unknown): params is { limit: unknown } {
	return !!params && typeof params === 'object' && 'limit' in params;
}

export function transformRjsfValidationErrors(
	errors: RJSFValidationError[],
	requiredMessage: string,
): RJSFValidationError[] {
	if (!Array.isArray(errors) || errors.length === 0 || !requiredMessage) return errors;

	let changed = false;
	const next = errors.map((error) => {
		const isRequired =
			error.name === 'required'
			|| (error.name === 'minLength' && hasValidationLimit(error.params) && error.params.limit === 1)
			|| (error.name === 'minItems' && hasValidationLimit(error.params) && error.params.limit === 1);
		if (!isRequired || error.message === requiredMessage) return error;
		changed = true;
		return { ...error, message: requiredMessage };
	});
	return changed ? next : errors;
}

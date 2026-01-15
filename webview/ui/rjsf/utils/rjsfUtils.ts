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

export function getValueByPath(target: any, path: string): any {
	if (!path) {
		return undefined;
	}
	const parts = path.split('.').filter(Boolean);
	let cur = target;
	for (const seg of parts) {
		if (cur === undefined || cur === null) {
			return undefined;
		}
		cur = cur[seg];
	}
	return cur;
}

export function isRecord(value: any): value is Record<string, any> {
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
		if (isNaN(num)) return value;
		return schemaType === 'integer' ? Math.floor(num) : num;
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

export function getCollapseState(uiSchema: any): { canCollapse: boolean; collapsed: boolean } {
	const schemaObj = isRecord(uiSchema) ? uiSchema : {};
	const rawOptions = schemaObj['ui:options'];
	const uiOptions = isRecord(rawOptions) ? rawOptions : {};
	const canCollapse = uiOptions.collapsible === true;
	const collapsed = canCollapse && uiOptions.collapsed === true;
	return { canCollapse, collapsed };
}

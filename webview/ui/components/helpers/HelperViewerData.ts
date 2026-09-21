export function normalizeHelperSelection(
	payload: any,
	preserveArraySelection = false,
): any {
	return normalizeHelperSelectionInner(payload, preserveArraySelection, new WeakSet<object>());
}

function normalizeHelperSelectionInner(
	payload: any,
	preserveArraySelection: boolean,
	seen: WeakSet<object>,
): any {
	if (typeof payload === 'string') {
		const trimmed = payload.trim();
		if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
			try {
				payload = JSON.parse(trimmed);
			} catch {
				return payload;
			}
		} else {
			return payload;
		}
	}

	if (payload && typeof payload === 'object') {
		if (seen.has(payload)) {
			return payload;
		}
		seen.add(payload);

		if (!preserveArraySelection && Array.isArray(payload) && payload.length === 1) {
			return normalizeHelperSelectionInner(payload[0], preserveArraySelection, seen);
		}
		if (!preserveArraySelection && Array.isArray(payload) && payload.length > 1) {
			const firstMeaningful = payload.find((item) => item && (item.code || item.config)) ?? payload[0];
			return normalizeHelperSelectionInner(firstMeaningful, preserveArraySelection, seen);
		}
		if (Object.hasOwn(payload, '_overwrite')) {
			const inner = payload.data ?? payload.json;
			if (inner !== undefined) {
				return normalizeHelperSelectionInner(inner, preserveArraySelection, seen);
			}
		}
		const inner = payload.data ?? payload.json ?? payload.value;
		if (inner !== undefined) {
			return normalizeHelperSelectionInner(inner, preserveArraySelection, seen);
		}
	}
	return payload;
}


export interface HelperPayloadOptions {
	helperName?: string;
	helperType?: string;
	helperArgsType?: string;
	defaultValue?: any;
}

export interface HelperPayload {
	json: any;
	raw: any;
}

export function buildHelperPayload(
	value: any,
	options: HelperPayloadOptions = {},
): HelperPayload {
	const name = (options.helperName || '').toLowerCase();
	const helperType = (options.helperType || '').toLowerCase();
	const helperArgsType = (options.helperArgsType || '').toLowerCase();

	if (name.includes('cgeditorlayout')) {
		if (value && typeof value === 'object') return { json: value, raw: value };
		if (typeof value === 'string' && value.trim()) {
			try {
				const parsed = JSON.parse(value);
				return { json: parsed, raw: parsed };
			} catch {
				return { json: value, raw: value };
			}
		}
		return { json: {}, raw: {} };
	}

	if (name.includes('twmapcgeditor')) {
		if (value && typeof value === 'object') return { json: value, raw: value };
		if (typeof value === 'string' && value.trim()) {
			try {
				const parsed = JSON.parse(value);
				return { json: parsed, raw: parsed };
			} catch {
				return { json: value, raw: value };
			}
		}
	}

	const isRoleSelector = helperType.includes('selectrole');
	const isRoleViewer = helperType.includes('viewer') && helperArgsType === 'role';
	const isCustomWeapon =
		helperType.includes('customweapon')
		|| helperType.includes('customfarweapon')
		|| helperType.includes('customthrowableweapon')
		|| helperType.includes('editweapon')
		|| helperType.includes('editfarweapon')
		|| helperType.includes('editthrowableweapon');

	const looksLikeCustomPayload =
		value && typeof value === 'object'
		&& (value.fires !== undefined || value.type !== undefined || value.config !== undefined);
	const hasCodeFields =
		value && typeof value === 'object'
		&& ('code' in value || 'name' in value || 'frameName' in value);
	const wantsCodeString =
		!isRoleSelector
		&& !isRoleViewer
		&& (helperType.includes('select') || helperType.includes('viewer'))
		&& !isCustomWeapon
		&& !looksLikeCustomPayload
		&& (typeof value !== 'object' || hasCodeFields);

	if (wantsCodeString) {
		const code = value && typeof value === 'object'
			? value.code ?? value.name ?? value.frameName ?? ''
			: value ?? '';
		const safeCode = code === undefined || code === null ? '' : String(code);
		return { json: safeCode, raw: safeCode };
	}

	if (isRoleSelector || isRoleViewer) {
		if (value && typeof value === 'object') return { json: value, raw: value };
		const roleInit = value ? { dr: value } : { list: [] as unknown[] };
		return { json: roleInit, raw: roleInit };
	}

	if (isCustomWeapon) {
		const base = value ?? options.defaultValue ?? {};
		let payload: any;
		if (base && typeof base === 'object') {
			payload = base.config !== undefined
				? base
				: { code: base.code ?? base.name ?? '', config: base };
		} else {
			const fallback = options.defaultValue;
			const defaultConfig = fallback && typeof fallback === 'object'
				? fallback.config ?? fallback
				: {};
			payload = { code: base ?? '', config: defaultConfig || {} };
		}
		if (!payload.code && options.defaultValue && typeof options.defaultValue === 'object') {
			payload.code = options.defaultValue.code ?? '';
		}
		if (payload.config === undefined) payload.config = {};
		return { json: payload.config ? payload.config : payload, raw: payload };
	}

	const expectsObject =
		name.includes('weapon')
		|| name.includes('farweapon')
		|| name.includes('throwableweapon')
		|| name.includes('itemicon')
		|| name.includes('item')
		|| name.includes('mapblock')
		|| name.includes('mapobject')
		|| name.includes('customweapon')
		|| name.includes('customitem')
		|| name.includes('editor')
		|| name.includes('role');

	if (expectsObject) {
		if (value && typeof value === 'object') return { json: value, raw: value };
		const code = value === undefined || value === null ? '' : String(value);
		const objectValue = { code, name: code };
		return { json: objectValue, raw: objectValue };
	}

	if (value === undefined) return { json: '', raw: '' };
	if (value === null) return { json: null, raw: null };
	return { json: value, raw: value };
}

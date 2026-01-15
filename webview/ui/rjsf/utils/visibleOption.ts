import { UiSchema } from '@rjsf/utils';
import { modifier } from '../../../editor/modifier';
import { getValueByPath, isRecord } from './rjsfUtils';

function toExpressionLiteral(value: unknown): string {
	if (value === undefined || value === null) {
		return '';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	try {
		return JSON.stringify(value);
	} catch {
		return '';
	}
}

export function evaluateVisibleOption(
	visibleOpt: unknown,
	rootFormData: unknown,
	parentPath: string
): boolean {
	if (typeof visibleOpt === 'boolean') {
		return visibleOpt;
	}
	if (typeof visibleOpt !== 'string') {
		return true;
	}
	const raw = visibleOpt.trim();
	if (!raw) {
		return true;
	}

	const resolved = raw.replace(/\{([^}]+)\}/g, (_match, pathExpr) => {
		const trimmedPath = String(pathExpr ?? '').trim();
		if (!trimmedPath) {
			return '';
		}

		let value: unknown = undefined;
		if (parentPath) {
			const siblingPath = `${parentPath}.${trimmedPath}`;
			value = getValueByPath(rootFormData, siblingPath);
		}
		if (value === undefined) {
			value = getValueByPath(rootFormData, trimmedPath);
		}
		return toExpressionLiteral(value);
	});

	return modifier.isExpressionTrue(resolved, true);
}

function getVisibleOption(uiSchema: UiSchema | undefined): unknown {
	if (!isRecord(uiSchema)) {
		return undefined;
	}
	const rawOptions = uiSchema['ui:options'];
	const uiOptions = isRecord(rawOptions) ? rawOptions : undefined;
	return uiOptions ? uiOptions.visible : undefined;
}

function buildPathString(path: Array<string | number>): string {
	return path.map((seg) => String(seg)).filter(Boolean).join('.');
}

function resolveArrayItemUiSchema(rawItems: unknown, index: number): UiSchema | undefined {
	if (Array.isArray(rawItems)) {
		const entry = rawItems[index] ?? rawItems[rawItems.length - 1];
		return isRecord(entry) ? entry : undefined;
	}
	return isRecord(rawItems) ? rawItems : undefined;
}

export function pruneHiddenFields(
	data: any,
	uiSchema: UiSchema | undefined,
	rootFormData: unknown,
	path: Array<string | number> = []
): any {
	if (Array.isArray(data)) {
		if (!isRecord(uiSchema)) {
			return data;
		}
		const rawItems = uiSchema.items;
		if (!rawItems) {
			return data;
		}
		let changed = false;
		const nextItems = data.map((item, index) => {
			const itemUiSchema = resolveArrayItemUiSchema(rawItems, index);
			if (!itemUiSchema) {
				return item;
			}
			const prunedItem = pruneHiddenFields(item, itemUiSchema, rootFormData, [...path, index]);
			if (prunedItem !== item) {
				changed = true;
			}
			return prunedItem;
		});
		return changed ? nextItems : data;
	}

	if (!isRecord(data) || !isRecord(uiSchema)) {
		return data;
	}

	const parentPath = buildPathString(path);
	const next: Record<string, any> = {};
	let changed = false;

	for (const key of Object.keys(data)) {
		const value = data[key];
		const fieldUiSchema = isRecord(uiSchema) ? uiSchema[key] : undefined;
		const visibleOpt = getVisibleOption(isRecord(fieldUiSchema) ? fieldUiSchema : undefined);
		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, parentPath);
		if (!isVisible) {
			changed = true;
			continue;
		}
		let nextValue = value;
		if ((isRecord(value) || Array.isArray(value)) && isRecord(fieldUiSchema)) {
			const prunedValue = pruneHiddenFields(value, fieldUiSchema, rootFormData, [...path, key]);
			if (prunedValue !== value) {
				changed = true;
				nextValue = prunedValue;
			}
		}
		next[key] = nextValue;
	}

	return changed ? next : data;
}

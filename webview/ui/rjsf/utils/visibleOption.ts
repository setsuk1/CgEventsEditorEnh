import { UiSchema } from '@rjsf/utils';
import { all, create } from 'mathjs/number';
import { getValueByPath, isRecord, RjsfDataPath } from './rjsfUtils';

const UNSAFE_DATA_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const MATCH_REGEX_LITERAL_RE = /match\(([\s\S]*?),\s*(\/(?:\\.|[^/\\])*\/[a-z]*)\s*\)/g;

const visibleExpressionMath = create(all, {});
visibleExpressionMath.import({
	equal(a: string, b: string) {
		return a === b;
	},
	unequal(a: string, b: string) {
		return a !== b;
	},
	includes(a: any, b: string) {
		let values: string[];
		if (Array.isArray(a)) {
			values = a;
		} else if (a && typeof a === 'object' && typeof a.toArray === 'function') {
			values = a.toArray();
		}
		return values?.includes(b) ?? (a + '').includes(b);
	},
	match(a: unknown, b: string) {
		const text = String(a ?? '');
		const parsed = b && b.match(/^\/(.*)\/([a-z]*)$/);
		return parsed ? new RegExp(parsed[1], parsed[2]).test(text) : text.includes(b);
	},
}, {
	override: true,
});

function isVisibleExpressionTrue(input: string, defaultValue = true): boolean {
	try {
		const expression = input.replace(
			MATCH_REGEX_LITERAL_RE,
			(_match, valueExpression: string, regexLiteral: string) =>
				`match(${valueExpression},${JSON.stringify(regexLiteral)})`,
		);
		const result = visibleExpressionMath.evaluate(expression);
		return !(!result || result === 'false' || result === '0');
	} catch {
		return defaultValue;
	}
}

function toExpressionLiteral(value: unknown): string {
	if (value === undefined || value === null) {
		return '';
	}
	if (typeof value === 'string') {
		return JSON.stringify(value);
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
	parentPath: RjsfDataPath
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
		if (!trimmedPath) return '';

		const relativePath = trimmedPath.split('.').filter(Boolean);
		let value: unknown = undefined;
		if (Array.isArray(parentPath)) {
			if (parentPath.length) value = getValueByPath(rootFormData, [...parentPath, ...relativePath]);
		} else if (parentPath) {
			value = getValueByPath(rootFormData, `${parentPath}.${trimmedPath}`);
		}
		if (value === undefined) value = getValueByPath(rootFormData, relativePath);
		return toExpressionLiteral(value);
	});

	return isVisibleExpressionTrue(resolved, true);
}

function getVisibleOption(uiSchema: UiSchema | undefined): unknown {
	if (!isRecord(uiSchema)) return undefined;
	const rawOptions = uiSchema['ui:options'];
	const uiOptions = isRecord(rawOptions) ? rawOptions : undefined;
	return uiOptions ? uiOptions.visible : undefined;
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
		const rawItems = isRecord(uiSchema) ? uiSchema.items : undefined;
		let changed = false;
		const nextItems = data.map((item, index) => {
			const itemUiSchema = rawItems ? resolveArrayItemUiSchema(rawItems, index) : undefined;
			const prunedItem = pruneHiddenFields(item, itemUiSchema, rootFormData, [...path, index]);
			if (prunedItem !== item) changed = true;
			return prunedItem;
		});
		return changed ? nextItems : data;
	}

	if (!isRecord(data)) return data;
	const uiRecord = isRecord(uiSchema) ? uiSchema : undefined;
	const next: Record<string, any> = {};
	let changed = false;

	for (const key of Object.keys(data)) {
		if (UNSAFE_DATA_KEYS.has(key)) {
			changed = true;
			continue;
		}
		const value = data[key];
		const fieldUiSchema = uiRecord?.[key];
		const fieldUiRecord = isRecord(fieldUiSchema) ? fieldUiSchema : undefined;
		const visibleOpt = getVisibleOption(fieldUiRecord);
		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, path);
		if (!isVisible) {
			changed = true;
			continue;
		}
		let nextValue = value;
		if (isRecord(value) || Array.isArray(value)) {
			const prunedValue = pruneHiddenFields(value, fieldUiRecord, rootFormData, [...path, key]);
			if (prunedValue !== value) {
				changed = true;
				nextValue = prunedValue;
			}
		}
		next[key] = nextValue;
	}

	return changed ? next : data;
}

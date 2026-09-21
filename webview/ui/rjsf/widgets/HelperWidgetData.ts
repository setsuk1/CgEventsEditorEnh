import type { HelperInfo } from '../../components/helpers/HelperInfo';
import { coerceValueToSchemaType, isRecord } from '../utils/rjsfUtils';

export interface HelperWidgetOptions {
	helper?: string;
	format?: string;
	editorOptions?: any;
	compact?: boolean;
	entryType?: 'action' | 'trigger' | 'check' | 'definition';
	entryKey?: string;
	propKey?: string;
}

export interface HelperPreviewStyle {
	width: string;
	height: string;
	border?: string;
	borderRadius?: string;
}

export interface HelperPreviewLayout {
	widthValue: string;
	heightValue: string;
	helperName: string;
	style: HelperPreviewStyle;
}

export function normalizeHelperWidgetOptions(rawOptions: unknown): HelperWidgetOptions {
	if (!isRecord(rawOptions)) return {};
	const entryType = rawOptions.entryType;
	const normalizedEntryType =
		entryType === 'action' || entryType === 'trigger' || entryType === 'check' || entryType === 'definition'
			? entryType
			: undefined;
	return {
		helper: typeof rawOptions.helper === 'string' ? rawOptions.helper : undefined,
		format: typeof rawOptions.format === 'string' ? rawOptions.format : undefined,
		editorOptions: rawOptions.editorOptions,
		compact: rawOptions.compact === true,
		entryType: normalizedEntryType,
		entryKey: typeof rawOptions.entryKey === 'string' ? rawOptions.entryKey : undefined,
		propKey: typeof rawOptions.propKey === 'string' ? rawOptions.propKey : undefined,
	};
}

export function parseHelperInfo(
	helperValue: unknown,
	source: 'format' | 'helper',
	options: HelperWidgetOptions,
): HelperInfo | null {
	if (typeof helperValue !== 'string' || !helperValue.trim()) return null;

	const raw = helperValue.trim();
	let match = raw.match(/^([^:]+):([^()]+)(?:\((.*)\))?$/);
	let name: string | undefined;
	let helperType: string | undefined;
	let argsSection = '';

	if (match) {
		[, name, helperType, argsSection = ''] = match;
	} else {
		const simple = raw.match(/^([^():]+)(?:\((.*)\))?$/);
		if (!simple) return null;
		[, name, argsSection = ''] = simple;
		helperType = 'edit';
		const lowerName = name.toLowerCase();
		if (lowerName === name && !lowerName.includes('cgeditor')) return null;
	}

	const args: Record<string, string> = {};
	for (const rawPair of argsSection.split(',')) {
		const pair = rawPair.trim();
		if (!pair) continue;
		const [key, ...rest] = pair.split('=');
		if (key) args[key.trim()] = rest.join('=').trim();
	}

	if (!name || !helperType) return null;
	return {
		name,
		helperType,
		args,
		raw,
		source,
		editorOptions: options.editorOptions,
		entryType: options.entryType,
		entryKey: options.entryKey,
		propKey: options.propKey,
	};
}

export function parseHelperWidgetValue(
	value: any,
	defaultValue: any,
	schemaType: unknown,
): any {
	const effectiveValue = value ?? defaultValue;
	if (schemaType === 'string' && typeof effectiveValue === 'string') {
		const trimmed = effectiveValue.trim();
		if (
			(trimmed.startsWith('{') && trimmed.endsWith('}'))
			|| (trimmed.startsWith('[') && trimmed.endsWith(']'))
		) {
			try {
				return JSON.parse(trimmed);
			} catch {
				return effectiveValue;
			}
		}
	}
	return effectiveValue;
}

export function shouldPreserveHelperArraySelection(
	schemaType: unknown,
	parsedValue: any,
): boolean {
	return schemaType === 'array' || Array.isArray(parsedValue);
}

export function coerceHelperWidgetSelection(
	value: any,
	schemaType: unknown,
	fallbackValue?: any,
): any {
	if (schemaType === 'string' && value !== null && value !== undefined && typeof value === 'object') {
		try {
			return JSON.stringify(value);
		} catch {
			return fallbackValue;
		}
	}
	return coerceValueToSchemaType(value, schemaType);
}

export function resolveHelperPreviewLayout(
	viewHelperInfo: HelperInfo | null,
): HelperPreviewLayout {
	const helperArgs = viewHelperInfo?.args || {};
	const helperName = viewHelperInfo?.name?.toLowerCase?.() || '';
	const widthValue = helperName.includes('cgeditorlayout') ? '100%' : (helperArgs.width || '100%');
	const heightValue = helperName.includes('cgeditorlayout')
		? (helperArgs.height || '720px')
		: (helperArgs.height || '64px');
	const style: HelperPreviewStyle = {
		width: widthValue,
		height: heightValue,
	};
	if (helperArgs.border) style.border = helperArgs.border;
	if (helperArgs.borderRadius) style.borderRadius = helperArgs.borderRadius;
	return { widthValue, heightValue, helperName, style };
}

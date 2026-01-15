import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { ICgEventsSchema, ICgEventsSchemaEntry, ICgEventsSchemaProperty, parseSchemaDefault, translateSchema } from '@shared';
import { JSONSchema7TypeName } from 'json-schema';
import { getResponsiveGridClasses } from '../helpers/gridHelper';
import { dedupeSchemaProperties } from '../helpers/schemaPropertyHelper';
import { isHelperFormat, isRecord } from './utils/rjsfUtils';

export interface ConvertedSchema {
	schema: RJSFSchema;
	uiSchema: UiSchema;
}

export interface SchemaConverterOptions {
	rootSchema?: ICgEventsSchema;
	defCache?: Map<string, RJSFSchema>;
	processing?: Set<string>;
	useGridLayout?: boolean;
}

/**
 * Get localized text from a Record<string, string> object
 */
function getLocalizedText(
	obj: Record<string, string> | string | undefined
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
	const first = Object.values(obj).find((v) => pick(v) !== undefined);
	return first;
}

/**
 * Try a list of property keys on the given object and return the first localized text found
 */
function getLocalizedFromProp(
	obj: any,
	keys: Array<string>
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

function hasLocaleKeys(obj: Record<string, any>): boolean {
	return Object.prototype.hasOwnProperty.call(obj, 'en') || Object.prototype.hasOwnProperty.call(obj, 'zh');
}

function resolveLocalizedValue(value: Record<string, any>): any {
	const translated = translateSchema(value);
	if (translated !== undefined) {
		return translated;
	}
	return Object.values(value).find((v) => v !== undefined);
}

function getEffectiveDefaultValue(prop: ICgEventsSchemaProperty, schemaType: JSONSchema7TypeName): any {
	const defaultVal = prop.default;
	if (!isRecord(defaultVal)) {
		return undefined;
	}

	const resolvedDefault = hasLocaleKeys(defaultVal) ? resolveLocalizedValue(defaultVal) : defaultVal;
	if (resolvedDefault === undefined) {
		return undefined;
	}

	const formatRaw = typeof prop.format === 'string' ? prop.format.trim().toLowerCase() : '';
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
 * Normalize a definition reference key
 */
function normalizeDefinitionKey(rawValue: unknown, allowBare = false): string | null {
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
 * Check if a property references a definition
 */
function resolveDefinitionName(prop: ICgEventsSchemaProperty): string | null {
	// Check definition field
	const direct = normalizeDefinitionKey(prop.definition, true);
	if (direct) {
		return direct;
	}

	// Check type field for definition references
	const fromType = normalizeDefinitionKey(prop.type, false);
	if (fromType) {
		return fromType;
	}

	// For arrays, check arrayItem and items
	if (prop.type === 'array' || prop.arrayItem || prop.items) {
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

function getDefinitionEntry(rootSchema: ICgEventsSchema | undefined, defName: string): ICgEventsSchemaEntry | undefined {
	if (!rootSchema || !defName) {
		return undefined;
	}

	return rootSchema.definition?.[defName];
}

function getDefinitionSchema(defName: string, options: SchemaConverterOptions): RJSFSchema | undefined {
	const { rootSchema } = options;
	if (!defName) {
		return undefined;
	}

	options.defCache = options.defCache ?? new Map<string, RJSFSchema>();
	options.processing = options.processing ?? new Set<string>();

	if (options.defCache.has(defName)) {
		return options.defCache.get(defName);
	}

	if (options.processing.has(defName)) {
		// Prevent recursion loops
		return { type: 'object', properties: {} };
	}

	const entry = getDefinitionEntry(rootSchema, defName);
	if (!entry) {
		return undefined;
	}

	options.processing.add(defName);
	const result = convertSchemaEntry(entry, options).schema;
	options.processing.delete(defName);
	options.defCache.set(defName, result);
	return result;
}

/**
 * Convert ICgEventsSchemaProperty type to JSON Schema type
 */
function convertType(prop: ICgEventsSchemaProperty): JSONSchema7TypeName {
	const rawFormat = typeof prop.format === 'string' ? prop.format.trim() : '';
	if (rawFormat && rawFormat !== 'CgEditorLayout' && !rawFormat.includes(':')) {
		const format = rawFormat.toLowerCase();
		if (format === 'string') { return 'string'; }
		if (format === 'number') { return 'number'; }
		if (format === 'integer' || format === 'int') { return 'integer'; }
		if (format === 'boolean') { return 'boolean'; }
		if (format === 'object' || format === 'json') { return 'object'; }
		if (format === 'array') { return 'array'; }
		if (format === 'color') { return 'string'; }
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
			// Check if it's a definition reference
			if (typeof type === 'string' && (type.startsWith('#') || type.startsWith('@'))) {
				return 'object';
			}
			return 'string';
	}
}

/**
 * Convert a single ICgEventsSchemaProperty to JSON Schema property
 */
function convertProperty(
	prop: ICgEventsSchemaProperty,
	options: SchemaConverterOptions
): RJSFSchema {
	const { rootSchema, processing = new Set<string>() } = options;
	const jsonSchema: RJSFSchema = {};

	// Title and description
	const title = getLocalizedFromProp(prop, ['label', 'locale']);
	const description = getLocalizedFromProp(prop, ['description']);
	// Only set title if non-empty (empty string means intentionally hide label)
	if (title) {
		jsonSchema.title = title;
	}

	if (description !== undefined) {
		jsonSchema.description = description;
	}


	// Handle arrays first (so arrayItem references don't get treated as object $ref)
	const isArray = prop.type === 'array' || prop.collection === 'array' || prop.multiple || prop.arrayItem || prop.items;
	if (isArray) {
		jsonSchema.type = 'array';
		const uniqueItems = !!prop.uniqueItems;
		if (uniqueItems) {
			jsonSchema.uniqueItems = true;
		}

		// Determine item schema (default to string with empty string as initial value)
		let itemSchema: RJSFSchema = { type: 'string', default: '' };
		const itemDefName = resolveDefinitionName(prop);

		if (itemDefName) {
			if (rootSchema?.definition?.[itemDefName]) {
				itemSchema = { $ref: `#/definitions/${itemDefName}` };
			} else {
				const defSchema = getDefinitionSchema(itemDefName, options);
				if (defSchema) {
					itemSchema = defSchema;
				} else {
					itemSchema = { type: 'object', properties: {} };
				}
			}
		} else if (prop.items && typeof prop.items === 'object') {
			itemSchema = convertProperty(prop.items, options);
		} else if (typeof prop.arrayItem === 'string') {
			const arrayItemType = prop.arrayItem.trim();
			const normalized = arrayItemType.toLowerCase();
			if (normalized === 'integer' || normalized === 'int') {
				itemSchema = { type: 'integer', default: 0 };
			} else if (normalized === 'string') {
				itemSchema = { type: 'string', default: '' };
			} else if (normalized === 'number') {
				itemSchema = { type: 'number', default: 0 };
			} else if (normalized === 'boolean') {
				itemSchema = { type: 'boolean', default: false };
			} else if (normalized === 'object') {
				itemSchema = { type: 'object', default: {} };
			} else if (normalized === 'color') {
				itemSchema = { type: 'string', default: '#ffffff' };
			}
		} else if (prop.type) {
			// For collection/multiple arrays where `type` describes the item type
			const itemType = convertType(prop);
			if (itemType) {
				itemSchema = { type: itemType };
				// Set default value based on type
				switch (itemType) {
					case 'string':
						itemSchema.default = '';
						break;
					case 'number':
					case 'integer':
						itemSchema.default = 0;
						break;
					case 'boolean':
						itemSchema.default = false;
						break;
					case 'object':
						itemSchema.default = {};
						break;
				}
			}
		}

		if (prop.enum && prop.enum.length > 0 && !itemSchema.enum) {
			itemSchema.enum = prop.enum;
			if (prop.enumTitles && !itemSchema.enumNames) {
				const titles = translateSchema(prop.enumTitles);
				if (titles && Array.isArray(titles)) {
					itemSchema.enumNames = titles;
				}
			}
		}

		const itemFormat = typeof prop.format === 'string' ? prop.format.trim() : '';
		if (itemFormat && !itemSchema.format) {
			const normalizedFormat = itemFormat.toLowerCase();
			if (normalizedFormat !== 'checkbox' && normalizedFormat !== 'string' && normalizedFormat !== 'textarea') {
				itemSchema.format = itemFormat;
			}
		}

		jsonSchema.items = itemSchema;
		const arrayDefault = getEffectiveDefaultValue(prop, 'array');
		if (arrayDefault === undefined) {
			jsonSchema.default = [];
		} else if (Array.isArray(arrayDefault)) {
			jsonSchema.default = arrayDefault;
		} else {
			jsonSchema.default = [arrayDefault];
		}
		return jsonSchema;
	}

	// Check if this is a definition reference (non-array)
	const defName = resolveDefinitionName(prop);
	if (defName && rootSchema) {
		const defEntry = getDefinitionEntry(rootSchema, defName);
		if (defEntry) {
			if (processing.has(defName)) {
				return { type: 'object', properties: {} };
			}
			processing.add(defName);
			const { schema: defSchema } = convertSchemaEntry(defEntry, { ...options, processing });
			processing.delete(defName);

			const defDefault = getEffectiveDefaultValue(prop, 'object');
			return {
				...defSchema,
				...(title !== undefined ? { title } : {}),
				...(description !== undefined ? { description } : {}),
				...(defDefault !== undefined ? { default: defDefault } : {}),
			};
		}

		// Fallback to $ref if definition is missing
		const defDefault = getEffectiveDefaultValue(prop, 'object');
		return { $ref: `#/definitions/${defName}`, title, description, ...(defDefault !== undefined ? { default: defDefault } : {}) };
	}

	// Set type
	jsonSchema.type = convertType(prop);
	if (prop.type === 'number' && isRecord(prop.params)) {
		const minimum = +prop.params.minimum;
		if (Number.isFinite(minimum)) {
			jsonSchema.minimum = minimum;
		}
		const maximum = +prop.params.maximum;
		if (Number.isFinite(maximum)) {
			jsonSchema.maximum = maximum;
		}
	}

	// Handle enums
	if (prop.enum && prop.enum.length > 0) {
		jsonSchema.enum = prop.enum;

		// Add enumNames for titles if available
		if (prop.enumTitles) {
			const titles = translateSchema(prop.enumTitles);
			if (titles && Array.isArray(titles)) {
				jsonSchema.enumNames = titles;
			}
		}
	}

	// Handle default values
	const effectiveDefault = getEffectiveDefaultValue(prop, jsonSchema.type);
	if (effectiveDefault !== undefined) {
		jsonSchema.default = effectiveDefault;
	}
	if (jsonSchema.default === undefined) {
		if (Array.isArray(jsonSchema.enum) && jsonSchema.enum.length > 0) {
			jsonSchema.default = jsonSchema.enum[0];
		} else {
			const formatRaw = typeof prop.format === 'string' ? prop.format.trim().toLowerCase() : '';
			const typeRaw = typeof prop.type === 'string' ? prop.type.trim().toLowerCase() : '';
			const isNumberString = formatRaw === 'string' && (typeRaw === 'number' || typeRaw === 'integer');
			if (isNumberString) {
				jsonSchema.default = '0';
			} else {
				// Set sensible defaults
				switch (jsonSchema.type) {
					case 'number':
						jsonSchema.default = 0;
						break;
					case 'boolean':
						jsonSchema.default = false;
						break;
					case 'string':
						jsonSchema.default = '';
						break;
					case 'array':
						jsonSchema.default = [];
						break;
					case 'object':
						jsonSchema.default = {};
						break;
				}
			}
		}
	}

	// Handle color format
	if (prop.type === 'color') {
		jsonSchema.format = 'color';
	}

	// Handle format
	if (prop.format) {
		const rawFormat = typeof prop.format === 'string' ? prop.format.trim() : '';
		const normalizedFormat = rawFormat.toLowerCase();
		// Don't override color format or apply UI-only formats.
		if (normalizedFormat && normalizedFormat !== 'color' && normalizedFormat !== 'string' && normalizedFormat !== 'textarea' && !jsonSchema.format) {
			jsonSchema.format = rawFormat;
		}
	}

	return jsonSchema;
}

/**
 * Convert a single ICgEventsSchemaProperty to UI Schema property
 */
function convertPropertyUiSchema(
	prop: ICgEventsSchemaProperty,
	options: SchemaConverterOptions
): UiSchema {
	const { rootSchema, processing = new Set<string>() } = options;
	const useGridLayout = options.useGridLayout === true;
	const format = typeof prop.format === 'string' ? prop.format.trim().toLowerCase() : '';
	const hasEnum = Array.isArray(prop.enum) && prop.enum.length > 0;
	const isArray = prop.type === 'array' || prop.collection === 'array' || prop.multiple || prop.arrayItem || prop.items;
	const resolvedDefName = resolveDefinitionName(prop);
	const isDefinitionArray = isArray && resolvedDefName !== null;
	const wantsCheckboxList = isArray && (format === 'checkbox' || (!!prop.uniqueItems && hasEnum));
	const resolvedType = convertType(prop);
	let defUiSchema: UiSchema | undefined;
	let defGridOptions: string[] | undefined;
	let arrayItemDefGridOptions: string[] | undefined;
	let defHasSingleField = false;
	let arrayItemDefHasSingleField = false;

	// If this property references a definition, seed UI schema from that definition (non-array only)
	const defName = !isArray ? resolvedDefName : null;
	if (defName) {
		const defEntry = getDefinitionEntry(rootSchema, defName);
		if (defEntry && !processing.has(defName)) {
			defGridOptions = Array.isArray(defEntry.gridOptions) ? defEntry.gridOptions : undefined;
			processing.add(defName);
			defUiSchema = convertSchemaEntry(defEntry, { ...options, processing }).uiSchema;
			const order = defUiSchema['ui:order'];
			defHasSingleField = Array.isArray(order) && order.length === 1;
			processing.delete(defName);
		}
	}

	const uiSchema: UiSchema = defUiSchema ? { ...defUiSchema } : {};

	// Check if label is empty string - if so, hide the label
	const title = getLocalizedFromProp(prop, ['label', 'locale']);
	if (title === '') {
		// Empty label means intentionally hide the label
		uiSchema['ui:label'] = false;
	}

	// Handle arrays early so that item UI schemas are attached
	if (isArray) {
		let itemUiSchema: UiSchema | undefined;
		const itemDefName = resolvedDefName;

		if (itemDefName) {
			const defEntry = getDefinitionEntry(rootSchema, itemDefName);
			if (defEntry && !processing.has(itemDefName)) {
				arrayItemDefGridOptions = Array.isArray(defEntry.gridOptions) ? defEntry.gridOptions : undefined;
				processing.add(itemDefName);
				itemUiSchema = convertSchemaEntry(defEntry, { ...options, processing }).uiSchema;
				const order = itemUiSchema['ui:order'];
				arrayItemDefHasSingleField = Array.isArray(order) && order.length === 1;
				processing.delete(itemDefName);
			}
		}

		const hasArrayHelper = !!prop.helper || isHelperFormat(prop.format);
		if (hasArrayHelper) {
			uiSchema['ui:options'] = {
				...(uiSchema['ui:options'] || {}),
				helper: prop.helper,
				format: prop.format,
				editorOptions: prop.editorOptions,
			};
		}

		if (prop.items && typeof prop.items === 'object') {
			// Array items always behave like "grid mode", so item grid params are effective by default.
			const itemOverride = convertPropertyUiSchema(
				prop.items,
				options.useGridLayout === true ? options : { ...options, useGridLayout: true }
			);
			if (itemUiSchema) {
				const merged: UiSchema = { ...itemUiSchema, ...itemOverride };
				const baseOptions = isRecord(itemUiSchema['ui:options']) ? itemUiSchema['ui:options'] : undefined;
				const overrideOptions = isRecord(itemOverride['ui:options']) ? itemOverride['ui:options'] : undefined;
				if (baseOptions || overrideOptions) {
					merged['ui:options'] = { ...(baseOptions || {}), ...(overrideOptions || {}) };
				}
				const baseOrder = itemUiSchema['ui:order'];
				const overrideOrder = itemOverride['ui:order'];
				if (Array.isArray(baseOrder) && (!Array.isArray(overrideOrder) || overrideOrder.length === 0)) {
					merged['ui:order'] = baseOrder;
				}
				itemUiSchema = merged;
			} else {
				itemUiSchema = itemOverride;
			}
		}

		if (itemUiSchema) {
			uiSchema.items = itemUiSchema;
		}
	}

	// Handle color type
	if (prop.type === 'color') {
		uiSchema['ui:widget'] = 'color';
	}

	// Handle format-based widgets
	if (format) {
		const isCheckboxFormat = format === 'checkbox';
		const formatTargetsItems = isArray && !isCheckboxFormat && !wantsCheckboxList;
		let formatTarget: UiSchema = uiSchema;

		if (formatTargetsItems) {
			const existingItemUiSchema = uiSchema.items && typeof uiSchema.items === 'object' && !Array.isArray(uiSchema.items)
				? uiSchema.items
				: undefined;
			if (existingItemUiSchema) {
				formatTarget = existingItemUiSchema;
			} else {
				const nextItemUiSchema: UiSchema = {};
				uiSchema.items = nextItemUiSchema;
				formatTarget = nextItemUiSchema;
			}
		}

		if (format === 'textarea') {
			formatTarget['ui:widget'] = 'textarea';
		} else if (format === 'json') {
			formatTarget['ui:widget'] = 'json';
		} else if (format === 'color') {
			formatTarget['ui:widget'] = 'color';
		} else if (format === 'enum' && !wantsCheckboxList) {
			formatTarget['ui:widget'] = 'select';
		}
	}

	if (wantsCheckboxList) {
		uiSchema['ui:widget'] = 'CheckboxList';
		uiSchema['ui:label'] = false;
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			showLabel: true,
		};
		// Pass params (groupBy, invertSelection) to ui:options
		if (prop.params && typeof prop.params === 'object' && !Array.isArray(prop.params)) {
			uiSchema['ui:options'] = {
				...(uiSchema['ui:options'] || {}),
				groupBy: prop.params.groupBy,
				invertSelection: prop.params.invertSelection,
			};
		}
	}

	// Handle helper format (for custom helper widgets/fields)
	const hasHelper = !!prop.helper || isHelperFormat(prop.format);
	if (!isArray && hasHelper) {
		if (resolvedType === 'object') {
			// For objects, keep the normal object rendering and let the ObjectFieldTemplate render the helper action.
			uiSchema['ui:options'] = {
				...(uiSchema['ui:options'] || {}),
				helper: prop.helper,
				format: prop.format,
				editorOptions: prop.editorOptions,
			};
		} else {
			uiSchema['ui:widget'] = 'helper';
			uiSchema['ui:options'] = {
				...(uiSchema['ui:options'] || {}),
				helper: prop.helper,
				format: prop.format,
				editorOptions: prop.editorOptions,
			};
		}
	}

	// Handle enum display names
	if (prop.enum && prop.enum.length > 0 && prop.enumTitles) {
		const titles = translateSchema(prop.enumTitles);
		if (titles && Array.isArray(titles)) {
			uiSchema['ui:enumNames'] = titles;
		}
	}

	// Handle suggestions
	const isEnumFormat = format === 'enum';
	const safeSuggestTitles = prop.suggestTitles && typeof prop.suggestTitles === 'object' && !Array.isArray(prop.suggestTitles)
		? prop.suggestTitles
		: undefined;
	if (prop.suggest && prop.suggest.length > 0) {
		const suggestionWidget = isEnumFormat ? 'select' : 'datalist';
		// Don't apply a widget at the array level, otherwise RJSF treats it as a custom widget and hides array controls.
		if (isArray) {
			const existingItemUiSchema = uiSchema.items && typeof uiSchema.items === 'object' && !Array.isArray(uiSchema.items)
				? uiSchema.items
				: undefined;
			const existingItemOptionsRaw = existingItemUiSchema?.['ui:options'];
			const existingItemOptions = existingItemOptionsRaw && typeof existingItemOptionsRaw === 'object' && !Array.isArray(existingItemOptionsRaw)
				? existingItemOptionsRaw
				: {};
			uiSchema.items = {
				...(existingItemUiSchema || {}),
				'ui:widget': suggestionWidget,
				'ui:options': {
					...existingItemOptions,
					suggestions: prop.suggest,
					suggestTitles: safeSuggestTitles,
					suggestFilter: prop.suggestFilter,
				},
			};
		} else {
			uiSchema['ui:widget'] = suggestionWidget;
			uiSchema['ui:options'] = {
				...(uiSchema['ui:options'] || {}),
				suggestions: prop.suggest,
				suggestTitles: safeSuggestTitles,
				suggestFilter: prop.suggestFilter,
			};
		}
	}

	// Handle unit (for display on right side of input)
	if (prop.unit && typeof prop.unit === 'object') {
		const unitText = getLocalizedText(prop.unit);
		if (unitText) {
			uiSchema['ui:options'] = {
				...(uiSchema['ui:options'] || {}),
				unit: unitText,
			};
		}
	}

	// Handle grid layout using Bootstrap col classes
	// Default to full width if not specified
	const gridColumns = useGridLayout ? prop.gridColumns : undefined;
	const colSize = Number.isFinite(gridColumns) && Number(gridColumns) > 0
		? Math.min(12, Math.max(1, Number(gridColumns)))
		: 12;
	uiSchema['ui:options'] = {
		...(uiSchema['ui:options'] || {}),
		colClass: getResponsiveGridClasses(colSize),
	};

	// Handle grid options
	const hasOneRow = (prop.gridOptions?.includes('oneRow') || defGridOptions?.includes('oneRow') || defHasSingleField) === true;
	const hasFullWidth = (prop.gridOptions?.includes('fullwidth') || defGridOptions?.includes('fullwidth')) === true;
	const hasNoHeader = (prop.gridOptions?.includes('noHeader') || defGridOptions?.includes('noHeader')) === true;
	const enableGridOptions = useGridLayout;
	const effectiveOneRow = enableGridOptions && hasOneRow;
	const effectiveFullWidth = enableGridOptions && hasFullWidth;
	const effectiveNoHeader = enableGridOptions && hasNoHeader;

	const classNames: string[] = [];
	if (effectiveOneRow) {
		classNames.push('cgenh-config-field--inline');
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			oneRow: true,
		};
	}
	if (effectiveFullWidth) {
		classNames.push('cgenh-config-field--fullwidth');
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			colClass: getResponsiveGridClasses(12),
		};
	}
	if (effectiveNoHeader) {
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			noHeader: true,
		};
	}
	if (classNames.length > 0) {
		const existingClassNames = typeof uiSchema['ui:classNames'] === 'string' ? uiSchema['ui:classNames'] : '';
		uiSchema['ui:classNames'] = existingClassNames ? `${existingClassNames} ${classNames.join(' ')}` : classNames.join(' ');
	}

	// Definition arrays: apply the definition's own gridOptions to each item.
	const defArrayItemHasOneRow = arrayItemDefGridOptions?.includes('oneRow') === true || arrayItemDefHasSingleField;
	const defArrayItemHasNoHeader = arrayItemDefGridOptions?.includes('noHeader') === true;
	const defArrayItemHasFullWidth = arrayItemDefGridOptions?.includes('fullwidth') === true;

	if (isDefinitionArray && (defArrayItemHasOneRow || defArrayItemHasNoHeader || defArrayItemHasFullWidth)) {
		const rawItems = uiSchema.items;
		const itemsUiSchema: UiSchema = isRecord(rawItems) ? rawItems : {};
		if (!isRecord(rawItems)) {
			uiSchema.items = itemsUiSchema;
		}

		const rawItemOptions = itemsUiSchema['ui:options'];
		const itemOptions = isRecord(rawItemOptions) ? rawItemOptions : {};
		if (defArrayItemHasOneRow) {
			itemOptions.oneRow = true;
		}
		if (defArrayItemHasNoHeader) {
			itemOptions.noHeader = true;
		}
		if (defArrayItemHasFullWidth) {
			itemOptions.colClass = getResponsiveGridClasses(12);
		}
		itemsUiSchema['ui:options'] = itemOptions;
	}

	// Handle indent
	if (prop.indent && prop.indent > 0) {
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			indent: prop.indent,
		};
	}

	// Handle visibility condition
	if (prop.visible !== undefined) {
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			visible: prop.visible,
		};
	}

	if (prop.collapsed !== undefined) {
		const collapsed = !!prop.collapsed;
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			collapsible: true,
			collapsed,
		};
	}

	if (!isArray && resolvedType === 'string') {
		const rawOptions = uiSchema['ui:options'];
		const uiOptions = isRecord(rawOptions) ? rawOptions : {};
		if (uiOptions.emptyValue === undefined) {
			uiOptions.emptyValue = '';
		}
		uiSchema['ui:options'] = uiOptions;
	}

	if (isArray) {
		let itemType: JSONSchema7TypeName | undefined;
		if (prop.items && typeof prop.items === 'object') {
			itemType = convertType(prop.items);
		} else if (typeof prop.arrayItem === 'string') {
			const arrayItemType = prop.arrayItem.trim().toLowerCase();
			if (arrayItemType === 'string') {
				itemType = 'string';
			} else if (arrayItemType === 'number') {
				itemType = 'number';
			} else if (arrayItemType === 'integer' || arrayItemType === 'int') {
				itemType = 'integer';
			} else if (arrayItemType === 'boolean') {
				itemType = 'boolean';
			} else if (arrayItemType === 'object' || arrayItemType === 'json') {
				itemType = 'object';
			} else if (arrayItemType === 'array') {
				itemType = 'array';
			}
		} else if (prop.type && prop.type !== 'array') {
			itemType = convertType(prop);
		}

		if (itemType === 'string') {
			const rawItemSchema = uiSchema.items;
			if (!rawItemSchema || isRecord(rawItemSchema)) {
				const itemUiSchema = isRecord(rawItemSchema) ? rawItemSchema : {};
				const rawItemOptions = itemUiSchema['ui:options'];
				const itemOptions = isRecord(rawItemOptions) ? rawItemOptions : {};
				if (itemOptions.emptyValue === undefined) {
					itemOptions.emptyValue = '';
				}
				itemUiSchema['ui:options'] = itemOptions;
				uiSchema.items = itemUiSchema;
			}
		}
	}

	return uiSchema;
}

/**
 * Convert ICgEventsSchemaEntry to JSON Schema and UI Schema
 */
export function convertSchemaEntry(
	entry: ICgEventsSchemaEntry,
	options: SchemaConverterOptions
): ConvertedSchema {
	const schema: RJSFSchema = {
		type: 'object',
		properties: {},
		definitions: {},
	};
	const entryTitle = getLocalizedText(entry.label);
	const entryDescription = getLocalizedText(entry.description);
	// Only set title if non-empty (empty string means intentionally hide label)
	if (entryTitle) {
		schema.title = entryTitle;
	}
	if (entryDescription !== undefined) {
		schema.description = entryDescription;
	}

	const uiSchema: UiSchema = {
		'ui:order': [],
	};
	const required: string[] = [];
	// If entry title is empty string, hide the label
	if (entryTitle === '') {
		uiSchema['ui:label'] = false;
	}

	const entryUsesGridLayout = typeof entry.format === 'string' && entry.format.trim().toLowerCase() === 'grid';
	const entryOptions: SchemaConverterOptions = {
		...options,
		useGridLayout: entryUsesGridLayout,
	};

	const normalizedProperties = dedupeSchemaProperties(entry.properties);

	// Build parent-children relationships
	const childrenMap: Record<string, ICgEventsSchemaProperty[]> = {};
	const parentKeys = new Set<string>();

	for (const prop of normalizedProperties) {
		if (prop && prop.parent) {
			const parentKey = prop.parent;
			if (!childrenMap[parentKey]) {
				childrenMap[parentKey] = [];
			}
			childrenMap[parentKey].push(prop);
			parentKeys.add(parentKey);
		}
	}

		// Convert properties
	for (const prop of normalizedProperties) {
		if (!prop || !prop.key) {
			continue;
		}

		// Skip child properties (they'll be nested)
		if (prop.parent) {
			continue;
		}

		const key = prop.key;
		const isRequired = !!prop.required;
		if (isRequired) {
			required.push(key);
		}

		// Check if this property has children (is a parent)
		if (childrenMap[key]) {
			const parentIsArray = prop.type === 'array' || prop.collection === 'array' || prop.multiple || prop.arrayItem || prop.items;
			const nestedUsesGridLayout = typeof prop.format === 'string' && prop.format.trim().toLowerCase() === 'grid';
			const nestedChildOptions: SchemaConverterOptions = {
				...options,
				useGridLayout: parentIsArray ? true : nestedUsesGridLayout,
			};

			// Create nested object schema for either an object field or the array item schema
			const nestedSchema: RJSFSchema = {
				type: 'object',
				properties: {},
			};
			const nestedUiSchema: UiSchema = {
				'ui:order': [],
			};

			const nestedRequired: string[] = [];
			for (const child of childrenMap[key]) {
				if (!child.key) {
					continue;
				}

				const childRequired = !!child.required;
				if (childRequired) {
					nestedRequired.push(child.key);
				}
				const childSchema = convertProperty(child, options);
				if (childRequired && childSchema.type === 'string' && childSchema.minLength === undefined) {
					childSchema.minLength = 1;
				}
				nestedSchema.properties![child.key] = childSchema;
				nestedUiSchema[child.key] = convertPropertyUiSchema(child, nestedChildOptions);
				nestedUiSchema['ui:order'].push(child.key);
			}
			if (nestedRequired.length > 0) {
				nestedSchema.required = nestedRequired;
			}

			// Apply grid layout to nested object only if the object itself is marked as grid
			const nestedClassNames: string[] = [];
			if (nestedUsesGridLayout) {
				nestedClassNames.push('grid');
			}

			if (parentIsArray) {
				if (nestedClassNames.length > 0) {
					nestedUiSchema['ui:classNames'] = nestedClassNames.join(' ');
				}

				const arraySchema = convertProperty(prop, options);
				arraySchema.type = 'array';
				arraySchema.items = nestedSchema;
				schema.properties![key] = arraySchema;

				const parentUiSchema = convertPropertyUiSchema(prop, entryOptions);
				parentUiSchema.items = nestedUiSchema;
				uiSchema[key] = parentUiSchema;
			} else {
				const hasParentHelper = !!prop.helper || isHelperFormat(prop.format);
				if (hasParentHelper) {
					const rawNestedOptions = nestedUiSchema['ui:options'];
					const nestedOptions = isRecord(rawNestedOptions) ? rawNestedOptions : {};
					nestedUiSchema['ui:options'] = {
						...nestedOptions,
						helper: prop.helper,
						format: prop.format,
						editorOptions: prop.editorOptions,
					};
				}
				// Apply title and description from parent
				const title = getLocalizedText(prop.label);
				const description = getLocalizedText(prop.description);
				if (title) {
					nestedSchema.title = title;
				} else if (title === '') {
					// Empty label means intentionally hide the label
					nestedUiSchema['ui:label'] = false;
				}
				if (description) {
					nestedSchema.description = description;
				}

				// Apply gridColumns to this object itself only when the parent uses grid layout
				const parentGridColumns = entryUsesGridLayout ? prop.gridColumns : undefined;
				const parentColSize = Number.isFinite(parentGridColumns) && Number(parentGridColumns) > 0
					? Math.min(12, Math.max(1, Number(parentGridColumns)))
					: 12;
				nestedUiSchema['ui:options'] = {
					...(nestedUiSchema['ui:options'] || {}),
					colClass: getResponsiveGridClasses(parentColSize),
				};

				// Apply object's gridOptions only when the parent uses grid layout
				if (entryUsesGridLayout && prop.gridOptions && prop.gridOptions.length > 0) {
					if (prop.gridOptions.includes('fullwidth')) {
						nestedClassNames.push('cgenh-config-field--fullwidth');
					}
					if (prop.gridOptions.includes('oneRow')) {
						nestedClassNames.push('cgenh-config-field--inline');
						nestedUiSchema['ui:options'] = {
							...(nestedUiSchema['ui:options'] || {}),
							oneRow: true,
						};
					}
					if (prop.gridOptions.includes('noHeader')) {
						nestedUiSchema['ui:options'] = {
							...(nestedUiSchema['ui:options'] || {}),
							noHeader: true,
						};
					}
				}

				// Apply fullwidth grid column if specified (grid mode only)
				if (entryUsesGridLayout && prop.gridOptions?.includes('fullwidth')) {
					nestedUiSchema['ui:options'] = {
						...(nestedUiSchema['ui:options'] || {}),
						colClass: getResponsiveGridClasses(12),
					};
				}
				if (prop.collapsed !== undefined) {
					const collapsed = !!prop.collapsed;
					nestedUiSchema['ui:options'] = {
						...(nestedUiSchema['ui:options'] || {}),
						collapsible: true,
						collapsed,
					};
				}

				// Apply parent's indent/visible to the object container (not only children)
				if (prop.indent && prop.indent > 0) {
					nestedUiSchema['ui:options'] = {
						...(nestedUiSchema['ui:options'] || {}),
						indent: prop.indent,
					};
				}
				if (prop.visible !== undefined) {
					nestedUiSchema['ui:options'] = {
						...(nestedUiSchema['ui:options'] || {}),
						visible: prop.visible,
					};
				}

				if (nestedClassNames.length > 0) {
					nestedUiSchema['ui:classNames'] = nestedClassNames.join(' ');
				}

				schema.properties![key] = nestedSchema;
				uiSchema[key] = nestedUiSchema;
			}
		} else {
			const propSchema = convertProperty(prop, options);
			if (isRequired && propSchema.type === 'string' && propSchema.minLength === undefined) {
				propSchema.minLength = 1;
			}
			schema.properties![key] = propSchema;
			uiSchema[key] = convertPropertyUiSchema(prop, entryOptions);
		}

		uiSchema['ui:order'].push(key);
	}

	// Handle grid format
	if (entry.format === 'grid') {
		uiSchema['ui:classNames'] = 'cgenh-configs-panel__grid cgenh-configs-panel__grid--12';
	}
	if (required.length > 0) {
		schema.required = required;
	}

	const entryHelper = typeof entry.helper === 'string' ? entry.helper : undefined;
	const entryFormatRaw = typeof entry.format === 'string' ? entry.format.trim() : '';
	const hasEntryHelperFormat = isHelperFormat(entryFormatRaw);
	if (entryHelper || hasEntryHelperFormat) {
		const rawOptions = uiSchema['ui:options'];
		const options = isRecord(rawOptions) ? rawOptions : {};
		uiSchema['ui:options'] = {
			...options,
			...(entryHelper ? { helper: entryHelper } : {}),
			...(hasEntryHelperFormat ? { format: entryFormatRaw } : {}),
			...(entry.editorOptions !== undefined ? { editorOptions: entry.editorOptions } : {}),
		};
	}

	return { schema, uiSchema };
}

/**
 * Convert full ICgEventsSchema to include all definitions
 */
export function convertFullSchema(
	cgSchema: ICgEventsSchema,
	entryKey: string,
	entryType: 'action' | 'trigger' | 'check' | 'definition'
): ConvertedSchema {
	const defCache = new Map<string, RJSFSchema>();
	const processing = new Set<string>();
	// Get the target entry
	let entry: ICgEventsSchemaEntry | undefined;
	switch (entryType) {
		case 'action':
			entry = cgSchema.action?.[entryKey];
			break;
		case 'trigger':
			entry = cgSchema.trigger?.[entryKey];
			break;
		case 'check':
			entry = cgSchema.check?.[entryKey];
			break;
		case 'definition':
			entry = cgSchema.definition?.[entryKey];
			break;
	}

	// Fallback to definition if not found
	if (!entry && entryType !== 'definition') {
		entry = cgSchema.definition?.[entryKey];
	}

	if (!entry) {
		return {
			schema: { type: 'object', properties: {} },
			uiSchema: {},
		};
	}

	const options: SchemaConverterOptions = {
		rootSchema: cgSchema,
		defCache,
		processing,
	};

	const { schema, uiSchema } = convertSchemaEntry(entry, options);

	// Add all definitions to the schema
	schema.definitions = {};
	if (cgSchema.definition) {
		for (const [defKey, defEntry] of Object.entries(cgSchema.definition)) {
			const { schema: defSchema } = convertSchemaEntry(defEntry, options);
			schema.definitions[defKey] = defSchema;
		}
	}
	return { schema, uiSchema };
}

/**
 * Create a simple schema for an unknown entry (no schema available)
 */
export function createFallbackSchema(data: Record<string, any>): ConvertedSchema {
	const schema: RJSFSchema = {
		type: 'object',
		properties: {},
	};
	const uiSchema: UiSchema = {};

	for (const key of Object.keys(data)) {
		const value = data[key];
		let type: JSONSchema7TypeName = 'string';

		if (typeof value === 'number') {
			type = 'number';
		} else if (typeof value === 'boolean') {
			type = 'boolean';
		} else if (Array.isArray(value)) {
			type = 'array';
		} else if (value && typeof value === 'object') {
			type = 'object';
		}

		schema.properties![key] = { type, title: key };
	}

	return { schema, uiSchema };
}

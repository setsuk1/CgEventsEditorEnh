import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { ICgEventsSchema, ICgEventsSchemaEntry, ICgEventsSchemaProperty, translateSchema } from '@shared';
import { JSONSchema7TypeName } from 'json-schema';
import { dedupeSchemaProperties } from '../helpers/schemaPropertyHelper';
import { createSafeRecord } from '../utils/safeRecord';
import {
	convertSchemaPropertyType,
	getEffectiveDefaultValue,
	getLocalizedFromProp,
	getLocalizedText,
	resolveDefinitionName,
	normalizeSchemaFormat,
	resolveExplicitArrayItemPolicy,
} from './schemaConverterValues';
import { resolveSchemaGridLayout } from './schemaConverterLayout';
import { isHelperFormat, isRecord } from './utils/rjsfUtils';

function isStaticUiSchema(value: unknown): value is UiSchema {
	return isRecord(value);
}

export interface ConvertedSchema {
	schema: RJSFSchema;
	uiSchema: UiSchema;
}

export interface SchemaConverterOptions {
	rootSchema?: ICgEventsSchema;
	processing?: Set<string>;
	useGridLayout?: boolean;
}


function getOwnSchemaEntry(
	category: Record<string, ICgEventsSchemaEntry> | undefined,
	key: string,
): ICgEventsSchemaEntry | undefined {
	if (!category || !Object.hasOwn(category, key)) return undefined;
	return category[key];
}

function getDefinitionEntry(rootSchema: ICgEventsSchema | undefined, defName: string): ICgEventsSchemaEntry | undefined {
	if (!rootSchema) {
		return undefined;
	}

	return getOwnSchemaEntry(rootSchema.definition, defName);
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
	const isArray = isArrayProperty(prop);
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
			itemSchema = getDefinitionEntry(rootSchema, itemDefName)
				? { $ref: `#/definitions/${itemDefName}` }
				: { type: 'object', properties: {} };
		} else if (prop.items && typeof prop.items === 'object') {
			itemSchema = convertProperty(prop.items, options);
		} else if (typeof prop.arrayItem === 'string') {
			const explicitItem = resolveExplicitArrayItemPolicy(prop.arrayItem);
			if (explicitItem) {
				itemSchema = { type: explicitItem.type, default: explicitItem.defaultValue };
			}
		} else if (prop.type) {
			// For collection/multiple arrays where `type` describes the item type
			const itemType = convertSchemaPropertyType(prop);
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
			const normalizedFormat = normalizeSchemaFormat(itemFormat);
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
	jsonSchema.type = convertSchemaPropertyType(prop);
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
			const formatRaw = normalizeSchemaFormat(prop.format);
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
		const normalizedFormat = normalizeSchemaFormat(rawFormat);
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
	const format = normalizeSchemaFormat(prop.format);
	const hasEnum = Array.isArray(prop.enum) && prop.enum.length > 0;
	const isArray = isArrayProperty(prop);
	const resolvedDefName = resolveDefinitionName(prop);
	const isDefinitionArray = isArray && resolvedDefName !== null;
	const wantsCheckboxList = isArray && (format === 'checkbox' || (!!prop.uniqueItems && hasEnum));
	const resolvedType = convertSchemaPropertyType(prop);
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

	const gridLayout = resolveSchemaGridLayout({
		useGridLayout,
		gridColumns: prop.gridColumns,
		gridOptions: prop.gridOptions,
		inheritedGridOptions: defGridOptions,
		inheritedHasSingleField: defHasSingleField,
	});
	uiSchema['ui:options'] = {
		...(uiSchema['ui:options'] || {}),
		colClass: gridLayout.colClass,
	};

	const classNames: string[] = [];
	if (gridLayout.oneRow) {
		classNames.push('cgenh-config-field--inline');
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			oneRow: true,
		};
	}
	if (gridLayout.fullWidth) {
		classNames.push('cgenh-config-field--fullwidth');
	}
	if (gridLayout.noHeader) {
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
	const definitionArrayGridLayout = resolveSchemaGridLayout({
		useGridLayout: true,
		gridOptions: arrayItemDefGridOptions,
		inheritedHasSingleField: arrayItemDefHasSingleField,
	});

	if (
		isDefinitionArray
		&& (definitionArrayGridLayout.oneRow || definitionArrayGridLayout.noHeader || definitionArrayGridLayout.fullWidth)
	) {
		const rawItems = uiSchema.items;
		const itemsUiSchema: UiSchema = isStaticUiSchema(rawItems) ? rawItems : {};
		if (!isStaticUiSchema(rawItems)) {
			uiSchema.items = itemsUiSchema;
		}

		const rawItemOptions = itemsUiSchema['ui:options'];
		const itemOptions = isRecord(rawItemOptions) ? rawItemOptions : {};
		if (definitionArrayGridLayout.oneRow) {
			itemOptions.oneRow = true;
		}
		if (definitionArrayGridLayout.noHeader) {
			itemOptions.noHeader = true;
		}
		if (definitionArrayGridLayout.fullWidth) {
			itemOptions.colClass = definitionArrayGridLayout.colClass;
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
		uiSchema['ui:options'] = {
			...(uiSchema['ui:options'] || {}),
			collapsed: !!prop.collapsed,
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
			itemType = convertSchemaPropertyType(prop.items);
		} else if (typeof prop.arrayItem === 'string') {
			itemType = resolveExplicitArrayItemPolicy(prop.arrayItem)?.type;
		} else if (prop.type && prop.type !== 'array') {
			itemType = convertSchemaPropertyType(prop);
		}

		if (itemType === 'string') {
			const rawItemSchema = uiSchema.items;
			if (!rawItemSchema || isStaticUiSchema(rawItemSchema)) {
				const itemUiSchema: UiSchema = isStaticUiSchema(rawItemSchema) ? rawItemSchema : {};
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


interface ConvertedPropertyNode {
	schema: RJSFSchema;
	uiSchema: UiSchema;
}

function isArrayProperty(prop: ICgEventsSchemaProperty): boolean {
	return prop.type === 'array'
		|| prop.collection === 'array'
		|| !!prop.multiple
		|| !!prop.arrayItem
		|| !!prop.items;
}

function convertPropertyTree(
	prop: ICgEventsSchemaProperty,
	childrenMap: Record<string, ICgEventsSchemaProperty[]>,
	options: SchemaConverterOptions,
	containerOptions: SchemaConverterOptions,
): ConvertedPropertyNode {
	const children = childrenMap[prop.key];
	const isRequired = !!prop.required;
	if (!children || children.length === 0) {
		const propSchema = convertProperty(prop, options);
		if (isRequired && propSchema.type === 'string' && propSchema.minLength === undefined) {
			propSchema.minLength = 1;
		}
		return {
			schema: propSchema,
			uiSchema: convertPropertyUiSchema(prop, containerOptions),
		};
	}

	const parentIsArray = isArrayProperty(prop);
	const nestedUsesGridLayout = normalizeSchemaFormat(prop.format) === 'grid';
	const nestedChildOptions: SchemaConverterOptions = {
		...options,
		useGridLayout: parentIsArray ? true : nestedUsesGridLayout,
	};
	const nestedSchema: RJSFSchema = {
		type: 'object',
		properties: createSafeRecord<RJSFSchema>(),
	};
	const nestedUiSchema = createSafeRecord<any>() as UiSchema;
	nestedUiSchema['ui:order'] = [];
	const nestedRequired: string[] = [];

	for (const child of children) {
		if (!child?.key) {
			continue;
		}
		if (child.required) {
			nestedRequired.push(child.key);
		}
		const convertedChild = convertPropertyTree(
			child,
			childrenMap,
			options,
			nestedChildOptions,
		);
		nestedSchema.properties![child.key] = convertedChild.schema;
		nestedUiSchema[child.key] = convertedChild.uiSchema;
		nestedUiSchema['ui:order'].push(child.key);
	}
	if (nestedRequired.length > 0) {
		nestedSchema.required = nestedRequired;
	}

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
		const parentUiSchema = convertPropertyUiSchema(prop, containerOptions);
		parentUiSchema.items = nestedUiSchema;
		return { schema: arraySchema, uiSchema: parentUiSchema };
	}

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

	const title = getLocalizedText(prop.label);
	const description = getLocalizedText(prop.description);
	if (title) {
		nestedSchema.title = title;
	} else if (title === '') {
		nestedUiSchema['ui:label'] = false;
	}
	if (description) {
		nestedSchema.description = description;
	}

	const nestedGridLayout = resolveSchemaGridLayout({
		useGridLayout: containerOptions.useGridLayout === true,
		gridColumns: prop.gridColumns,
		gridOptions: prop.gridOptions,
	});
	nestedUiSchema['ui:options'] = {
		...(nestedUiSchema['ui:options'] || {}),
		colClass: nestedGridLayout.colClass,
	};

	if (nestedGridLayout.fullWidth) {
		nestedClassNames.push('cgenh-config-field--fullwidth');
	}
	if (nestedGridLayout.oneRow) {
		nestedClassNames.push('cgenh-config-field--inline');
		nestedUiSchema['ui:options'] = {
			...(nestedUiSchema['ui:options'] || {}),
			oneRow: true,
		};
	}
	if (nestedGridLayout.noHeader) {
		nestedUiSchema['ui:options'] = {
			...(nestedUiSchema['ui:options'] || {}),
			noHeader: true,
		};
	}
	if (prop.collapsed !== undefined) {
		nestedUiSchema['ui:options'] = {
			...(nestedUiSchema['ui:options'] || {}),
			collapsed: !!prop.collapsed,
		};
	}
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

	return { schema: nestedSchema, uiSchema: nestedUiSchema };
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
		properties: createSafeRecord<RJSFSchema>(),
		definitions: createSafeRecord<RJSFSchema>(),
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

	const uiSchema = createSafeRecord<any>() as UiSchema;
	uiSchema['ui:order'] = [];
	const required: string[] = [];
	// If entry title is empty string, hide the label
	if (entryTitle === '') {
		uiSchema['ui:label'] = false;
	}

	const entryUsesGridLayout = normalizeSchemaFormat(entry.format) === 'grid';
	const entryOptions: SchemaConverterOptions = {
		...options,
		useGridLayout: entryUsesGridLayout,
	};

	const normalizedProperties = dedupeSchemaProperties(entry.properties);

	// Build parent-children relationships
	const childrenMap: Record<string, ICgEventsSchemaProperty[]> = Object.create(null);
	for (const prop of normalizedProperties) {
		if (!prop?.parent) {
			continue;
		}
		const parentKey = prop.parent;
		(childrenMap[parentKey] ??= []).push(prop);
	}

	// Convert each root property. Child properties are handled recursively.
	for (const prop of normalizedProperties) {
		if (!prop?.key || prop.parent) {
			continue;
		}
		if (prop.required) {
			required.push(prop.key);
		}
		const converted = convertPropertyTree(
			prop,
			childrenMap,
			options,
			entryOptions,
		);
		schema.properties![prop.key] = converted.schema;
		uiSchema[prop.key] = converted.uiSchema;
		uiSchema['ui:order'].push(prop.key);
	}

	// Handle grid format
	if (entryUsesGridLayout) {
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
	const processing = new Set<string>();
	// Get the target entry
	let entry: ICgEventsSchemaEntry | undefined;
	switch (entryType) {
		case 'action':
			entry = getOwnSchemaEntry(cgSchema.action, entryKey);
			break;
		case 'trigger':
			entry = getOwnSchemaEntry(cgSchema.trigger, entryKey);
			break;
		case 'check':
			entry = getOwnSchemaEntry(cgSchema.check, entryKey);
			break;
		case 'definition':
			entry = getOwnSchemaEntry(cgSchema.definition, entryKey);
			break;
	}

	// Fallback to definition if not found
	if (!entry && entryType !== 'definition') {
		entry = getOwnSchemaEntry(cgSchema.definition, entryKey);
	}

	if (!entry) {
		return {
			schema: { type: 'object', properties: {} },
			uiSchema: {},
		};
	}

	const options: SchemaConverterOptions = {
		rootSchema: cgSchema,
		processing,
	};

	const { schema, uiSchema } = convertSchemaEntry(entry, options);

	// Add all definitions to the schema
	schema.definitions = createSafeRecord<RJSFSchema>();
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
		properties: createSafeRecord<RJSFSchema>(),
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

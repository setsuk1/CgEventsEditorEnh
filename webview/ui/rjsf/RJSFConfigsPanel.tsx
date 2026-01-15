import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType, RegistryWidgetsType, RJSFSchema, TemplatesType, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { getSelectedLanguage, ICgEventsSchema, ObjectUtil } from '@shared';
import React from 'react';
import { playMouseDownAudio, playMouseHoverAudio } from '../../helper/sound';
import { winEE } from '../../msg/WindowEventEmitter';
import { translation } from '../../trans/Trans';
import { SvgCodeBrackets } from '../svg/SvgCodeBrackets';
import { SvgListBox } from '../svg/SvgListBox';
import { FormHistoryControls } from '../components/common/FormHistoryControls';
import { MonacoEditorComponent } from '../components/common/MonacoEditorComponent';
import { Tooltip } from '../components/common/Tooltip';
import { ConfigsPanelBody } from '../components/configs/ConfigsPanelBody';
import { ConfigsPanelHeader } from '../components/configs/ConfigsPanelHeader';
import { FormHistory } from '../utils/formHistory';
import { handleEnterCommitShortcut, handleUndoRedoShortcuts } from '../utils/formUndoRedo';
import { HelperField } from './fields';
import { convertFullSchema, createFallbackSchema } from './schemaConverter';
import { ArrayFieldItemTemplate, ArrayFieldTemplate, DescriptionFieldTemplate, FieldTemplate, ObjectFieldTemplate } from './templates';
import { coerceValueToSchemaType, hasBooleanChange, isRecord } from './utils/rjsfUtils';
import { transformRjsfValidationErrors } from './utils/rjsfErrorTransform';
import { pruneHiddenFields } from './utils/visibleOption';
import { CheckboxListWidget } from './widgets/CheckboxListWidget';
import { ColorWidget } from './widgets/ColorWidget';
import { DatalistWidget } from './widgets/DatalistWidget';
import { HelperWidget } from './widgets/HelperWidget';
import { JSONWidget } from './widgets/JSONWidget';
import { SelectWidget } from './widgets/SelectWidget';

type SchemaSection = 'definition' | 'action' | 'trigger' | 'check';

export type RJSFConfigsPanelEditorMode = 'toggle' | 'json' | 'visual';

export interface RJSFConfigsPanelProps {
	/** The configuration data to edit */
	configs: Record<string, any>;
	/** The key of the config entry to edit */
	configKey: string;
	/** The ICgEventsSchema defining the structure */
	schema?: ICgEventsSchema;
	/** Which section of the schema to use */
	schemaSection?: SchemaSection;
	/** Callback when data changes */
	onUpdate(patch: Record<string, any>): void;
	/** Callback to close the panel */
	onClose(): void;
	/** Optional callback to go back (e.g. add wizard) */
	onBack?(): void;
	/** Optional tooltip/title for the back button */
	backTitle?: string;
	/** If true, renders in embedded mode without header/footer */
	embedded?: boolean;
	/** If true, shows the header in embedded mode */
	showHeader?: boolean;
	/** Override panel title (defaults to schema title or configKey) */
	title?: string;
	/** Override panel description (defaults to schema description) */
	description?: string;
	/** Controls whether JSON/visual are available */
	editorMode?: RJSFConfigsPanelEditorMode;
	/** Optional validation before save; return a message to block save */
	onValidate?(data: any): string | undefined;
	/** Additional form context properties to pass to widgets */
	formContext?: Record<string, any>;
}

interface RJSFConfigsPanelState {
	formData: any;
	showJsonEditor: boolean;
	jsonText: string;
	jsonError?: string;
	formError?: string;
}

// Custom widgets registry
const widgets: RegistryWidgetsType = {
	color: ColorWidget,
	CheckboxList: CheckboxListWidget,
	helper: HelperWidget,
	datalist: DatalistWidget,
	json: JSONWidget,
	select: SelectWidget,
};

// Custom fields registry (for object types that need custom rendering)
const fields: RegistryFieldsType = {
	helper: HelperField,
};

// Custom templates
const templates: Partial<TemplatesType> = {
	ArrayFieldItemTemplate,
	ArrayFieldTemplate,
	DescriptionFieldTemplate,
	FieldTemplate,
	ObjectFieldTemplate,
};

/**
 * Parse a JSON-looking string into object/array when possible
 */
function parseJsonLike(raw: any): any | undefined {
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

/**
 * Coerce values to match schema types (e.g., string "false" -> boolean false)
 */
function coerceToSchema(data: any, schema: RJSFSchema, definitions?: RJSFSchema['definitions']): any {
	if (data === undefined || data === null) return data;

	const defs = definitions || schema.definitions;

	// Resolve $ref if present
	let effectiveSchema = schema;
	if (schema.$ref) {
		const refMatch = schema.$ref.match(/^#\/definitions\/(.+)$/);
		if (refMatch && defs) {
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

	// Recursively coerce object properties
	if (schemaType === 'object' && effectiveSchema.properties && data && typeof data === 'object' && !Array.isArray(data)) {
		// If role object is missing but a stray top-level dr exists, move it under role
		if (
			data &&
			typeof data === 'object' &&
			!Array.isArray(data) &&
			typeof effectiveSchema.properties === 'object' &&
			!Array.isArray(effectiveSchema.properties)
		) {
			const hasRole = Object.prototype.hasOwnProperty.call(data, 'role');
			const hasDr = Object.prototype.hasOwnProperty.call(data, 'dr');
			const hasDrProp = Object.prototype.hasOwnProperty.call(effectiveSchema.properties, 'dr');
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
			if (key in result) {
				result[key] = coerceToSchema(result[key], propSchema, defs);
			}
		}
		return result;
	}

	// Parse JSON-looking strings when schema expects an object but has no explicit properties
	if (schemaType === 'object' && typeof data === 'string') {
		const parsed = parseJsonLike(data);
		if (parsed !== undefined) {
			return parsed;
		}
	}

	// Coerce to array if schema expects array
	if (schemaType === 'array') {
		const itemSchema = effectiveSchema.items;

		// If data is not an array, try to coerce it
		if (!Array.isArray(data)) {
			// If data is an object (single item), wrap it in an array
			if (data && typeof data === 'object') {
				data = [data];
			}
			// If data is a string that looks like JSON array, try to parse it
			else if (typeof data === 'string') {
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
			}
			// Otherwise default to empty array
			else {
				data = [];
			}
		}

		// Recursively coerce array items
		if (Array.isArray(data) && itemSchema && typeof itemSchema === 'object' && !Array.isArray(itemSchema)) {
			return data.map(item => coerceToSchema(item, itemSchema, defs));
		}
		return data;
	}

	return data;
}

/**
 * Deep merge two objects
 */
function deepMerge(target: any, source: any): any {
	if (!source || typeof source !== 'object' || Array.isArray(source)) {
		return source !== undefined ? source : target;
	}
	if (!target || typeof target !== 'object' || Array.isArray(target)) {
		return source;
	}
	const result: any = { ...target };
	for (const key of Object.keys(source)) {
		if (source[key] !== undefined) {
			if (
				source[key] &&
				typeof source[key] === 'object' &&
				!Array.isArray(source[key]) &&
				target[key] &&
				typeof target[key] === 'object' &&
				!Array.isArray(target[key])
			) {
				result[key] = deepMerge(target[key], source[key]);
			} else {
				result[key] = source[key];
			}
		}
	}
	return result;
}

function setDeepValue(parent: any, path: Array<string | number>, value: any): any {
	if (!path.length) return value;
	const [head, ...rest] = path;
	// Don't spread primitive types (string, number, boolean) - only arrays and objects
	let clone: any;
	if (Array.isArray(parent)) {
		clone = [...parent];
	} else if (parent && typeof parent === 'object') {
		clone = { ...parent };
	} else {
		// For primitives or null/undefined, create a new object
		clone = {};
	}
	const parentValue = parent && typeof parent === 'object' ? parent[head] : undefined;
	clone[head] = setDeepValue(parentValue, rest, value);
	return clone;
}

function getDeepValue(parent: any, path: Array<string | number>): any {
	let cur = parent;
	for (const seg of path) {
		if (cur === undefined || cur === null) {
			return undefined;
		}
		cur = cur[seg];
	}
	return cur;
}

/**
 * Resolve a $ref path to get the definition schema
 */
function resolveRef(ref: string, definitions: RJSFSchema['definitions']): RJSFSchema | undefined {
	if (!ref || !definitions) return undefined;
	// Handle #/definitions/Name format
	const match = ref.match(/^#\/definitions\/(.+)$/);
	if (match) {
		const def = definitions[match[1]];
		// definitions can be boolean in JSON Schema, but we only want objects
		if (def && typeof def === 'object' && !Array.isArray(def)) {
			return def;
		}
	}
	return undefined;
}

/**
 * Build default values from schema, resolving $ref references
 */
function buildDefaultValues(
	schema: RJSFSchema,
	definitions?: RJSFSchema['definitions']
): Record<string, any> {
	const result: Record<string, any> = {};
	const defs = definitions || schema.definitions;
	if (!schema.properties) return result;

	for (const [key, prop] of Object.entries(schema.properties)) {
		// Skip boolean definitions
		if (typeof prop === 'boolean') continue;

		let propSchema = prop;

		// Resolve $ref if present
		if (propSchema.$ref) {
			const resolved = resolveRef(propSchema.$ref, defs);
			if (resolved) {
				const { $ref, ...rest } = propSchema;
				propSchema = { ...resolved, ...rest };
			}
		}

		if (propSchema.type === 'object') {
			const base = propSchema.properties ? buildDefaultValues(propSchema, defs) : undefined;
			if (propSchema.default !== undefined) {
				let effectiveDefault: any = propSchema.default;
				if (typeof effectiveDefault === 'string') {
					const parsed = parseJsonLike(effectiveDefault);
					if (parsed !== undefined) {
						effectiveDefault = parsed;
					}
				}

				if (base && effectiveDefault && typeof effectiveDefault === 'object' && !Array.isArray(effectiveDefault)) {
					result[key] = ObjectUtil.safeAssign(base, effectiveDefault);
				} else if (effectiveDefault && typeof effectiveDefault === 'object' && !Array.isArray(effectiveDefault)) {
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

/**
 * RJSF-based configuration panel component
 */
export class RJSFConfigsPanel extends React.PureComponent<RJSFConfigsPanelProps, RJSFConfigsPanelState> {
	private formHistory: FormHistory<any>;
	private cachedJsonSchema: RJSFSchema = { type: 'object' };
	private cachedUiSchema: UiSchema = {};
	private cachedEnhancedUiSchema: UiSchema = {};
	private cachedSchemaSnapshot?: ICgEventsSchema;
	private cachedSchemaKey?: { configKey: string; schemaSection: SchemaSection };
	private cachedLanguageCode?: string;
	private lastConfigKey: string;
	private lastSchemaSection: SchemaSection;
	private lastSchemaSnapshot?: ICgEventsSchema;
	private containerRef = React.createRef<HTMLDivElement>();
	private formRef = React.createRef<Form<any>>();
	private pendingArrayCommit = false;
	private pendingArrayAdd?: { path: Array<string | number>; index: number; itemSchema: Record<string, any> };

	constructor(props: RJSFConfigsPanelProps) {
		super(props);
		this.ensureSchemaCache(props);
		const initialData = this.buildInitialData(props);
		const initialShowJsonEditor = this.getEditorMode(props) === 'json';
		this.formHistory = new FormHistory(initialData, this.forceUpdate.bind(this));
		this.state = {
			formData: initialData,
			showJsonEditor: initialShowJsonEditor,
			jsonText: JSON.stringify(initialData, null, 2),
			jsonError: undefined,
			formError: undefined,
		};
		this.lastConfigKey = props.configKey;
		this.lastSchemaSection = this.getSchemaSection(props);
		this.lastSchemaSnapshot = props.schema ? ObjectUtil.deepCloneObject(props.schema) : props.schema;
	}

	componentDidMount(): void {
		winEE.on('keydown', this.handleKeyDown, this);
	}

	componentDidUpdate(prevProps: RJSFConfigsPanelProps): void {
		const nextSchemaSection = this.getSchemaSection(this.props);
		const schemaChanged = !ObjectUtil.equals(this.lastSchemaSnapshot, this.props.schema);
		const editorModeChanged = this.getEditorMode(prevProps) !== this.getEditorMode(this.props);
		if (
			this.lastConfigKey !== this.props.configKey ||
			this.lastSchemaSection !== nextSchemaSection ||
			schemaChanged ||
			editorModeChanged
		) {
			this.lastConfigKey = this.props.configKey;
			this.lastSchemaSection = nextSchemaSection;
			this.lastSchemaSnapshot = this.props.schema ? ObjectUtil.deepCloneObject(this.props.schema) : this.props.schema;
			this.ensureSchemaCache(this.props);
			const initialData = this.buildInitialData(this.props);
			const initialShowJsonEditor = this.getEditorMode(this.props) === 'json';
			this.formHistory.reset(initialData);
			this.setState({
				formData: initialData,
				showJsonEditor: initialShowJsonEditor,
				jsonText: JSON.stringify(initialData, null, 2),
				jsonError: undefined,
				formError: undefined,
			});
			return;
		}

		if (prevProps.embedded !== this.props.embedded && this.state.showJsonEditor) {
			this.setState({ jsonText: JSON.stringify(this.state.formData, null, 2) });
		}
	}

	componentWillUnmount(): void {
		winEE.off('keydown', this.handleKeyDown, this);
	}

	private getSchemaSection(props: RJSFConfigsPanelProps): SchemaSection {
		return props.schemaSection ?? 'definition';
	}

	private getEditorMode(props: RJSFConfigsPanelProps = this.props): RJSFConfigsPanelEditorMode {
		const mode = props.editorMode;
		if (mode === 'json' || mode === 'visual' || mode === 'toggle') {
			return mode;
		}
		return 'toggle';
	}

	private getConfigEntry(props: RJSFConfigsPanelProps): any {
		const entry = props.configs ? props.configs[props.configKey] : undefined;
		return entry ?? {};
	}

	private ensureSchemaCache(props: RJSFConfigsPanelProps): void {
		const schemaSection = this.getSchemaSection(props);
		const schemaChanged = !ObjectUtil.equals(this.cachedSchemaSnapshot, props.schema);
		const languageCode = getSelectedLanguage().code;
		const languageChanged = this.cachedLanguageCode !== languageCode;
		const keyChanged =
			!this.cachedSchemaKey ||
			this.cachedSchemaKey.configKey !== props.configKey ||
			this.cachedSchemaKey.schemaSection !== schemaSection;

		if (!this.cachedSchemaKey || schemaChanged || keyChanged || languageChanged) {
			let jsonSchema: RJSFSchema;
			let uiSchema: UiSchema;
			if (props.schema) {
				const converted = convertFullSchema(props.schema, props.configKey, schemaSection);
				jsonSchema = converted.schema;
				uiSchema = converted.uiSchema;
			} else {
				const data = this.getConfigEntry(props) || {};
				const fallback = createFallbackSchema(data);
				jsonSchema = fallback.schema;
				uiSchema = fallback.uiSchema;
			}
			this.cachedJsonSchema = jsonSchema;
			this.cachedUiSchema = uiSchema;
			this.cachedEnhancedUiSchema = this.buildEnhancedUiSchema(uiSchema);
			this.cachedSchemaSnapshot = props.schema ? ObjectUtil.deepCloneObject(props.schema) : props.schema;
			this.cachedSchemaKey = {
				configKey: props.configKey,
				schemaSection,
			};
			this.cachedLanguageCode = languageCode;
		}
	}

	private getSchemaPair(props: RJSFConfigsPanelProps = this.props): { schema: RJSFSchema; uiSchema: UiSchema; enhancedUiSchema: UiSchema } {
		this.ensureSchemaCache(props);
		return {
			schema: this.cachedJsonSchema,
			uiSchema: this.cachedUiSchema,
			enhancedUiSchema: this.cachedEnhancedUiSchema,
		};
	}

	private buildEnhancedUiSchema(uiSchema: UiSchema): UiSchema {
		const enhanced: UiSchema = ObjectUtil.deepCloneObject(uiSchema);
		const addLanguageCode = (schema: any) => {
			if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
			for (const key of Object.keys(schema)) {
				if (key.startsWith('ui:')) continue;
				const field = schema[key];
				if (field && typeof field === 'object' && !Array.isArray(field)) {
					if (field['ui:widget'] === 'helper') {
						const options = field['ui:options'];
						field['ui:options'] = isRecord(options) ? { ...options } : {};
					}
					addLanguageCode(field);
				}
			}
		};
		addLanguageCode(enhanced);
		return enhanced;
	}

	private buildInitialData(props: RJSFConfigsPanelProps): any {
		const { schema } = this.getSchemaPair(props);
		const defaults = buildDefaultValues(schema);
		const source = this.getConfigEntry(props) || {};
		const merged = deepMerge(defaults, source);
		return coerceToSchema(merged, schema);
	}

	private handleKeyDown(event: KeyboardEvent) {
		if (handleUndoRedoShortcuts(event, this.containerRef.current, this.handleUndo, this.handleRedo)) {
			return;
		}
		handleEnterCommitShortcut(event, this.containerRef.current, this.handleEnterCommit);
	}

	private handleEnterCommit = () => {
		this.syncFormDataFromRef(() => this.commitFormData(true));
	};

	private replaceInitialHistorySnapshot = () => {
		if (this.formHistory.canUndo() || this.formHistory.canRedo()) {
			return;
		}
		this.formHistory.reset(this.state.formData);
	};

	private handleUndo = () => {
		this.commitFormData();
		const snapshot = this.formHistory.undo();
		if (!snapshot) return;
		this.setState((prev) => ({
			formData: snapshot,
			jsonText: prev.showJsonEditor ? JSON.stringify(snapshot, null, 2) : prev.jsonText,
			jsonError: undefined,
			formError: undefined,
		}), this.validateForm);
	};

	private handleRedo = () => {
		this.commitFormData();
		const snapshot = this.formHistory.redo();
		if (!snapshot) return;
		this.setState((prev) => ({
			formData: snapshot,
			jsonText: prev.showJsonEditor ? JSON.stringify(snapshot, null, 2) : prev.jsonText,
			jsonError: undefined,
			formError: undefined,
		}), this.validateForm);
	};

	private validateForm = () => {
		if (this.state.showJsonEditor) {
			return;
		}
		this.formRef.current?.validateForm();
	};

	private commitFormData = (trigger?: string | boolean) => {
		if (this.state.showJsonEditor && this.state.jsonError) {
			return;
		}
		let snapshot = this.state.formData;
		if (!this.state.showJsonEditor) {
			const formSnapshot = this.formRef.current?.state.formData;
			if (formSnapshot !== undefined) {
				const { schema } = this.getSchemaPair();
				snapshot = coerceToSchema(formSnapshot, schema);
			}
		}
		const pushed = this.formHistory.push(snapshot);
		if (trigger === true && pushed) {
			this.validateForm();
		}
	};

	private commitArrayChange = () => {
		if (this.state.showJsonEditor && this.state.jsonError) {
			return;
		}
		this.pendingArrayCommit = true;
	};

	private registerArrayAdd = (path: Array<string | number>, index: number, itemSchema: unknown) => {
		if (!Array.isArray(path) || !Number.isFinite(index) || index < 0 || !isRecord(itemSchema)) {
			this.pendingArrayAdd = undefined;
			return;
		}
		this.pendingArrayAdd = { path: [...path], index, itemSchema };
	};

	private applyPendingArrayAddDefaults(nextData: any): any {
		const pending = this.pendingArrayAdd;
		this.pendingArrayAdd = undefined;
		if (!pending) {
			return nextData;
		}

		const arrayValue = getDeepValue(nextData, pending.path);
		if (!Array.isArray(arrayValue) || arrayValue.length <= pending.index) {
			return nextData;
		}

		const form = this.formRef.current;
		const schemaUtils = form?.state.schemaUtils;
		if (!schemaUtils) {
			return nextData;
		}

		const rowDefault = schemaUtils.getDefaultFormState(pending.itemSchema, undefined, true);
		if (rowDefault === undefined) {
			return nextData;
		}

		const existingRow = arrayValue[pending.index];
		let mergedRow = rowDefault;
		if (existingRow !== undefined) {
			if (isRecord(rowDefault) && isRecord(existingRow)) {
				mergedRow = deepMerge(rowDefault, existingRow);
			} else {
				mergedRow = existingRow;
			}
		}

		if (ObjectUtil.equals(existingRow, mergedRow)) {
			return nextData;
		}

		const rowPath = pending.path.concat(pending.index);
		return setDeepValue(nextData, rowPath, mergedRow);
	}

	private handleFormBlur = (_id?: string, _value?: any) => {
		this.syncFormDataFromRef(() => this.commitFormData(true));
	};

	private syncFormDataFromRef = (afterApply?: () => void) => {
		const form = this.formRef.current;
		if (!form) {
			return;
		}
		this.applyFormData(form.state.formData, afterApply);
	};

	private applyFormData(nextData: any, afterApply?: () => void) {
		const { schema } = this.getSchemaPair();
		const coerced = coerceToSchema(nextData, schema);
		this.setState((prev) => ({
			formData: coerced,
			jsonText: prev.showJsonEditor ? JSON.stringify(coerced, null, 2) : prev.jsonText,
			jsonError: undefined,
			formError: undefined,
		}), afterApply);
	}

	private getRequiredErrorMessage(): string {
		const code = getSelectedLanguage().code;
		if (code.startsWith('zh')) {
			return '必填';
		}
		return 'Required';
	}

	private transformErrors = (errors: any) => {
		if (!Array.isArray(errors)) {
			return errors;
		}
		return transformRjsfValidationErrors(errors, this.getRequiredErrorMessage());
	};

	private handleChange = (event: IChangeEvent) => {
		const shouldCommitArray = this.pendingArrayCommit;
		const shouldApply = shouldCommitArray || hasBooleanChange(this.state.formData, event.formData);
		if (!shouldApply) {
			return;
		}
		if (!shouldCommitArray) {
			this.pendingArrayAdd = undefined;
		}
		this.pendingArrayCommit = false;
		const nextData = shouldCommitArray ? this.applyPendingArrayAddDefaults(event.formData) : event.formData;
		if (shouldCommitArray) {
			this.applyFormData(nextData, () => this.commitFormData(true));
			return;
		}
		this.applyFormData(nextData, () => this.commitFormData(true));
	};

	private handlePathUpdate = (path: Array<string | number>, next: any, commit?: boolean | 'init') => {
		const liveBase = this.state.showJsonEditor
			? this.state.formData
			: (this.formRef.current?.state.formData ?? this.state.formData);
		const updated = setDeepValue(liveBase, path, next);
		if (commit === 'init') {
			if (this.formHistory.canUndo() || this.formHistory.canRedo()) {
				this.applyFormData(updated, () => this.commitFormData(true));
				return;
			}
			this.applyFormData(updated, this.replaceInitialHistorySnapshot);
			return;
		}
		this.applyFormData(updated, commit ? () => this.commitFormData(true) : undefined);
	};

	private handleSave = () => {
		if (this.state.showJsonEditor && this.state.jsonError) {
			this.setState({ formError: translation.validation.invalidJson.getTrans() });
			return;
		}

		const { schema, enhancedUiSchema } = this.getSchemaPair();
		const formSnapshot = this.state.showJsonEditor ? undefined : this.formRef.current?.state.formData;
		const sourceData = formSnapshot ?? this.state.formData;
		const coercedData = coerceToSchema(sourceData, schema);
		const sanitizedData = pruneHiddenFields(coercedData, enhancedUiSchema, coercedData);

		const validateMessage = this.props.onValidate?.(sanitizedData);
		if (validateMessage) {
			this.setState({ formError: validateMessage });
			return;
		}

		try {
			this.props.onUpdate({ configs: { [this.props.configKey]: sanitizedData } });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.setState({ formError: message || translation.validation.invalidJson.getTrans() });
			return;
		}

		this.props.onClose();
	};

	private handleJsonChange = (text: string) => {
		const { schema } = this.getSchemaPair();
		try {
			const parsed = JSON.parse(text || '{}');
			const coerced = coerceToSchema(parsed, schema);
			this.setState({
				jsonText: text,
				jsonError: undefined,
				formData: coerced,
				formError: undefined,
			});
		} catch (err) {
			this.setState({
				jsonText: text,
				jsonError: err instanceof Error ? err.message : translation.validation.invalidJson.getTrans(),
				formError: undefined,
			});
		}
	};

	private toggleJsonEditor = () => {
		if (this.getEditorMode() !== 'toggle') {
			return;
		}

		if (this.state.showJsonEditor) {
			this.setState((prev) => ({
				showJsonEditor: false,
				jsonError: undefined,
				jsonText: prev.jsonText,
				formError: undefined,
			}));
			return;
		}

		const form = this.formRef.current;
		if (!form) {
			this.setState((prev) => ({
				showJsonEditor: true,
				jsonError: undefined,
				jsonText: JSON.stringify(prev.formData, null, 2),
				formError: undefined,
			}));
			return;
		}

		this.applyFormData(form.state.formData, () => {
			this.setState((prev) => ({
				showJsonEditor: true,
				jsonError: undefined,
				jsonText: JSON.stringify(prev.formData, null, 2),
				formError: undefined,
			}));
		});
	};

	render() {
		const {
			configKey,
			onClose,
			onBack,
			backTitle,
			embedded = false,
			showHeader = true,
			title: titleOverride,
			description: descriptionOverride,
		} = this.props;
		const { schema: jsonSchema, enhancedUiSchema } = this.getSchemaPair();

		const title = titleOverride ?? jsonSchema.title ?? configKey;
		const description = descriptionOverride ?? jsonSchema.description;
		const resolvedBackTitle = onBack ? (backTitle ?? translation.common.back.getTrans()) : undefined;
		const canUndo = this.formHistory.canUndo();
		const canRedo = this.formHistory.canRedo();
		const canToggleJson = this.getEditorMode() === 'toggle';

		const historyControls = (
			<FormHistoryControls
				canUndo={canUndo}
				canRedo={canRedo}
				onUndo={this.handleUndo}
				onRedo={this.handleRedo}
			/>
		);

		if (embedded) {
			return (
				<div ref={this.containerRef} className="card shadow-sm">
					<div className="card-header d-flex align-items-center justify-content-between gap-2 py-1">
						{showHeader && (
							<div className="min-w-0">
								<p className="mb-0 fw-semibold text-truncate">{title}</p>
								{description && <p className="mb-0 mt-1 text-body-secondary small">{description}</p>}
							</div>
						)}
						{canToggleJson && (
							<Tooltip content={this.state.showJsonEditor ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}>
								<button
									type="button"
									className="btn btn-sm btn-outline-secondary p-1"
									onClick={this.toggleJsonEditor}
									onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
								>
									{this.state.showJsonEditor ? (
										<SvgListBox aria-hidden="true" />
									) : (
										<SvgCodeBrackets aria-hidden="true" />
									)}
								</button>
							</Tooltip>
						)}
					</div>

					<div className="card-body p-2 d-flex flex-column gap-2">
						<div className="d-flex align-items-center justify-content-between">
							{historyControls}
						</div>
						{this.state.showJsonEditor ? (
							<MonacoEditorComponent
								value={this.state.jsonText}
								error={this.state.jsonError}
								onChange={this.handleJsonChange}
								onCommit={this.commitFormData}
								compact
							/>
						) : (
								<Form
									ref={this.formRef}
									schema={jsonSchema}
									uiSchema={enhancedUiSchema}
									formData={this.state.formData}
									validator={validator}
									onChange={this.handleChange}
									onBlur={this.handleFormBlur}
									widgets={widgets}
									fields={fields}
									templates={templates}
									formContext={{
										...this.props.formContext,
									rootFormData: this.state.formData,
									updateFormData: this.handlePathUpdate,
									commitArrayChange: this.commitArrayChange,
									registerArrayAdd: this.registerArrayAdd,
									}}
									className="cgenh-rjsf-form"
									liveValidate="onBlur"
									transformErrors={this.transformErrors}
									showErrorList={false}
								>
									<></>
								</Form>
						)}
						{this.state.formError && (
							<div className="alert alert-danger py-1 mb-0" role="alert">
								{this.state.formError}
							</div>
						)}
						<div className="d-flex justify-content-end gap-2">
							<button type="button" className="btn btn-sm btn-outline-secondary" onClick={this.handleSave}>
								{translation.common.save.getTrans()}
							</button>
							<button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
								{translation.common.close.getTrans()}
							</button>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div ref={this.containerRef} className="modal-content d-flex flex-column h-100">
				<ConfigsPanelHeader
					title={title}
					description={description}
					onClose={onClose}
					onBack={onBack}
					backTitle={resolvedBackTitle}
					controls={historyControls}
					showClose={false}
				/>
				<ConfigsPanelBody
					className={[
						'flex-grow-1',
						'd-flex',
						'flex-column',
						'gap-2',
						'cgenh-modal-body',
						this.state.showJsonEditor ? 'cgenh-modal-body--flush' : '',
						this.state.showJsonEditor ? 'cgenh-modal-body--no-scroll' : 'cgenh-modal-body--scroll',
					].join(' ')}
				>
					{this.state.showJsonEditor ? (
						<MonacoEditorComponent
							className="flex-grow-1"
							value={this.state.jsonText}
							error={this.state.jsonError}
							onChange={this.handleJsonChange}
							onCommit={this.commitFormData}
							fill
						/>
					) : (
						<Form
							ref={this.formRef}
							schema={jsonSchema}
							uiSchema={enhancedUiSchema}
							formData={this.state.formData}
							validator={validator}
							onChange={this.handleChange}
							onBlur={this.handleFormBlur}
							widgets={widgets}
							fields={fields}
							templates={templates}
							formContext={{
								...this.props.formContext,
								rootFormData: this.state.formData,
								updateFormData: this.handlePathUpdate,
								commitArrayChange: this.commitArrayChange,
								registerArrayAdd: this.registerArrayAdd,
							}}
							className="cgenh-rjsf-form"
							liveValidate="onBlur"
							transformErrors={this.transformErrors}
							showErrorList={false}
						>
							<></>
						</Form>
					)}
					{this.state.formError && (
						<div className="alert alert-danger py-1 mb-0" role="alert">
							{this.state.formError}
						</div>
					)}
				</ConfigsPanelBody>
				<div className="modal-footer d-flex align-items-center justify-content-between">
					<div>
						{canToggleJson && (
							<Tooltip content={this.state.showJsonEditor ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}>
								<button
									type="button"
									className="btn btn-sm btn-outline-secondary p-1"
									onClick={this.toggleJsonEditor}
									onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
								>
									{this.state.showJsonEditor ? (
										<SvgListBox aria-hidden="true" />
									) : (
										<SvgCodeBrackets aria-hidden="true" />
									)}
								</button>
							</Tooltip>
						)}
					</div>
					<div className="d-flex gap-2">
						<button type="button" className="btn btn-outline-secondary" onClick={this.handleSave}>
							{translation.common.save.getTrans()}
						</button>
						<button type="button" className="btn btn-outline-secondary" onClick={onClose}>
							{translation.common.close.getTrans()}
						</button>
					</div>
				</div>
			</div>
		);
	}
}

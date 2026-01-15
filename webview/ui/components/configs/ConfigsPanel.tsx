import { ICgEventsSchema, ICgEventsSchemaEntry, ICgEventsSchemaProperty, ICgEventsSchemaTypeSimple, translateSchema } from '@shared';
import React from 'react';
import { modifier } from '../../../editor/modifier';
import { translation } from '../../../trans/Trans';
import { SvgCodeBrackets } from '../../svg/SvgCodeBrackets';
import { SvgListBox } from '../../svg/SvgListBox';
import { getResponsiveGridClasses } from '../../helpers/gridHelper';
import { getIndentClass } from '../../helpers/indentHelper';
import { isRecord } from '../../rjsf/utils/rjsfUtils';
import { MonacoEditorComponent } from '../common/MonacoEditorComponent';
import { Tooltip } from '../common/Tooltip';
import type { HelperInfo, PrimitiveInputType } from '../inputs/PropertyElement';
import { ConfigsPanelBody } from './ConfigsPanelBody';
import { ConfigsPanelFields } from './ConfigsPanelFields';
import { ConfigsPanelHeader } from './ConfigsPanelHeader';
import type { ConfigsPanelFieldApi, SchemaSection } from './ConfigsPanelTypes';

interface ConfigsPanelProps {
	configs: Record<string, any>;
	configKey: string;
	schema?: ICgEventsSchema;
	schemaSection?: SchemaSection;
	onUpdate(patch: Record<string, any>): void;
	onClose(): void;
	embedded?: boolean;
	showHeader?: boolean;
	onEditAsJson?(): void;
}

interface ConfigsPanelState {
	config: Record<string, any>;
	jsonText: string;
	jsonError?: string;
	showJsonEditor: boolean;
}

export class ConfigsPanel extends React.PureComponent<ConfigsPanelProps, ConfigsPanelState> {
	// Use a counter to track pending internal updates instead of a boolean
	private pendingInternalUpdates: number = 0;
	// Track the timeout ID so we can cancel it if needed
	private resetFlagTimeout: NodeJS.Timeout | null = null;
	private readonly fieldApi: ConfigsPanelFieldApi;
	private readonly rootPath: Array<string | number> = [];

	constructor(props: ConfigsPanelProps) {
		super(props);
		const nextConfig = this.cloneConfig(props);
		this.state = {
			config: nextConfig,
			jsonText: '',
			showJsonEditor: false,
			jsonError: undefined,
		};
		this.handleSave = this.handleSave.bind(this);
		this.fieldApi = {
			getDefinitionEntry: (name?: string, section?: SchemaSection) => this.getDefinitionEntry(name, section),
			getLayoutClasses: (prop: ICgEventsSchemaProperty, useGridLayout: boolean, forceFullWidth?: boolean) =>
				this.getLayoutClasses(prop, useGridLayout, forceFullWidth),
			getPropertyFormat: (prop: ICgEventsSchemaProperty) => this.getPropertyFormat(prop),
			getPrimitiveInputType: (prop: ICgEventsSchemaProperty) => this.getPrimitiveInputType(prop),
			normalizeSchemaType: (type: string) => this.normalizeSchemaType(type),
			resolveDefinitionName: (schemaProp?: ICgEventsSchemaProperty, checkArrayItems?: boolean) =>
				this.resolveDefinitionName(schemaProp, checkArrayItems),
			isPropertyVisible: (target: any, prop: ICgEventsSchemaProperty) => this.isPropertyVisible(target, prop),
			getDefaultValueForProp: (prop?: ICgEventsSchemaProperty) => this.getDefaultValueForProp(prop),
			buildDefaultDefinitionValue: (entry?: ICgEventsSchemaEntry) => this.buildDefaultDefinitionValue(entry),
			parseHelper: (
				helperValue: unknown,
				source: 'format' | 'helper',
				editorOptions: any,
				entryType: 'action' | 'trigger' | 'check' | 'definition',
				entryKey: string,
				propKey: string,
			) => this.parseHelper(helperValue, source, editorOptions, entryType, entryKey, propKey),
			coercePrimitive: (value: string, schemaProp?: ICgEventsSchemaProperty) => this.coercePrimitive(value, schemaProp),
			updateValue: (path: Array<string | number>, value: any) => this.updateValue(path, value),
			updateValueWithTemplates: (
				scopeTarget: any,
				scopePath: Array<string | number>,
				key: string,
				value: any,
				scopeProps: ICgEventsSchemaProperty[],
			) => this.updateValueWithTemplates(scopeTarget, scopePath, key, value, scopeProps),
		};
	}

	componentDidUpdate(prevProps: ConfigsPanelProps) {
		// Don't reset state when JSON editor is open
		if (this.state.showJsonEditor) {
			return;
		}

		// Detect incoming prop changes first so we don't skip them when pendingInternalUpdates > 0
		const prevEntry = prevProps.configs?.[prevProps.configKey];
		const nextEntry = this.props.configs?.[this.props.configKey];
		const configKeyChanged = prevProps.configKey !== this.props.configKey;
		const entryChanged = prevEntry !== nextEntry;
		const sectionChanged = prevProps.schemaSection !== this.props.schemaSection;
		const propsChanged = configKeyChanged || entryChanged || sectionChanged;

		if (propsChanged) {
			// Sync state from incoming props immediately, even if we're in the middle of an internal update
			const nextConfig = this.cloneConfig(this.props);
			if (this.resetFlagTimeout) {
				clearTimeout(this.resetFlagTimeout);
				this.resetFlagTimeout = null;
			}
			this.pendingInternalUpdates = 0;
			this.setState({
				config: nextConfig,
				jsonText: '',
				jsonError: undefined,
			});
			return;
		}

		// Don't reset state during internal updates
		if (this.pendingInternalUpdates > 0) {
			// Cancel any existing timeout
			if (this.resetFlagTimeout) {
				clearTimeout(this.resetFlagTimeout);
			}
			// Reset counter after a longer delay to handle helper interactions
			this.resetFlagTimeout = setTimeout(() => {
				this.pendingInternalUpdates = Math.max(0, this.pendingInternalUpdates - 1);
				this.resetFlagTimeout = null;
			}, 500);
			return;
		}
	}

	componentWillUnmount(): void {
		// Clean up timeout on unmount
		if (this.resetFlagTimeout) {
			clearTimeout(this.resetFlagTimeout);
			this.resetFlagTimeout = null;
		}
	}

	private deepMerge(target: any, source: any): any {
		if (!source || typeof source !== 'object' || Array.isArray(source)) {
			return source !== undefined ? source : target;
		}
		if (!target || typeof target !== 'object' || Array.isArray(target)) {
			return source;
		}
		const result: any = { ...target };
		for (const key of Object.keys(source)) {
			if (source[key] !== undefined) {
				if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
					target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
					result[key] = this.deepMerge(target[key], source[key]);
				} else {
					result[key] = source[key];
				}
			}
		}
		return result;
	}

	private cloneConfig(props: ConfigsPanelProps): Record<string, any> {
		const source = props.configs?.[props.configKey] ?? {};
		const definition = this.getDefinitionEntry(props.configKey, props.schemaSection);
		const defaults = this.buildDefaultDefinitionValue(definition);
		let cloned: any;
		try {
			cloned = JSON.parse(JSON.stringify(source));
		} catch {
			cloned = { ...(source || {}) };
		}
		return this.deepMerge(defaults, cloned || {});
	}

	private normalizeDefinitionKey(rawValue: unknown, allowBare = false): string | null {
		if (typeof rawValue !== 'string') return null;
		const trimmed = rawValue.trim();
		if (!trimmed) return null;
		if (trimmed.startsWith('#/definitions/')) {
			return trimmed.slice('#/definitions/'.length);
		}
		if (trimmed.startsWith('#') || trimmed.startsWith('@')) {
			return trimmed.slice(1);
		}
		return allowBare ? trimmed : null;
	}

	// helper URL construction is handled inside HelperViewer

	private resolveDefinitionName(schemaProp?: ICgEventsSchemaProperty, checkArrayItems = false): string | null {
		if (!schemaProp || typeof schemaProp !== 'object') return null;

		const direct = this.normalizeDefinitionKey(schemaProp.definition, true);
		if (direct) {
			return direct;
		}

		const fromType = this.normalizeDefinitionKey(schemaProp.type, false);
		if (fromType) {
			return fromType;
		}

		if (checkArrayItems) {
			const fromArrayItem = this.normalizeDefinitionKey(schemaProp.arrayItem, false);
			if (fromArrayItem) {
				return fromArrayItem;
			}

			const items = schemaProp.items;
			if (items && typeof items === 'object') {
				const fromItemDefinition = this.normalizeDefinitionKey(items.definition, true);
				if (fromItemDefinition) {
					return fromItemDefinition;
				}
				const fromItemType = this.normalizeDefinitionKey(items.type, false);
				if (fromItemType) {
					return fromItemType;
				}
			}
		}

		return null;
	}


	private getDefinitionEntry(name?: string, section?: SchemaSection): ICgEventsSchemaEntry | undefined {
		if (!name) return undefined;
		const selected = section ?? this.props.schemaSection ?? 'definition';
		const { schema } = this.props;
		let entry: ICgEventsSchemaEntry | undefined;
		if (selected === 'action') entry = schema?.action?.[name];
		else if (selected === 'trigger') entry = schema?.trigger?.[name];
		else if (selected === 'check') entry = schema?.check?.[name];
		else entry = schema?.definition?.[name];

		if (!entry && selected !== 'definition') {
			entry = schema?.definition?.[name];
		}
		return entry;
	}

	private getProperties(entry: ICgEventsSchemaEntry | undefined, target: any): ICgEventsSchemaProperty[] {
		if (Array.isArray(entry?.properties)) {
			return entry.properties.filter((p) => !!p?.key);
		}
		const keys = target && typeof target === 'object' ? Object.keys(target) : [];
		return keys.map((key) => ({ key }));
	}

	private setDeepValue(parent: any, path: Array<string | number>, value: any, index = 0): any {
		if (index >= path.length) return value;
		const key = path[index];
		const clone: any = Array.isArray(parent) ? parent.slice() : { ...(parent || {}) };
		if (index === path.length - 1) {
			clone[key] = value;
			return clone;
		}
		const nextContainer = typeof path[index + 1] === 'number' ? [] : {};
		const current = clone[key];
		clone[key] = this.setDeepValue(current ?? nextContainer, path, value, index + 1);
		return clone;
	}

	private getValueByPath(target: any, path: string): any {
		if (!path) return undefined;
		const segments = path.split('.').filter(Boolean);
		let cursor = target;
		for (const seg of segments) {
			if (cursor === null || cursor === undefined) return undefined;
			cursor = cursor[seg];
		}
		return cursor;
	}

	private applyTemplateString(template: string, context: any): string {
		const getPathVal = (obj: any, path: string) => {
			const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
			let cur = obj;
			for (const part of parts) {
				if (cur && typeof cur === 'object' && part in cur) {
					cur = cur[part];
				} else {
					return '';
				}
			}
			return cur ?? '';
		};
		return template.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
			const val = getPathVal(context, key);
			return val === undefined || val === null ? '' : String(val);
		});
	}

	private updateValue(path: Array<string | number>, value: any) {
		this.setState((prev) => {
			const nextConfig = this.setDeepValue(prev.config ?? {}, path, value);
			if (this.props.embedded && this.props.onUpdate) {
				this.pendingInternalUpdates++; // Increment counter
				this.props.onUpdate({ configs: { [this.props.configKey]: nextConfig } });
			}
			return {
				config: nextConfig,
				jsonText: prev.showJsonEditor ? this.stringifyConfig(nextConfig) : prev.jsonText,
				jsonError: undefined,
			} satisfies Partial<ConfigsPanelState>;
		});
	}

	private updateValueWithTemplates(
		scopeTarget: any,
		scopePath: Array<string | number>,
		key: string,
		value: any,
		scopeProps: ICgEventsSchemaProperty[],
	) {
		this.setState((prev) => {
			const prevConfig = prev.config ?? {};
			const currentScope = this.getValueByPath(prevConfig, scopePath.join('.')) ?? scopeTarget ?? {};
			let nextScope = this.setDeepValue(currentScope, [key], value);

			// If helper returned an object with sibling fields, spread them into scope.
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				scopeProps.forEach((p) => {
					if (p.key === key) return;
					if (value[p.key] !== undefined) {
						const incoming = value[p.key];
						const coerced =
							p.type === 'number' || p.type === 'boolean'
								? this.coercePrimitive(String(incoming), p)
								: incoming;
						nextScope = this.setDeepValue(nextScope, [p.key], coerced);
					}
				});
			}

			scopeProps.forEach((p) => {
				const tpl = typeof p.template === 'string' ? p.template : undefined;
				if (typeof tpl === 'string' && tpl.trim()) {
					nextScope[p.key] = this.applyTemplateString(tpl, nextScope);
				}
			});

			const nextConfig = this.setDeepValue(prevConfig, scopePath, nextScope);
			if (this.props.embedded && this.props.onUpdate) {
				this.pendingInternalUpdates++; // Increment counter
				this.props.onUpdate({ configs: { [this.props.configKey]: nextConfig } });
			}
			return {
				config: nextConfig,
				jsonText: prev.showJsonEditor ? this.stringifyConfig(nextConfig) : prev.jsonText,
				jsonError: undefined,
			} satisfies Partial<ConfigsPanelState>;
		});
	}

	private coercePrimitive(value: string, schemaProp?: ICgEventsSchemaProperty) {
		if (schemaProp?.enum && schemaProp.enum.length) {
			const match = schemaProp.enum.find((item) => String(item) === value);
			if (match !== undefined) return match;
		}
		const targetFormat = this.getPropertyFormat(schemaProp);
		const targetType = targetFormat ?? schemaProp?.type;
		if (targetType) {
			if (targetType === 'number' || targetType === 'integer') {
				return value;
			}
			if (targetType === 'boolean') {
				if (typeof value === 'boolean') return value;
				if (value === 'true') return true;
				if (value === 'false') return false;
				return value;
			}
		}
		return value;
	}

	private getDefaultValueForProp(prop?: ICgEventsSchemaProperty): any {
		if (!prop) return undefined;
		if (prop.default !== undefined) {
			const defVal: unknown = prop.default;
			// Try to get localized default from language map
			if (isRecord(defVal)) {
				const languageMap: Record<string, string | string[]> = {};
				for (const key of Object.keys(defVal)) {
					const value = defVal[key];
					if (typeof value === 'string') {
						languageMap[key] = value;
						continue;
					}
					if (typeof value === 'number' || typeof value === 'boolean') {
						languageMap[key] = String(value);
						continue;
					}
					if (Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
						languageMap[key] = value.map((item) => String(item));
					}
				}
				const localized = translateSchema(languageMap);
				if (localized !== undefined) {
					if (Array.isArray(localized)) return localized;
					if (prop.type === 'number') {
						const n = Number(localized);
						if (Number.isFinite(n)) return n;
					}
					if (prop.type === 'boolean') {
						return String(localized).toLowerCase() === 'true';
					}
					return localized;
				}
			}
			return defVal;
		}
		const isArray = Boolean(
			prop.collection === 'array' ||
			prop.type === 'array' ||
			prop.multiple ||
			prop.arrayItem ||
			prop.items,
		);
		const defName = this.resolveDefinitionName(prop, isArray);
		if (defName) {
			const entry = this.getDefinitionEntry(defName, 'definition');
			return isArray ? [] : this.buildDefaultDefinitionValue(entry);
		}
		if (prop.enum && prop.enum.length) return prop.enum[0];
		switch (prop.type) {
			case 'number':
				return 0;
			case 'boolean':
				return false;
			case 'color':
				return '#000000';
			case 'array':
				return [];
			case 'object':
				return {};
			default:
				return '';
		}
	}

	private buildDefaultDefinitionValue(entry?: ICgEventsSchemaEntry) {
		const result: Record<string, any> = {};
		if (!entry) return result;

		const allProps = this.getProperties(entry, {});

		// Build a map of parent properties and their children
		const childrenMap: Record<string, ICgEventsSchemaProperty[]> = {};
		const parentProps: Set<string> = new Set();

		allProps.forEach((prop) => {
			if (prop && prop.parent) {
				const parentKey = prop.parent;
				if (!childrenMap[parentKey]) childrenMap[parentKey] = [];
				childrenMap[parentKey].push(prop);
				parentProps.add(parentKey);
			}
		});

		// Process all properties
		for (const prop of allProps) {
			// Skip child properties (they'll be nested under their parents)
			if (prop.parent) continue;

			const value = this.getDefaultValueForProp(prop);

			// If this property has children, create nested object
			if (childrenMap[prop.key] && childrenMap[prop.key].length > 0) {
				const nestedObj: Record<string, any> = {};
				for (const child of childrenMap[prop.key]) {
					const childValue = this.getDefaultValueForProp(child);
					if (childValue !== undefined) {
						nestedObj[child.key] = childValue;
					}
				}
				result[prop.key] = nestedObj;
			} else if (value !== undefined) {
				result[prop.key] = value;
			}
		}
		return result;
	}

	private getGridSpan(prop: ICgEventsSchemaProperty): number | undefined {
		const rawGridOptions: unknown = prop.gridOptions;
		if (typeof rawGridOptions === 'number' && Number.isFinite(rawGridOptions)) {
			return rawGridOptions;
		}
		const spanRaw = prop.gridColumns ?? prop.span ?? prop.gridSpan;
		if (typeof spanRaw === 'number' && Number.isFinite(spanRaw)) {
			return spanRaw;
		}
		if (typeof spanRaw === 'string' && spanRaw.trim()) {
			const parsed = Number(spanRaw);
			return Number.isFinite(parsed) ? parsed : undefined;
		}
		return undefined;
	}

	private getLayoutClasses(prop: ICgEventsSchemaProperty, useGridLayout: boolean, forceFullWidth = false): string {
		const classes: string[] = [];
		const fieldClass = this.getFieldClass(prop);
		if (fieldClass) classes.push(fieldClass);
		if (forceFullWidth && !classes.includes('cgenh-config-field--fullwidth')) {
			classes.push('cgenh-config-field--fullwidth');
		}
		if (useGridLayout) {
			const span = forceFullWidth ? 12 : this.getGridSpan(prop);
			classes.push(getResponsiveGridClasses(span));
		} else {
			classes.push(getResponsiveGridClasses(undefined));
			const indentClass = getIndentClass(prop.indent);
			if (indentClass) classes.push(indentClass);
		}
		return classes.filter(Boolean).join(' ');
	}

	// Property-only: resolve format, falling back to declared type/array item
	private getPropertyFormat(prop: ICgEventsSchemaProperty): string | undefined {
		const explicitFormat = typeof prop.format === 'string' && prop.format.trim() ? prop.format.trim() : undefined;
		if (explicitFormat) {
			return explicitFormat;
		}
		if (prop.type === 'array') {
			const arrayType = typeof prop.arrayItem === 'string' && prop.arrayItem.trim()
				? prop.arrayItem.trim()
				: (typeof prop.items === 'object' && typeof prop.items?.type === 'string' && prop.items.type.trim()
					? prop.items.type.trim()
					: undefined);
			if (arrayType) {
				return arrayType;
			}
		}
		if (typeof prop.type === 'string' && prop.type.trim()) {
			return prop.type.trim();
		}
		return undefined;
	}

	private normalizeSchemaType(type: string): ICgEventsSchemaTypeSimple | 'array' {
		if (type === 'array' || type === 'number' || type === 'boolean' || type === 'string' || type === 'object' || type === 'color') {
			return type;
		}
		if (type === 'integer') {
			return 'number';
		}
		if (typeof type === 'string' && type.startsWith('#')) {
			// Types like "#/definitions/foo" are handled elsewhere as definitions, not primitives
			return undefined;
		}
		return undefined;
	}

	private getPrimitiveInputType(prop: ICgEventsSchemaProperty): PrimitiveInputType {
		const effectiveFormat = this.getPropertyFormat(prop);
		const formatRaw = typeof effectiveFormat === 'string' ? effectiveFormat.trim() : '';
		if (formatRaw && formatRaw !== 'CgEditorLayout') {
			if (formatRaw === 'json') return 'object';
			if (formatRaw === 'number') return 'number';
			if (formatRaw === 'boolean') return 'boolean';
			if (formatRaw === 'color') return 'color';
			if (formatRaw === 'object') return 'object';
			if (formatRaw === 'string' || formatRaw === 'textarea') return 'string';
			if (this.parseHelper(formatRaw, 'format')) return 'object';
		}
		const normalizedType = this.normalizeSchemaType(prop.type ?? formatRaw);
		if (formatRaw === 'json' || normalizedType === 'object') return 'object';
		if (normalizedType === 'number') return 'number';
		if (normalizedType === 'boolean') return 'boolean';
		if (normalizedType === 'color') return 'color';
		return 'string';
	}

	private getFieldClass(prop: ICgEventsSchemaProperty): string | undefined {
		const options = Array.isArray(prop.gridOptions) ? prop.gridOptions : [];
		const classes: string[] = [];
		if (options.includes('oneRow')) classes.push('cgenh-config-field--inline');
		if (options.includes('fullwidth')) classes.push('cgenh-config-field--fullwidth');
		return classes.length ? classes.join(' ') : undefined;
	}

	private parseHelper(
		helperValue: unknown,
		source: 'format' | 'helper',
		editorOptions: any = undefined,
		entryType: 'action' | 'trigger' | 'check' | 'definition' = 'definition',
		entryKey = '',
		propKey = '',
	): HelperInfo | null {
		if (typeof helperValue !== 'string' || !helperValue.trim()) return null;
		const raw = helperValue.trim();
		// Pattern 1: name:type(args)
		let match = raw.match(/^([^:]+):([^()]+)(?:\((.*)\))?$/);
		let name: string | undefined;
		let helperType: string | undefined;
		let argsSection = '';
		if (match) {
			[, name, helperType, argsSection = ''] = match;
		} else {
			// Pattern 2: name(args) or bare name (default helperType=edit)
			const simple = raw.match(/^([^():]+)(?:\((.*)\))?$/);
			if (!simple) return null;
			[, name, argsSection = ''] = simple;
			helperType = 'edit';
			// Heuristic: only treat bare names with at least one uppercase letter as helpers (skip "string", "textarea", etc.)
			if (name.toLowerCase() === name) return null;
		}
		const args: Record<string, string> = {};
		argsSection
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.forEach((pair) => {
				const [k, ...rest] = pair.split('=');
				if (k) {
					args[k.trim()] = rest.join('=').trim();
				}
			});
		return { name, helperType, args, raw, source, editorOptions, entryType, entryKey, propKey };
	}

	private isPropertyVisible(target: any, prop: ICgEventsSchemaProperty): boolean {
		if (!prop.visible || typeof prop.visible !== 'string') return true;
		const replaced = prop.visible.replace(/\{([^}]+)\}/g, (_, pathExpr) => {
			const value = this.getValueByPath(target, String(pathExpr ?? '').trim());
			if (value === undefined || value === null) return '';
			if (typeof value === 'string') return `${value}`;
			if (typeof value === 'number' || typeof value === 'boolean') return String(value);
			try {
				return JSON.stringify(value);
			} catch {
				return '';
			}
		});
		return modifier.isExpressionTrue(replaced, true);
	}

	private handleSave() {
		const nextConfigs = { ...(this.props.configs || {}) };
		nextConfigs[this.props.configKey] = this.state.config;
		this.props.onUpdate({ configs: nextConfigs });
		this.props.onClose();
	}

	private stringifyConfig(config: Record<string, any>) {
		try {
			return JSON.stringify(config ?? {}, null, 2);
		} catch {
			return '';
		}
	}

	private applyJsonText() {
		try {
			const parsed = JSON.parse(this.state.jsonText || '{}');
			this.setState({
				config: parsed,
				jsonText: this.stringifyConfig(parsed),
				jsonError: undefined,
				showJsonEditor: false,
			});
		} catch (e) {
			const err = e instanceof Error ? e.message : String(e);
			this.setState({ jsonError: err });
		}
	}

	private openJsonEditor() {
		this.setState({
			showJsonEditor: true,
			jsonError: undefined,
			jsonText: this.stringifyConfig(this.state.config),
		});
	}

	private handleJsonChange(text: string) {
		try {
			const parsed = JSON.parse(text || '{}');
			if (this.props.embedded && this.props.onUpdate) {
				this.pendingInternalUpdates++; // Increment counter
				this.props.onUpdate({ configs: { [this.props.configKey]: parsed } });
			}
			this.setState({ jsonText: text, config: parsed, jsonError: undefined });
		} catch (e) {
			const err = e instanceof Error ? e.message : String(e);
			this.setState({ jsonText: text, jsonError: err });
		}
	}

	private toggleJsonEditor() {
		this.setState((prev) => ({
			showJsonEditor: !prev.showJsonEditor,
			jsonError: undefined,
			jsonText: this.stringifyConfig(prev.config),
		}));
	}

	render() {
		const definition = this.getDefinitionEntry(this.props.configKey, this.props.schemaSection);
		const properties = this.getProperties(definition, this.state.config);
		const useGridLayout = definition?.format === 'grid';
		const title = definition?.label ? translateSchema(definition.label) ?? this.props.configKey : this.props.configKey;
		const description = definition?.description ? translateSchema(definition.description) : undefined;
		const showJsonButton = true;
		const isJson = this.state.showJsonEditor;
		const fields = (
			<ConfigsPanelFields
				target={this.state.config}
				properties={properties}
				path={this.rootPath}
				useGridLayout={useGridLayout}
				schema={this.props.schema}
				schemaSection={this.props.schemaSection}
				configKey={this.props.configKey}
				api={this.fieldApi}
				ConfigsPanelComponent={ConfigsPanel}
			/>
		);

		if (this.props.embedded) {
			if (!definition) return null;
			const showHeader = this.props.showHeader !== false;
			const containerClass = useGridLayout ? 'row g-2' : 'row g-2 cgenh-config-stack cgenh-config-stack--single';
			return (
				<div className="cgenh-config-field cgenh-config-field--definition">
					<div className="cgenh-config-field__header cgenh-config-field__header--toolbar">
						{showHeader && (
							<div>
								<p className="cgenh-config-field__label">{title}</p>
								{description && <p className="cgenh-config-field__hint">{description}</p>}
							</div>
						)}
						<Tooltip content={this.state.showJsonEditor ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}>
							<button
								type="button"
								className="cgenh-ghost cgenh-icon-btn"
								onClick={() => this.toggleJsonEditor()}
							>
								{this.state.showJsonEditor ? (
									<SvgListBox aria-hidden="true" />
								) : (
									<SvgCodeBrackets aria-hidden="true" />
								)}
							</button>
						</Tooltip>
					</div>
					{this.state.showJsonEditor ? (
						<MonacoEditorComponent
							value={this.state.jsonText}
							error={this.state.jsonError}
							onChange={(text: string) => this.handleJsonChange(text)}
							compact
						/>
					) : (
						<div className={containerClass}>
							{fields}
						</div>
					)}
				</div>
			);
		}

		return (
			<div className="cgenh-base-settings__panel cgenh-configs-panel__panel">
				<ConfigsPanelHeader title={title} onClose={this.props.onClose} />
				<ConfigsPanelBody className={this.state.showJsonEditor ? 'cgenh-base-settings__panel-body--json' : undefined}>
					{this.state.showJsonEditor ? (
						<MonacoEditorComponent
							value={this.state.jsonText}
							error={this.state.jsonError}
							onChange={(text: string) => this.handleJsonChange(text)}
							compact
							fill
						/>
					) : (
						<>
							{definition && properties.length > 0 ? (
								<>
									{description && <p className="cgenh-config-section__description">{description}</p>}
									<div className={useGridLayout ? 'row g-2' : 'row g-2 cgenh-config-stack cgenh-config-stack--single'}>
										{fields}
									</div>
								</>
							) : (
								<>
									{description && <p className="cgenh-config-section__description">{description}</p>}
									{properties.length === 0 && (
										<p className="cgenh-config-field__hint">{translation.validation.noSchemaProperties.getTrans()}</p>
									)}
									<div className={useGridLayout ? 'row g-2' : 'row g-2 cgenh-config-stack cgenh-config-stack--single'}>
										{fields}
									</div>
								</>
							)}
						</>
					)}
				</ConfigsPanelBody>
				<div className="cgenh-base-settings__form-actions cgenh-base-settings__panel-actions">
					<div className="cgenh-panel-actions__left">
						{showJsonButton && (
							<Tooltip content={isJson ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}>
								<button
									type="button"
									className="cgenh-ghost cgenh-icon-btn"
									onClick={() => this.toggleJsonEditor()}
								>
									{isJson ? (
										<SvgListBox aria-hidden="true" />
									) : (
										<SvgCodeBrackets aria-hidden="true" />
									)}
								</button>
							</Tooltip>
						)}
					</div>
					<div className="cgenh-panel-actions__right">
						<button type="button" onClick={this.handleSave}>{translation.common.save.getTrans()}</button>
						<button type="button" className="cgenh-secondary" onClick={this.props.onClose}>{translation.common.close.getTrans()}</button>
					</div>
				</div>
			</div>
		);
	}
}

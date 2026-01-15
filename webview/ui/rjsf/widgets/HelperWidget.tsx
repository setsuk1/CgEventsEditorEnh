import { WidgetProps } from '@rjsf/utils';
import { getSelectedLanguage } from '@shared';
import React from 'react';
import { HelperActionBar } from '../../components/helpers/HelperActionBar';
import { HelperSelectorModal } from '../../components/helpers/HelperSelectorModal';
import { HelperViewer } from '../../components/helpers/HelperViewer';
import { HelperInfo } from '../../components/inputs/PropertyElement';
import { DynamicStyle } from '../../utils/dynamicStyles';
import { coerceValueToSchemaType, isRecord } from '../utils/rjsfUtils';

interface HelperWidgetOptions {
	helper?: string;
	format?: string;
	editorOptions?: any;
	compact?: boolean;
	entryType?: 'action' | 'trigger' | 'check' | 'definition';
	entryKey?: string;
	propKey?: string;
}

interface HelperWidgetState {
	showSelector: boolean;
	pendingValue: any;
}

/**
 * Parse helper string into HelperInfo
 */
function parseHelper(
	helperValue: unknown,
	source: 'format' | 'helper',
	options: HelperWidgetOptions
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

	if (!name || !helperType) {
		return null;
	}

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

/**
 * Normalize helper selection value
 * @param payload The incoming value from helper
 * @param preserveArray If true, don't unwrap arrays (for array schema types)
 */
function normalizeSelection(payload: any, preserveArray = false): any {
	if (typeof payload === 'string') {
		const trimmed = payload.trim();
		if (
			(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
			(trimmed.startsWith('[') && trimmed.endsWith(']'))
		) {
			try {
				return JSON.parse(trimmed);
			} catch {
				return payload;
			}
		}
		return payload;
	}

	if (payload && typeof payload === 'object') {
		// Only unwrap arrays if we're NOT preserving them (for non-array schema types)
		if (Array.isArray(payload) && !preserveArray) {
			if (payload.length === 1) {
				return normalizeSelection(payload[0], preserveArray);
			}
			if (payload.length > 1) {
				const firstMeaningful = payload.find((p) => p && (p.code || p.config)) ?? payload[0];
				return normalizeSelection(firstMeaningful, preserveArray);
			}
		}

		// Handle wrapper objects (unwrap data/json/value properties)
		if (Object.prototype.hasOwnProperty.call(payload, '_overwrite')) {
			const inner = payload.data ?? payload.json;
			if (inner !== undefined) return normalizeSelection(inner, preserveArray);
		}

		const inner = payload.data ?? payload.json ?? payload.value;
		if (inner !== undefined) return normalizeSelection(inner, preserveArray);
	}

	return payload;
}

/**
 * Custom helper widget for RJSF - supports helper viewer and selector
 */
export class HelperWidget extends React.PureComponent<WidgetProps, HelperWidgetState> {
	private previewRef = React.createRef<HelperViewer>();
	private selectorRef = React.createRef<HelperViewer>();
	private previewStyle: DynamicStyle | null = null;
	private previewCss = '';

	constructor(props: WidgetProps) {
		super(props);
		this.state = {
			showSelector: false,
			pendingValue: undefined,
		};
	}

	componentWillUnmount(): void {
		this.previewStyle?.dispose();
		this.previewStyle = null;
	}

	private getLocale(): 'en' | 'zh' {
		const code = getSelectedLanguage()?.code;
		return code && code.startsWith('zh') ? 'zh' : 'en';
	}

	private getHelperOptions(): HelperWidgetOptions {
		const rawOptions = this.props.options;
		if (!isRecord(rawOptions)) {
			return {};
		}
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

	private getParsedValue() {
		const { value, schema } = this.props;
		const isStringTarget = schema.type === 'string';
		const effectiveValue = value ?? schema.default;
		if (isStringTarget && typeof effectiveValue === 'string') {
			try {
				return JSON.parse(effectiveValue);
			} catch {
				return effectiveValue;
			}
		}
		return effectiveValue;
	}

	private updatePreviewStyle(viewHelperInfo: HelperInfo | null) {
		const helperStyle: { width?: string; height?: string; border?: string; borderRadius?: string } = {};
		const helperArgs = viewHelperInfo?.args || {};
		if (helperArgs.width) helperStyle.width = helperArgs.width;
		if (helperArgs.height) helperStyle.height = helperArgs.height;
		if (helperArgs.border) helperStyle.border = helperArgs.border;
		if (helperArgs.borderRadius) helperStyle.borderRadius = helperArgs.borderRadius;

		const helperName = viewHelperInfo?.name?.toLowerCase?.() || '';
		if (helperName.includes('cgeditorlayout')) {
			helperStyle.width = '100%';
			helperStyle.height = helperStyle.height || '720px';
		}
		const widthValue = helperStyle.width || '100%';
		const heightValue = helperStyle.height || '64px';
		const cssParts = [
			`width: ${widthValue};`,
			`height: ${heightValue};`,
		];
		if (helperStyle.border) {
			cssParts.push(`border: ${helperStyle.border};`);
		}
		if (helperStyle.borderRadius) {
			cssParts.push(`border-radius: ${helperStyle.borderRadius};`);
		}
		const previewCss = cssParts.join(' ');
		if (this.previewCss !== previewCss) {
			if (!this.previewStyle) {
				this.previewStyle = new DynamicStyle('cgenh-helper-preview');
			}
			this.previewStyle.update(previewCss);
			this.previewCss = previewCss;
		}
		const className = this.previewStyle ? this.previewStyle.className : '';
		return { widthValue, heightValue, helperName, className };
	}

	private handleSelect = (incoming: any) => {
		const { schema, onChange, id, onBlur } = this.props;
		const isStringTarget = schema.type === 'string';
		const isArrayTarget = schema.type === 'array';
		const parsedValue = this.getParsedValue();
		const preserveArraySelection = isArrayTarget || Array.isArray(parsedValue);
		const fromHelper = normalizeSelection(
			incoming && incoming.data && incoming.data.data !== undefined ? incoming.data.data : incoming,
			preserveArraySelection
		);
		this.previewRef.current?.refreshWithValue(fromHelper);
		let outgoing = fromHelper;
		if (isStringTarget && fromHelper !== null && fromHelper !== undefined && typeof fromHelper === 'object') {
			outgoing = JSON.stringify(fromHelper);
		} else {
			outgoing = coerceValueToSchemaType(outgoing, schema.type);
		}
		onChange(outgoing);
		this.setState({ showSelector: false, pendingValue: undefined }, () => {
			if (typeof onBlur === 'function' && typeof id === 'string' && id) {
				setTimeout(() => onBlur(id, outgoing), 0);
			}
		});
	};

	private openSelector = () => {
		this.setState({ showSelector: true, pendingValue: this.getParsedValue() });
	};

	private closeSelector = () => {
		this.setState({ showSelector: false, pendingValue: undefined });
	};

	private confirmSelector = () => {
		this.selectorRef.current?.requestJson();
	};

	render() {
		const { value, disabled, readonly, schema } = this.props;
		const widgetOptions = this.getHelperOptions();
		const locale = this.getLocale();
		const parsedValue = this.getParsedValue();
		const preserveArraySelection = schema.type === 'array' || Array.isArray(parsedValue);
		const selectHelperInfo = parseHelper(widgetOptions.helper, 'helper', widgetOptions);
		const viewHelperInfo = parseHelper(widgetOptions.format, 'format', widgetOptions);
		const selectionEnabled = !disabled && !readonly && !!selectHelperInfo;
		if (widgetOptions.compact) {
			if (!selectHelperInfo) {
				return null;
			}
			return (
				<div className="cgenh-helper-field">
					<HelperActionBar
						selectionEnabled={selectionEnabled}
						onOpen={this.openSelector}
					/>
					<HelperSelectorModal
						open={this.state.showSelector}
						selectHelperInfo={selectHelperInfo}
						locale={locale}
						pendingValue={this.state.pendingValue}
						value={parsedValue}
						preserveArraySelection={preserveArraySelection}
						selectorRef={this.selectorRef}
						onClose={this.closeSelector}
						onConfirm={this.confirmSelector}
						onSelect={this.handleSelect}
					/>
				</div>
			);
		}
		const { widthValue, heightValue, helperName, className } = this.updatePreviewStyle(viewHelperInfo);
		const tightActions = selectionEnabled && !!viewHelperInfo && widthValue.trim() !== '100%';
		const previewClassName = tightActions ? 'cgenh-helper-field__preview cgenh-helper-field__preview--tight' : 'cgenh-helper-field__preview';

		const preview =
			parsedValue === undefined || parsedValue === null
				? '--'
				: typeof parsedValue === 'string'
					? parsedValue
					: JSON.stringify(parsedValue);

		return (
			<div className={helperName.includes('cgeditorlayout') ? 'cgenh-helper-field cgenh-helper-field--fullwidth' : 'cgenh-helper-field'}>
				<div className="cgenh-helper-field__layout">
					<div className={previewClassName}>
						{viewHelperInfo ? (
							<div className={`cgenh-helper-field__viewer ${className}`}>
								<HelperViewer
									ref={this.previewRef}
									helperInfo={viewHelperInfo}
									locale={locale}
									value={parsedValue}
									frameHeight={heightValue}
								/>
							</div>
						) : (
							<div className="border rounded p-2 bg-body-tertiary font-monospace small text-break">
								{preview}
							</div>
						)}
					</div>
					<div className="cgenh-helper-field__actions">
						<HelperActionBar
							selectionEnabled={selectionEnabled}
							onOpen={this.openSelector}
						/>
					</div>
				</div>
				<HelperSelectorModal
					open={this.state.showSelector}
					selectHelperInfo={selectHelperInfo}
					locale={locale}
					pendingValue={this.state.pendingValue}
					value={parsedValue}
					preserveArraySelection={preserveArraySelection}
					selectorRef={this.selectorRef}
					onClose={this.closeSelector}
					onConfirm={this.confirmSelector}
					onSelect={this.handleSelect}
				/>
			</div>
		);
	}
}

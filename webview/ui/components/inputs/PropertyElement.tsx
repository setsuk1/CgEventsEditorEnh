import { ICgEventsSchema, getSelectedLanguage } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SvgCheckmark } from '../../svg/SvgCheckmark';
import { DynamicStyle } from '../../utils/dynamicStyles';
import { resolveSuggestions } from '../../utils/suggestionResolver';
import { InfoTooltip } from '../common/InfoTooltip';
import { Tooltip } from '../common/Tooltip';
import { HelperActionBar } from '../helpers/HelperActionBar';
import { HelperSelectorModal } from '../helpers/HelperSelectorModal';
import { HelperViewer } from '../helpers/HelperViewer';
import { BooleanSelectField } from './BooleanSelectField';
import { ColorInputField } from './ColorInputField';
import { EnumSelectField } from './EnumSelectField';
import { OnChangeTextInput } from './OnChangeTextInput';

export type PrimitiveInputType = 'number' | 'boolean' | 'string' | 'object' | 'color';

export interface HelperInfo {
	name: string;
	helperType: string;
	args: Record<string, string>;
	raw: string;
	source: 'format' | 'helper';
	editorOptions?: any;
	entryType?: 'action' | 'trigger' | 'check' | 'definition';
	entryKey?: string;
	propKey?: string;
}

export interface PropertyElementProps {
	label: string;
	description?: string;
	type: PrimitiveInputType;
	value: any;
	defaultValue?: any;
	onChange(value: any): void;
	className?: string;
	enumValues?: Array<string | number | boolean>;
	enumTitles?: string[];
	textarea?: boolean;
	viewHelperInfo?: HelperInfo | null;
	selectHelperInfo?: HelperInfo | null;
	template?: string;
	valueType?: PrimitiveInputType;
	suggest?: any[];
	suggestTitles?: Record<string, any>;
	schema?: ICgEventsSchema;
	onHelperView?(info: HelperInfo, value: any): void;
	onHelperSelect?(info: HelperInfo, value: any): void;
	format?: string;
}

interface PropertyElementState {
	showSelector: boolean;
	pendingValue: any;
	numberError: boolean;
}

export class PropertyElementComponent extends React.PureComponent<PropertyElementProps, PropertyElementState> {
	private helperPreviewStyle?: DynamicStyle;
	private helperPreviewCss = '';

	state = {
		showSelector: false,
		pendingValue: undefined,
		numberError: false,
	};

	private handleDraftChange = (raw: any) => {
		const nextError = this.computeNumberError(raw);
		if (nextError !== this.state.numberError) {
			this.setState({ numberError: nextError });
		}
	};

	private getEffectiveLocale(): 'en' | 'zh' {
		const code = getSelectedLanguage()?.code;
		return code && code.startsWith('zh') ? 'zh' : 'en';
	}

	private resolveTargetType(): string | undefined {
		const format = typeof this.props.format === 'string' && this.props.format.trim() ? this.props.format.trim() : undefined;
		return format ?? this.props.valueType ?? this.props.type;
	}

	private computeNumberError(value: any): boolean {
		const targetType = this.resolveTargetType();
		const isNumberTarget = targetType === 'number' || targetType === 'integer';
		if (!isNumberTarget) return false;
		if (value === undefined || value === null || value === '') return false;
		const num = Number(value);
		return !Number.isFinite(num);
	}

	private normalizeSelection(payload: any): any {
		const helperType = (this.props.selectHelperInfo?.helperType || this.props.viewHelperInfo?.helperType || '').toLowerCase();
		const isCustomWeapon =
			helperType.includes('customweapon') ||
			helperType.includes('customfarweapon') ||
			helperType.includes('customthrowableweapon') ||
			helperType.includes('editweapon') ||
			helperType.includes('editfarweapon') ||
			helperType.includes('editthrowableweapon');
		if (typeof payload === 'string') {
			const trimmed = payload.trim();
			if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
				try {
					payload = JSON.parse(trimmed);
				} catch {
					return payload;
				}
			} else {
				// For custom weapon editors returning a code string, wrap into object with prior config if available.
				if (isCustomWeapon) {
					const existingConfig = this.props.value?.config ?? {};
					return { code: trimmed, config: existingConfig };
				}
				return payload;
			}
		}
		if (payload && typeof payload === 'object') {
			if (Array.isArray(payload) && payload.length === 1) {
				return this.normalizeSelection(payload[0]);
			}
			if (Array.isArray(payload) && payload.length > 1) {
				const firstMeaningful = payload.find((p) => p && (p.code || p.config)) ?? payload[0];
				return this.normalizeSelection(firstMeaningful);
			}
			// If helper returns bare weapon config while current value wraps {code, config}, preserve existing code
			const looksLikeWeaponConfig =
				payload?.damage !== undefined ||
				payload?.swapTime !== undefined ||
				payload?.frameName !== undefined ||
				payload?.type === 'close' ||
				payload?.type === 'far' ||
				payload?.type === 'throwable';
			if (looksLikeWeaponConfig) {
				const currentCode = this.props.value?.code ?? this.props.defaultValue?.code ?? '';
				if (payload.code === undefined && payload.config === undefined) {
					return { code: currentCode, config: payload };
				}
			}
			if (Object.prototype.hasOwnProperty.call(payload, '_overwrite')) {
				const inner = payload.data ?? payload.json;
				if (inner !== undefined) return this.normalizeSelection(inner);
			}
			const inner = payload.data ?? payload.json ?? payload.value;
			if (inner !== undefined) return this.normalizeSelection(inner);
		}
		return payload;
	}

	private applyHelperTemplate(value: any): any {
		const template = this.props.template;
		if (!template) return value;

		console.log('[PropertyElement] applyHelperTemplate template/value', template, value);
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

		const filled = template.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
			const val = getPathVal(value, key);
			console.log('[PropertyElement] applyHelperTemplate key->val', key, val);
			return val === undefined || val === null ? '' : String(val);
		});

		console.log('[PropertyElement] applyHelperTemplate filled', filled);
		return filled;
	}

	private previewRef = React.createRef<HelperViewer>();
	private selectorRef = React.createRef<HelperViewer>();

	componentDidMount(): void {
		winEE.on('message', this.handleHelperMessage, this);
		// Initial validation based on provided value/default
		const initialError = this.computeNumberError(this.props.value ?? this.props.defaultValue);
		if (initialError !== this.state.numberError) {
			this.setState({ numberError: initialError });
		}
	}

	componentDidUpdate(prevProps: PropertyElementProps): void {
		// Don't refresh preview if selector is open to avoid disrupting user interaction
		if (this.state.showSelector) {
			return;
		}

		// If the underlying value changes externally, refresh the helper preview.
		if (
			this.props.type === 'object' &&
			this.props.viewHelperInfo &&
			this.previewRef.current &&
			this.props.value !== prevProps.value
		) {
			console.log('[PropertyElement] componentDidUpdate refreshing preview', this.props.value);
			this.previewRef.current.refreshWithValue(this.props.value ?? this.props.defaultValue);
		}

		// Sync number error when external value changes
		if (
			this.props.value !== prevProps.value ||
			this.props.format !== prevProps.format ||
			this.props.valueType !== prevProps.valueType ||
			this.props.type !== prevProps.type
		) {
			const nextError = this.computeNumberError(this.props.value ?? this.props.defaultValue);
			if (nextError !== this.state.numberError) {
				this.setState({ numberError: nextError });
			}
		}
	}

	componentWillUnmount(): void {
		winEE.off('message', this.handleHelperMessage, this);
		this.helperPreviewStyle?.dispose();
	}

	private updateHelperPreviewStyle(cssText: string) {
		if (!this.helperPreviewStyle) {
			this.helperPreviewStyle = new DynamicStyle('cgenh-helper-preview');
		}
		if (this.helperPreviewCss !== cssText) {
			this.helperPreviewCss = cssText;
			this.helperPreviewStyle.update(cssText);
		}
	}

	private handleHelperMessage = (event: MessageEvent) => {
		if (!event?.data || typeof event.data !== 'object') return;
		const data = event.data;
		console.log('[PropertyElement] helper message', data);
		if (data.type === 'helperSelect' || data.type === 'postJson') {
			const nextValue = this.normalizeSelection(data.value ?? data.data);
			console.log('[PropertyElement] helper normalized', nextValue);
			if (nextValue !== undefined) {
				this.props.onChange(nextValue);
				// Keep preview in sync with the raw helper selection (template is for stored value, not display)
				this.previewRef?.current?.refreshWithValue(nextValue);
				this.setState({ showSelector: false, pendingValue: undefined });
			}
		}
	};

	private handleChange = (raw: any) => {
		const targetType = this.resolveTargetType();
		console.log('[PropertyElement] handleChange type/raw', targetType, raw);

		// Always keep raw input; only coerce for booleans, never block numbers.
		let nextValue: any = raw;
		if (targetType === 'boolean') {
			if (typeof raw === 'boolean') {
				nextValue = raw;
			} else {
				const str = String(raw).toLowerCase();
				if (str === 'true') nextValue = true;
				else if (str === 'false') nextValue = false;
			}
		}

		const nextError = this.computeNumberError(raw);
		if (nextError !== this.state.numberError) {
			this.setState({ numberError: nextError });
		}

		this.props.onChange(nextValue);
	};

	private renderControl() {
		const {
			type,
			value,
			defaultValue,
			enumValues,
			enumTitles,
			textarea,
			onChange,
			viewHelperInfo,
			selectHelperInfo,
			suggest,
			suggestTitles,
			schema,
		} = this.props;
		const format = typeof this.props.format === 'string' ? this.props.format.trim().toLowerCase() : '';
		const wantsEnumSelect = format === 'enum';
		const effectiveValue = value ?? defaultValue;
		const events = editor.getEvents();
		const resources = editor.getResources();
		const sources = editor.getSources();
		const items = editor.getItems();
		const cgapp = editor.getCgApp();
		const effectiveLocale = this.getEffectiveLocale();

		if (enumValues && enumValues.length) {
			return <EnumSelectField value={effectiveValue} enumValues={enumValues} enumTitles={enumTitles} onChange={onChange} />;
		}

		if (wantsEnumSelect && suggest?.length) {
			const suggestions = resolveSuggestions(suggest, suggestTitles, schema, events, items, cgapp, resources, sources);
			if (suggestions.length) {
				const enumValuesFromSuggest = suggestions.map((entry) => entry.value);
				const enumTitlesFromSuggest = suggestions.map((entry) => entry.label);
				return (
					<EnumSelectField
						value={effectiveValue}
						enumValues={enumValuesFromSuggest}
						enumTitles={enumTitlesFromSuggest}
						onChange={onChange}
					/>
				);
			}
		}

		if (type === 'string' && !textarea && suggest?.length) {
			const suggestions = resolveSuggestions(suggest, suggestTitles, schema, events, items, cgapp, resources, sources);
			return (
				<div>
					<OnChangeTextInput
						value={effectiveValue}
						textarea={textarea}
						onChange={(next) => this.handleChange(next)}
						onDraftChange={(next) => this.handleDraftChange(next)}
						suggestions={suggestions}
					/>
				</div>
			);
		}

		if (type === 'boolean') {
			if (!this.props.format || this.props.format === 'boolean') {
				const { label, description } = this.props;
				return (
					<div className="cgenh-config-field__checkbox-row">
						<input
							type="checkbox"
							checked={!!effectiveValue}
							onChange={(e) => this.handleChange(e.target.checked)}
							className="cgenh-config-field__checkbox-input"
						/>
						<div
							className="cgenh-config-field__label-container"
							onClick={() => this.handleChange(!effectiveValue)}
							role="button"
						>
							<span className="cgenh-config-field__label cgenh-config-field__label--inline">
								{label}
							</span>
							{description && <InfoTooltip description={description} />}
						</div>
					</div>
				);
			}
			return (
				<BooleanSelectField
					value={effectiveValue}
					onChange={(next) => this.handleChange(String(next))}
				/>
			);
		}

		if (type === 'color') {
			return <ColorInputField value={effectiveValue} onChange={(next) => onChange(next)} />;
		}

		if (type === 'object') {
			const preview =
				effectiveValue === undefined || effectiveValue === null
					? '--'
					: typeof effectiveValue === 'string'
						? effectiveValue
						: JSON.stringify(effectiveValue);
			const openSelector = () =>
				this.setState({
					showSelector: true,
					pendingValue: effectiveValue,
				});
			const handleSelect = (incoming: any) => {
				console.log('[PropertyElement] handleSelect incoming', incoming);
				const fromHelper = this.normalizeSelection(
					incoming && incoming.data && incoming.data.data !== undefined ? incoming.data.data : incoming
				);
				console.log('[PropertyElement] handleSelect normalized', fromHelper);
				this.previewRef.current.refreshWithValue(fromHelper);
				this.handleChange(fromHelper);
				this.setState({ showSelector: false, pendingValue: fromHelper });
			};
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
			this.updateHelperPreviewStyle(cssParts.join(' '));
			const previewClassName = this.helperPreviewStyle ? this.helperPreviewStyle.className : '';
			return (
				<div
					className={helperName.includes('cgeditorlayout') ? 'cgenh-helper-field cgenh-helper-field--fullwidth' : 'cgenh-helper-field'}
				>
					<div className="cgenh-helper-field__layout">
						<div className="cgenh-helper-field__preview">
							{viewHelperInfo ? (
								<div className={`cgenh-helper-field__viewer ${previewClassName}`}>
									<HelperViewer
										ref={this.previewRef}
										helperInfo={viewHelperInfo}
										locale={effectiveLocale}
										value={effectiveValue}
										frameHeight={heightValue}
									/>
								</div>
							) : (
								<div>{preview}</div>
							)}
						</div>
						<div className="cgenh-helper-field__actions">
							<HelperActionBar selectionEnabled={!!selectHelperInfo} onOpen={openSelector} />
						</div>
					</div>
					<HelperSelectorModal
						open={this.state.showSelector}
						selectHelperInfo={selectHelperInfo}
						locale={effectiveLocale}
						pendingValue={this.state.pendingValue}
						value={effectiveValue}
						selectorRef={this.selectorRef}
						onClose={() => this.setState({ showSelector: false, pendingValue: undefined })}
						onConfirm={() => this.selectorRef.current.requestJson()}
						onSelect={handleSelect}
					/>
				</div>
			);
		}

		return (
			<OnChangeTextInput
				value={effectiveValue}
				textarea={textarea}
				onChange={(next) => this.handleChange(next)}
				onDraftChange={(next) => this.handleDraftChange(next)}
			/>
		);
	}

	render() {
		const { label, description, className, viewHelperInfo, selectHelperInfo, type, format } = this.props;
		const effectiveLocale = this.getEffectiveLocale();
		const isCheckbox = type === 'boolean' && (!format || format === 'boolean');
		const effectiveValue = this.props.value ?? this.props.defaultValue;
		const showNumberError = this.state.numberError || this.computeNumberError(effectiveValue);
		return (
			<div className={['cgenh-config-field', className ?? ''].filter(Boolean).join(' ')}>
				{!isCheckbox && (
					<div className="cgenh-config-field__label-container">
						<p className="cgenh-config-field__label">{label}</p>
						{description && <InfoTooltip description={description} />}
					</div>
				)}
				{this.renderControl()}
				{showNumberError && (
					<p className="cgenh-config-field__hint cgenh-config-field__hint--error">
						{translation.validation.numberFormatError.getTrans()}
					</p>
				)}
				{this.props.type !== 'object' && (viewHelperInfo || selectHelperInfo) && this.props.onHelperSelect && (
					<div className="cgenh-config-field__helper-actions">
						{selectHelperInfo && this.props.onHelperSelect && (
							<Tooltip content={translation.common.apply.getTrans()}>
								<button
									type="button"
									className="cgenh-icon-btn"
									onClick={() => this.props.onHelperSelect?.(selectHelperInfo, this.props.value)}
								>
									<SvgCheckmark aria-hidden="true" />
								</button>
							</Tooltip>
						)}
					</div>
				)}
			</div>
		);
	}
}

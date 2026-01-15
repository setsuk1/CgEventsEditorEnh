import type { ICgEventsSchema, ICgEventsSchemaEntry, ICgEventsSchemaProperty } from '@shared';
import { getSelectedLanguage, translateSchema } from '@shared';
import React from 'react';
import type { ConfigsPanelFieldApi, EmbeddedConfigsPanelComponentProps, SchemaSection } from './ConfigsPanelTypes';
import { translation } from '../../../trans/Trans';
import { HelperActionBar } from '../helpers/HelperActionBar';
import { HelperSelectorModal } from '../helpers/HelperSelectorModal';
import { HelperViewer } from '../helpers/HelperViewer';

const EMPTY_OBJECT: Record<string, any> = {};

interface EmbeddedDefinitionPanelProps {
	ConfigsPanelComponent: React.ComponentType<EmbeddedConfigsPanelComponentProps>;
	schema?: ICgEventsSchema;
	definitionName: string;
	value: any;
	onValueChange(nextValue: any): void;
}

export class EmbeddedDefinitionPanel extends React.PureComponent<EmbeddedDefinitionPanelProps> {
	private lastDefinitionName: string | null = null;
	private lastValue: any = null;
	private cachedConfigs: Record<string, any> = {};

	private readonly handleUpdate = this.handleUpdateInternal.bind(this);
	private readonly handleClose = this.handleCloseInternal.bind(this);

	private handleCloseInternal(): void {
	}

	private getConfigsValue() {
		const normalizedValue = this.props.value && typeof this.props.value === 'object' && !Array.isArray(this.props.value)
			? this.props.value
			: EMPTY_OBJECT;
		if (this.lastDefinitionName === this.props.definitionName && this.lastValue === normalizedValue) {
			return this.cachedConfigs;
		}
		this.lastDefinitionName = this.props.definitionName;
		this.lastValue = normalizedValue;
		this.cachedConfigs = { [this.props.definitionName]: normalizedValue };
		return this.cachedConfigs;
	}

	private handleUpdateInternal(patch: Record<string, any>) {
		const configs = patch?.configs;
		if (!configs || !Object.prototype.hasOwnProperty.call(configs, this.props.definitionName)) return;
		this.props.onValueChange(configs[this.props.definitionName]);
	}

	render() {
		return (
			<this.props.ConfigsPanelComponent
				embedded
				showHeader={false}
				schema={this.props.schema}
				schemaSection="definition"
				configs={this.getConfigsValue()}
				configKey={this.props.definitionName}
				onUpdate={this.handleUpdate}
				onClose={this.handleClose}
			/>
		);
	}
}

interface ConfigsPanelDefinitionFieldProps {
	target: any;
	prop: ICgEventsSchemaProperty;
	definitionName: string;
	path: Array<string | number>;
	useGridLayout: boolean;
	schema?: ICgEventsSchema;
	schemaSection?: SchemaSection;
	configKey: string;
	api: ConfigsPanelFieldApi;
	ConfigsPanelComponent: React.ComponentType<EmbeddedConfigsPanelComponentProps>;
}

interface ConfigsPanelDefinitionFieldState {
	helperOpen: boolean;
	helperPendingValue?: any;
}

export class ConfigsPanelDefinitionField extends React.PureComponent<ConfigsPanelDefinitionFieldProps, ConfigsPanelDefinitionFieldState> {
	state: ConfigsPanelDefinitionFieldState = {
		helperOpen: false,
		helperPendingValue: undefined,
	};

	private readonly helperRef = React.createRef<HelperViewer>();
	private readonly handleOpenHelper = this.handleOpenHelperInternal.bind(this);
	private readonly handleCloseHelper = this.handleCloseHelperInternal.bind(this);
	private readonly handleConfirmHelper = this.handleConfirmHelperInternal.bind(this);
	private readonly handleSelectHelper = this.handleSelectHelperInternal.bind(this);
	private readonly handleNestedChange = this.handleNestedChangeInternal.bind(this);

	private handleOpenHelperInternal() {
		this.setState({ helperOpen: true, helperPendingValue: this.getValue() });
	}

	private handleCloseHelperInternal() {
		this.setState({ helperOpen: false, helperPendingValue: undefined });
	}

	private handleConfirmHelperInternal() {
		this.helperRef.current?.requestJson();
	}

	private handleSelectHelperInternal(incoming: any) {
		const normalized = incoming?.data ?? incoming;
		this.props.api.updateValue([...this.props.path, this.props.prop.key], normalized);
		this.setState({ helperOpen: false, helperPendingValue: undefined });
	}

	private handleNestedChangeInternal(nextValue: any) {
		this.props.api.updateValue([...this.props.path, this.props.prop.key], nextValue);
	}

	private getValue(): any {
		const raw = this.props.target?.[this.props.prop.key];
		return raw && typeof raw === 'object' ? raw : EMPTY_OBJECT;
	}

	private getDefinitionEntry(): ICgEventsSchemaEntry | undefined {
		return this.props.api.getDefinitionEntry(this.props.definitionName, 'definition');
	}

	render() {
		const layoutClassName = this.props.api.getLayoutClasses(this.props.prop, this.props.useGridLayout);
		const definition = this.getDefinitionEntry();
		if (!definition) {
			return (
				<div className="cgenh-config-field cgenh-config-field--missing">
					<p className="cgenh-config-field__label">{this.props.prop.key}</p>
					<p className="cgenh-config-field__hint">
						{translation.validation.missingDefinition.getTrans()}: {this.props.definitionName}
					</p>
				</div>
			);
		}

		const value = this.getValue();
		const propLabel = this.props.prop.label ? translateSchema(this.props.prop.label) : undefined;
		const defLabel = definition.label ? translateSchema(definition.label) : undefined;
		const heading = propLabel ?? defLabel ?? this.props.prop.key;
		const description = (this.props.prop.description ? translateSchema(this.props.prop.description) : undefined)
			?? (definition.description ? translateSchema(definition.description) : undefined);

		const propHelper = this.props.prop.helper;
		const selectHelperInfo = propHelper ? this.props.api.parseHelper(
			propHelper,
			'helper',
			this.props.prop.editorOptions,
			this.props.schemaSection ?? 'definition',
			this.props.configKey,
			this.props.prop.key,
		) : null;

		const selectedLang = getSelectedLanguage();
		const helperLocale = selectedLang?.code?.startsWith('zh') ? 'zh' : 'en';

		return (
			<div className={`cgenh-config-field cgenh-config-field--definition ${layoutClassName}`}>
				<div className="cgenh-definition-card__header">
					<div className="cgenh-config-field__label-container">
						<p className="cgenh-config-field__label">{heading}</p>
						{description && (
							<div className="cgenh-config-field__info-icon">
								<span>i</span>
								<div className="cgenh-config-field__tooltip">{description}</div>
							</div>
						)}
					</div>
					{selectHelperInfo && (
						<div className="cgenh-config-field__helper-stack">
							<HelperActionBar selectionEnabled={true} onOpen={this.handleOpenHelper} />
						</div>
					)}
				</div>
				<div className="cgenh-definition-card">
					<div className="cgenh-definition-card__body cgenh-definition-card__body--visible">
						<EmbeddedDefinitionPanel
							ConfigsPanelComponent={this.props.ConfigsPanelComponent}
							schema={this.props.schema}
							definitionName={this.props.definitionName}
							value={value}
							onValueChange={this.handleNestedChange}
						/>
					</div>
				</div>
				{selectHelperInfo && (
					<HelperSelectorModal
						open={this.state.helperOpen}
						selectHelperInfo={selectHelperInfo}
						locale={helperLocale}
						pendingValue={this.state.helperPendingValue ?? value}
						value={value}
						selectorRef={this.helperRef}
						onClose={this.handleCloseHelper}
						onConfirm={this.handleConfirmHelper}
						onSelect={this.handleSelectHelper}
					/>
				)}
			</div>
		);
	}
}

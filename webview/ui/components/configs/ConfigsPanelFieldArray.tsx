import type { ICgEventsSchema, ICgEventsSchemaProperty } from '@shared';
import { translateSchema } from '@shared';
import React from 'react';
import type { ConfigsPanelFieldApi, EmbeddedConfigsPanelComponentProps, SchemaSection } from './ConfigsPanelTypes';
import { translation } from '../../../trans/Trans';
import { SvgPlus } from '../../svg/SvgPlus';
import { InfoTooltip } from '../common/InfoTooltip';
import { Tooltip } from '../common/Tooltip';
import { DefinitionCard } from './DefinitionCard';
import { EmbeddedDefinitionPanel } from './ConfigsPanelFieldDefinition';
import { PropertyElementComponent, type PrimitiveInputType } from '../inputs/PropertyElement';

const EMPTY_OBJECT: Record<string, any> = {};

interface ConfigsPanelArrayFieldProps {
	target: any;
	prop: ICgEventsSchemaProperty;
	path: Array<string | number>;
	useGridLayout: boolean;
	schema?: ICgEventsSchema;
	schemaSection?: SchemaSection;
	configKey: string;
	api: ConfigsPanelFieldApi;
	ConfigsPanelComponent: React.ComponentType<EmbeddedConfigsPanelComponentProps>;
	definitionName?: string;
	scopeProps: ICgEventsSchemaProperty[];
}

interface ConfigsPanelArrayPrimitiveItemProps {
	label: string;
	description?: string;
	index: number;
	value: any;
	format?: string;
	type: PrimitiveInputType;
	onChangeItem(index: number, nextValue: any): void;
	onRemoveItem(index: number): void;
}

class ConfigsPanelArrayPrimitiveItem extends React.PureComponent<ConfigsPanelArrayPrimitiveItemProps> {
	private readonly handleChange = this.handleChangeInternal.bind(this);
	private readonly handleRemove = this.handleRemoveInternal.bind(this);

	private handleChangeInternal(nextValue: any) {
		this.props.onChangeItem(this.props.index, nextValue);
	}

	private handleRemoveInternal() {
		this.props.onRemoveItem(this.props.index);
	}

	render() {
		return (
			<div className="cgenh-config-field__list-row">
				<PropertyElementComponent
					label={`${this.props.label} ${this.props.index + 1}`}
					description={this.props.description}
					type={this.props.type}
					value={this.props.value}
					onChange={this.handleChange}
					className="cgenh-config-field__list-item"
					valueType={this.props.type}
					format={this.props.format}
				/>
				<button type="button" className="cgenh-ghost" onClick={this.handleRemove}>
					x
				</button>
			</div>
		);
	}
}

interface ConfigsPanelDefinitionArrayItemProps {
	ConfigsPanelComponent: React.ComponentType<EmbeddedConfigsPanelComponentProps>;
	schema?: ICgEventsSchema;
	label: string;
	definitionName: string;
	index: number;
	value: any;
	onChangeItem(index: number, nextValue: any): void;
	onRemoveItem(index: number): void;
}

class ConfigsPanelDefinitionArrayItem extends React.PureComponent<ConfigsPanelDefinitionArrayItemProps> {
	private readonly handleRemove = this.handleRemoveInternal.bind(this);
	private readonly handleValueChange = this.handleValueChangeInternal.bind(this);

	private handleRemoveInternal() {
		this.props.onRemoveItem(this.props.index);
	}

	private handleValueChangeInternal(nextValue: any) {
		this.props.onChangeItem(this.props.index, nextValue);
	}

	render() {
		return (
			<DefinitionCard
				title={`${this.props.label} #${this.props.index + 1}`}
				onRemove={this.handleRemove}
			>
				<EmbeddedDefinitionPanel
					ConfigsPanelComponent={this.props.ConfigsPanelComponent}
					schema={this.props.schema}
					definitionName={this.props.definitionName}
					value={this.props.value && typeof this.props.value === 'object' ? this.props.value : EMPTY_OBJECT}
					onValueChange={this.handleValueChange}
				/>
			</DefinitionCard>
		);
	}
}

export class ConfigsPanelArrayField extends React.PureComponent<ConfigsPanelArrayFieldProps> {
	private readonly handleAdd = this.handleAddInternal.bind(this);
	private readonly handleChangeItem = this.handleChangeItemInternal.bind(this);
	private readonly handleRemoveItem = this.handleRemoveItemInternal.bind(this);

	private getValues(): any[] {
		return Array.isArray(this.props.target?.[this.props.prop.key]) ? this.props.target[this.props.prop.key] : [];
	}

	private getItemProperty(): ICgEventsSchemaProperty {
		const rawItemType =
			(typeof this.props.prop.items === 'object' && typeof this.props.prop.items?.type === 'string' ? this.props.prop.items.type : undefined) ||
			(typeof this.props.prop.arrayItem === 'string' ? this.props.prop.arrayItem : undefined) ||
			this.props.prop.type;
		const itemType = typeof rawItemType === 'string' && rawItemType.trim() ? rawItemType.trim() : 'string';
		const normalizedItemType = this.props.api.normalizeSchemaType(itemType) ?? 'string';
		return { ...this.props.prop, type: normalizedItemType };
	}

	private handleChangeItemInternal(index: number, nextValue: any) {
		const values = this.getValues();
		const next = [...values];
		next[index] = nextValue;
		this.props.api.updateValue([...this.props.path, this.props.prop.key], next);
	}

	private handleAddInternal() {
		const values = this.getValues();
		const defEntry = this.props.definitionName ? this.props.api.getDefinitionEntry(this.props.definitionName, 'definition') : undefined;
		const itemProp = this.getItemProperty();
		const nextValue = defEntry
			? this.props.api.buildDefaultDefinitionValue(defEntry)
			: this.props.api.getDefaultValueForProp(itemProp);
		this.props.api.updateValue([...this.props.path, this.props.prop.key], [...values, nextValue]);
	}

	private handleRemoveItemInternal(index: number) {
		const values = this.getValues();
		const next = [...values];
		next.splice(index, 1);
		this.props.api.updateValue([...this.props.path, this.props.prop.key], next);
	}

	render() {
		const layoutClassName = this.props.api.getLayoutClasses(this.props.prop, this.props.useGridLayout);
		const values = this.getValues();

		const itemProp = this.getItemProperty();
		const label = (this.props.prop.label ? translateSchema(this.props.prop.label) : undefined) ?? this.props.prop.key;
		const description = this.props.prop.description ? translateSchema(this.props.prop.description) : undefined;
		const defEntry = this.props.definitionName ? this.props.api.getDefinitionEntry(this.props.definitionName, 'definition') : undefined;
		const itemFormat = this.props.api.getPropertyFormat(itemProp);
		const itemPropWithFormat: ICgEventsSchemaProperty = itemFormat ? { ...itemProp, format: itemFormat } : itemProp;
		const primitiveType = this.props.api.getPrimitiveInputType(itemPropWithFormat);

		if (this.props.definitionName && defEntry) {
			return (
				<div className={`cgenh-definition-list ${layoutClassName}`}>
					<div className="cgenh-config-field__label-container">
						<p className="cgenh-config-field__label">{label}</p>
						{description && <InfoTooltip description={description} />}
					</div>
					{values.length === 0 && <p className="cgenh-config-field__hint">{translation.validation.noItems.getTrans()}</p>}
					{values.map((entry: any, idx: number) => (
						<ConfigsPanelDefinitionArrayItem
							key={`${this.props.prop.key}-${idx}`}
							ConfigsPanelComponent={this.props.ConfigsPanelComponent}
							schema={this.props.schema}
							label={label}
							definitionName={this.props.definitionName ?? ''}
							index={idx}
							value={entry}
							onChangeItem={this.handleChangeItem}
							onRemoveItem={this.handleRemoveItem}
						/>
					))}
					<Tooltip content={translation.common.add.getTrans()}>
						<button type="button" className="cgenh-secondary cgenh-icon-btn cgenh-config-field__add-row" onClick={this.handleAdd}>
							<SvgPlus width={16} height={16} aria-hidden="true" />
						</button>
					</Tooltip>
				</div>
			);
		}

		return (
			<div className={`cgenh-config-field ${layoutClassName}`}>
				<div className="cgenh-config-field__label-container">
					<p className="cgenh-config-field__label">{label}</p>
					{description && <InfoTooltip description={description} />}
				</div>
				<div className="cgenh-config-field__list">
					{values.map((val: any, idx: number) => (
						<ConfigsPanelArrayPrimitiveItem
							key={`${this.props.prop.key}-${idx}`}
							label={label}
							description={description}
							index={idx}
							value={val}
							format={itemFormat ?? undefined}
							type={primitiveType}
							onChangeItem={this.handleChangeItem}
							onRemoveItem={this.handleRemoveItem}
						/>
					))}
					<Tooltip content={translation.common.add.getTrans()}>
						<button type="button" className="cgenh-secondary cgenh-icon-btn" onClick={this.handleAdd}>
							<SvgPlus width={16} height={16} aria-hidden="true" />
						</button>
					</Tooltip>
				</div>
			</div>
		);
	}
}

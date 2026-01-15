import type { ICgEventsSchema, ICgEventsSchemaProperty } from '@shared';
import { translateSchema } from '@shared';
import React from 'react';
import type { ConfigsPanelFieldApi, SchemaSection } from './ConfigsPanelTypes';
import { PropertyElementComponent } from '../inputs/PropertyElement';

interface ConfigsPanelElementFieldProps {
	target: any;
	prop: ICgEventsSchemaProperty;
	path: Array<string | number>;
	useGridLayout: boolean;
	scopeProps: ICgEventsSchemaProperty[];
	schema?: ICgEventsSchema;
	schemaSection?: SchemaSection;
	configKey: string;
	api: ConfigsPanelFieldApi;
}

export class ConfigsPanelElementField extends React.PureComponent<ConfigsPanelElementFieldProps> {
	private readonly handleChangeObject = this.handleChangeObjectInternal.bind(this);
	private readonly handleChangeEnum = this.handleChangeEnumInternal.bind(this);
	private readonly handleChangeJson = this.handleChangeJsonInternal.bind(this);
	private readonly handleChangePrimitive = this.handleChangePrimitiveInternal.bind(this);

	private handleChangeObjectInternal(next: any) {
		this.props.api.updateValueWithTemplates(this.props.target, this.props.path, this.props.prop.key, next, this.props.scopeProps);
	}

	private handleChangeEnumInternal(next: any) {
		this.props.api.updateValueWithTemplates(
			this.props.target,
			this.props.path,
			this.props.prop.key,
			this.props.api.coercePrimitive(String(next), this.props.prop),
			this.props.scopeProps,
		);
	}

	private handleChangeJsonInternal(raw: any) {
		try {
			this.props.api.updateValueWithTemplates(this.props.target, this.props.path, this.props.prop.key, JSON.parse(String(raw)), this.props.scopeProps);
		} catch {
			this.props.api.updateValueWithTemplates(this.props.target, this.props.path, this.props.prop.key, raw, this.props.scopeProps);
		}
	}

	private handleChangePrimitiveInternal(next: any) {
		const primitiveType = this.props.api.getPrimitiveInputType(this.props.prop);
		const valueToSet =
			primitiveType === 'number' || primitiveType === 'boolean'
				? this.props.api.coercePrimitive(String(next), this.props.prop)
				: next;
		this.props.api.updateValueWithTemplates(this.props.target, this.props.path, this.props.prop.key, valueToSet, this.props.scopeProps);
	}

	render() {
		const label = (this.props.prop.label ? translateSchema(this.props.prop.label) : undefined) ?? this.props.prop.key;
		const description = this.props.prop.description ? translateSchema(this.props.prop.description) : undefined;
		const value = this.props.target?.[this.props.prop.key];
		const primitiveType = this.props.api.getPrimitiveInputType(this.props.prop);
		const effectiveFormat = this.props.api.getPropertyFormat(this.props.prop);
		const enumValues = this.props.prop.enum ?? [];
		const enumTitlesMap = this.props.prop.enumTitles;
		const enumTitles = enumTitlesMap ? (translateSchema(enumTitlesMap) ?? []) : [];
		const template = typeof this.props.prop.template === 'string' ? this.props.prop.template : undefined;

		const selectHelperInfo = this.props.api.parseHelper(
			this.props.prop.helper,
			'helper',
			this.props.prop.editorOptions,
			this.props.schemaSection ?? 'definition',
			this.props.configKey,
			this.props.prop.key,
		);
		const isGridFormat = effectiveFormat === 'grid';
		const viewHelperInfo =
			!isGridFormat && typeof effectiveFormat === 'string'
				? this.props.api.parseHelper(
					effectiveFormat,
					'format',
					this.props.prop.editorOptions,
					this.props.schemaSection ?? 'definition',
					this.props.configKey,
					this.props.prop.key,
				)
				: null;

		const effectiveType = (viewHelperInfo || selectHelperInfo) ? 'object' : primitiveType;
		const helperName = viewHelperInfo?.name?.toLowerCase?.() || '';
		const gridOptions = this.props.prop.gridOptions;
		const forceFullWidth =
			helperName.includes('cgeditorlayout') ||
			(typeof gridOptions === 'string'
				? gridOptions.includes('fullwidth')
				: Array.isArray(gridOptions)
					? gridOptions.includes('fullwidth')
					: false);
		const layoutClassName = this.props.api.getLayoutClasses(this.props.prop, this.props.useGridLayout, forceFullWidth);
		const isTextarea = effectiveFormat === 'textarea';

		if (effectiveType === 'object') {
			return (
				<PropertyElementComponent
					label={label}
					description={description}
					type="object"
					value={value}
					defaultValue={this.props.api.getDefaultValueForProp(this.props.prop)}
					onChange={this.handleChangeObject}
					className={layoutClassName}
					viewHelperInfo={viewHelperInfo ?? undefined}
					selectHelperInfo={selectHelperInfo ?? undefined}
					template={template}
					valueType={primitiveType}
					suggest={this.props.prop.suggest}
					suggestTitles={this.props.prop.suggestTitles}
					schema={this.props.schema}
					format={effectiveFormat}
				/>
			);
		}

		if (enumValues.length) {
			return (
				<PropertyElementComponent
					label={label}
					description={description}
					type={effectiveType}
					value={value}
					defaultValue={this.props.api.getDefaultValueForProp(this.props.prop)}
					onChange={this.handleChangeEnum}
					className={layoutClassName}
					enumValues={enumValues}
					enumTitles={enumTitles}
					viewHelperInfo={viewHelperInfo ?? undefined}
					selectHelperInfo={selectHelperInfo ?? undefined}
					template={template}
					valueType={primitiveType}
					suggest={this.props.prop.suggest}
					suggestTitles={this.props.prop.suggestTitles}
					schema={this.props.schema}
					format={effectiveFormat}
				/>
			);
		}

		if (effectiveFormat === 'json') {
			const stringValue = typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2);
			return (
				<PropertyElementComponent
					label={label}
					description={description}
					type={effectiveType}
					value={stringValue}
					defaultValue={this.props.api.getDefaultValueForProp(this.props.prop)}
					onChange={this.handleChangeJson}
					className={layoutClassName}
					textarea
					viewHelperInfo={viewHelperInfo ?? undefined}
					selectHelperInfo={selectHelperInfo ?? undefined}
					template={template}
					valueType={primitiveType}
					suggest={this.props.prop.suggest}
					suggestTitles={this.props.prop.suggestTitles}
					schema={this.props.schema}
					format={effectiveFormat}
				/>
			);
		}

		return (
			<PropertyElementComponent
				label={label}
				description={description}
				type={effectiveType}
				value={value}
				defaultValue={this.props.api.getDefaultValueForProp(this.props.prop)}
				onChange={this.handleChangePrimitive}
				className={layoutClassName}
				textarea={isTextarea}
				viewHelperInfo={viewHelperInfo ?? undefined}
				selectHelperInfo={selectHelperInfo ?? undefined}
				template={template}
				valueType={primitiveType}
				suggest={this.props.prop.suggest}
				suggestTitles={this.props.prop.suggestTitles}
				schema={this.props.schema}
				format={effectiveFormat}
			/>
		);
	}
}

import type { ICgEventsSchema, ICgEventsSchemaProperty } from '@shared';
import { translateSchema } from '@shared';
import React from 'react';
import type { ConfigsPanelFieldApi, EmbeddedConfigsPanelComponentProps, SchemaSection } from './ConfigsPanelTypes';
import { dedupeSchemaProperties } from '../../helpers/schemaPropertyHelper';
import { ConfigsPanelArrayField } from './ConfigsPanelFieldArray';
import { ConfigsPanelDefinitionField } from './ConfigsPanelFieldDefinition';
import { ConfigsPanelElementField } from './ConfigsPanelFieldElement';
import { InfoTooltip } from '../common/InfoTooltip';

interface ConfigsPanelFieldsProps {
	target: any;
	properties: ICgEventsSchemaProperty[];
	path: Array<string | number>;
	useGridLayout: boolean;
	schema?: ICgEventsSchema;
	schemaSection?: SchemaSection;
	configKey: string;
	api: ConfigsPanelFieldApi;
	ConfigsPanelComponent: React.ComponentType<EmbeddedConfigsPanelComponentProps>;
	skipParentGrouping?: boolean;
}

interface ConfigsPanelPropertyProps extends ConfigsPanelFieldsProps {
	prop: ICgEventsSchemaProperty;
	scopeProps: ICgEventsSchemaProperty[];
}

interface ConfigsPanelPropertyWithChildrenProps extends ConfigsPanelPropertyProps {
	children?: ICgEventsSchemaProperty[];
}

export class ConfigsPanelFields extends React.PureComponent<ConfigsPanelFieldsProps> {
	render() {
		const uniqueProps = dedupeSchemaProperties(this.props.properties);

		if (this.props.skipParentGrouping) {
			return (
				<>
					{uniqueProps.map((prop) => (
						<ConfigsPanelProperty
							key={prop.key}
							{...this.props}
							prop={prop}
							scopeProps={this.props.properties}
						/>
					))}
				</>
			);
		}

		const childrenMap: Record<string, ICgEventsSchemaProperty[]> = {};
		uniqueProps.forEach((prop) => {
			if (prop && prop.parent) {
				const key = prop.parent;
				if (!childrenMap[key]) childrenMap[key] = [];
				childrenMap[key].push(prop);
			}
		});

		return (
			<>
				{uniqueProps
					.filter((prop) => !prop.parent)
					.map((prop) => (
						<ConfigsPanelPropertyWithChildren
							key={prop.key}
							{...this.props}
							prop={prop}
							children={childrenMap[prop.key]}
							scopeProps={this.props.properties}
						/>
					))}
			</>
		);
	}
}

class ConfigsPanelPropertyWithChildren extends React.PureComponent<ConfigsPanelPropertyWithChildrenProps> {
	render() {
		if (!this.props.children || this.props.children.length === 0) {
			return <ConfigsPanelProperty {...this.props} />;
		}

		if (!this.props.api.isPropertyVisible(this.props.target, this.props.prop)) {
			return null;
		}

		const layoutClassName = this.props.api.getLayoutClasses(this.props.prop, this.props.useGridLayout);
		const label = (this.props.prop.label ? translateSchema(this.props.prop.label) : undefined) ?? this.props.prop.key;
		const description = this.props.prop.description ? translateSchema(this.props.prop.description) : undefined;

		const parentValue = this.props.target?.[this.props.prop.key];
		const childTarget = parentValue && typeof parentValue === 'object' && !Array.isArray(parentValue)
			? parentValue
			: {};
		const childPath = [...this.props.path, this.props.prop.key];
		const childUseGrid = this.props.api.getPropertyFormat(this.props.prop) === 'grid';
		const containerClass = childUseGrid ? 'row g-2' : 'row g-2 cgenh-config-stack';

		return (
			<div className={`cgenh-config-field cgenh-config-field--parent ${layoutClassName}`}>
				<div className="cgenh-config-field__label-container">
					<p className="cgenh-config-field__label">{label}</p>
					{description && <InfoTooltip description={description} />}
				</div>
				<div className="cgenh-definition-card">
					<div className="cgenh-definition-card__body">
						<div className={containerClass}>
							<ConfigsPanelFields
								{...this.props}
								target={childTarget}
								properties={this.props.children}
								path={childPath}
								useGridLayout={childUseGrid}
								skipParentGrouping
							/>
						</div>
					</div>
				</div>
			</div>
		);
	}
}

class ConfigsPanelProperty extends React.PureComponent<ConfigsPanelPropertyProps> {
	render() {
		if (!this.props.api.isPropertyVisible(this.props.target, this.props.prop)) {
			return null;
		}

		const isArray =
			this.props.prop.collection === 'array' ||
			this.props.prop.type === 'array' ||
			this.props.prop.multiple ||
			this.props.prop.arrayItem ||
			this.props.prop.items;

		if (isArray) {
			const definitionName = this.props.api.resolveDefinitionName(this.props.prop, true) ?? undefined;
			return (
				<ConfigsPanelArrayField
					target={this.props.target}
					prop={this.props.prop}
					path={this.props.path}
					useGridLayout={this.props.useGridLayout}
					schema={this.props.schema}
					scopeProps={this.props.scopeProps}
					schemaSection={this.props.schemaSection}
					configKey={this.props.configKey}
					api={this.props.api}
					ConfigsPanelComponent={this.props.ConfigsPanelComponent}
					definitionName={definitionName}
				/>
			);
		}

		const definitionName = this.props.api.resolveDefinitionName(this.props.prop, false);
		if (definitionName) {
			return (
				<ConfigsPanelDefinitionField
					target={this.props.target}
					prop={this.props.prop}
					definitionName={definitionName}
					path={this.props.path}
					useGridLayout={this.props.useGridLayout}
					schema={this.props.schema}
					schemaSection={this.props.schemaSection}
					configKey={this.props.configKey}
					api={this.props.api}
					ConfigsPanelComponent={this.props.ConfigsPanelComponent}
				/>
			);
		}

		return (
			<ConfigsPanelElementField
				target={this.props.target}
				prop={this.props.prop}
				path={this.props.path}
				useGridLayout={this.props.useGridLayout}
				scopeProps={this.props.scopeProps}
				schema={this.props.schema}
				schemaSection={this.props.schemaSection}
				configKey={this.props.configKey}
				api={this.props.api}
			/>
		);
	}
}

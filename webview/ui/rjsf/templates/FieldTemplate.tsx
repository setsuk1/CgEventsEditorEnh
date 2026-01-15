import { FieldTemplateProps } from '@rjsf/utils';
import React from 'react';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { getIndentClass } from '../../helpers/indentHelper';
import { isRecord, stripCgenhClasses } from '../utils/rjsfUtils';
import { evaluateVisibleOption } from '../utils/visibleOption';

/**
 * Custom field template for RJSF using Bootstrap grid
 */
export class FieldTemplate extends React.PureComponent<FieldTemplateProps> {
	render() {
		const {
			id,
			label,
			children,
			errors,
			help,
			hidden,
			required,
			displayLabel,
			classNames,
			uiSchema,
			schema,
		} = this.props;

		const formContext = this.props.registry?.formContext;
		const rootFormData = isRecord(formContext) ? formContext.rootFormData : undefined;
		const rawOptions = uiSchema?.['ui:options'];
		const uiOptions = isRecord(rawOptions) ? rawOptions : undefined;
		const visibleOpt = uiOptions ? uiOptions.visible : undefined;

		// Get the current field's parent path from id for resolving sibling references
		// id format: "root_parent_child" -> convert to "parent.child"
		const currentPath = (id || '').replace(/^root_?/, '').replace(/_/g, '.');
		const parentPath = currentPath.split('.').slice(0, -1).join('.');

		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, parentPath);

		if (hidden || !isVisible) {
			return <div className="d-none">{children}</div>;
		}

		// Check if this is a boolean checkbox type
		const isCheckbox = schema.type === 'boolean' && uiSchema?.['ui:widget'] !== 'select';

		// Get raw description string from schema (RJSF's description prop is a ReactElement)
		const rawDescription = typeof schema.description === 'string' ? schema.description : undefined;

		const colClass = uiOptions && typeof uiOptions.colClass === 'string' ? uiOptions.colClass : '';
		const indentClass = getIndentClass(uiOptions ? uiOptions.indent : undefined);
		const fieldClasses = [
			'cgenh-config-field',
			colClass,
			indentClass,
			stripCgenhClasses(classNames),
			stripCgenhClasses(uiOptions && typeof uiOptions.classNames === 'string' ? uiOptions.classNames : undefined),
		].filter(Boolean).join(' ');

		// Get unit from ui:options
		const unit = uiOptions && typeof uiOptions.unit === 'string' ? uiOptions.unit : undefined;

		// For checkboxes, RJSF's widget already renders the label inside the checkbox
		// We only add the InfoTooltip for the description
		if (isCheckbox) {
			return (
				<div className={fieldClasses}>
					<div className="d-flex align-items-center gap-2">
						{children}
						{rawDescription && <InfoTooltip description={rawDescription} />}
					</div>
					{errors && <div className="invalid-feedback d-block">{errors}</div>}
					{help && <div className="form-text">{help}</div>}
				</div>
			);
		}

		// Wrap children with input-group if unit is present
		const fieldContent = unit ? (
			<div className="input-group input-group-sm">
				{children}
				<span className="input-group-text">{unit}</span>
			</div>
		) : children;

		return (
			<div className={fieldClasses}>
				{displayLabel && label && (
					<div className="d-flex align-items-center gap-2 mb-1">
						<label className="form-label mb-0" htmlFor={id}>
							{label}
							{required && <span className="text-danger ms-1">*</span>}
						</label>
						{rawDescription && <InfoTooltip description={rawDescription} />}
					</div>
				)}
				{fieldContent}
				{errors && <div className="invalid-feedback d-block">{errors}</div>}
				{help && <div className="form-text">{help}</div>}
			</div>
		);
	}
}

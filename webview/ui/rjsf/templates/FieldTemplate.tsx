import { DescriptionFieldProps, FieldTemplateProps } from '@rjsf/utils';
import React from 'react';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { isRecord, stripCgenhClasses } from '../utils/rjsfUtils';
import { evaluateVisibleOption } from '../utils/visibleOption';

function getIndentClass(rawIndent: unknown): string | undefined {
	const indent = typeof rawIndent === 'number' ? rawIndent : Number(rawIndent);
	if (!Number.isFinite(indent) || indent <= 0) return undefined;
	const clamped = Math.min(Math.max(Math.floor(indent), 1), 5);
	return `cgenh-config-field--indent-${clamped}`;
}

/**
 * Custom field template for RJSF using Bootstrap grid
 */
type FieldTemplatePropsWithPath = FieldTemplateProps & {
	fieldPathId?: { path?: Array<string | number> };
};

export class FieldTemplate extends React.PureComponent<FieldTemplatePropsWithPath> {
	render() {
		const {
			id,
			fieldPathId,
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
		const parentPath = Array.isArray(fieldPathId?.path) ? fieldPathId.path.slice(0, -1) : [];
		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, parentPath);

		if (!isVisible) {
			return null;
		}
		if (hidden) {
			return <div className="d-none">{children}</div>;
		}

		const isCheckbox = schema.type === 'boolean' && uiSchema?.['ui:widget'] !== 'select';
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
		const unit = uiOptions && typeof uiOptions.unit === 'string' ? uiOptions.unit : undefined;

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


export class DescriptionFieldTemplate extends React.PureComponent<DescriptionFieldProps> {
	render(): null {
		return null;
	}
}

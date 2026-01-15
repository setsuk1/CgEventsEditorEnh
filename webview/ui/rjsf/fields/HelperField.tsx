import { FieldProps, WidgetProps } from '@rjsf/utils';
import React from 'react';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { isRecord, stripCgenhClasses } from '../utils/rjsfUtils';
import { HelperWidget } from '../widgets/HelperWidget';

/**
 * HelperField wraps HelperWidget to work with RJSF's Field interface.
 * This is needed for object types where ui:widget is ignored but ui:field works.
 */
export class HelperField extends React.PureComponent<FieldProps> {
	private handleChange = (value: any) => {
		const { fieldPathId, onChange } = this.props;
		const fieldId = this.getFieldId();
		onChange(value, fieldPathId.path, undefined, fieldId);
	};

	private getFieldId(): string {
		const { fieldPathId, name } = this.props;
		return fieldPathId?.$id || name || 'helper-field';
	}

	render() {
		const { schema, uiSchema, formData, disabled, readonly, required } = this.props;

		// Extract options from uiSchema
		const rawOptions = uiSchema?.['ui:options'];
		const options = isRecord(rawOptions) ? rawOptions : {};

		// Safe ID extraction
		const fieldId = this.getFieldId();

		// Get label and description
		const label = schema?.title || '';
		const description = typeof schema?.description === 'string' ? schema.description : undefined;

		// Get column class from ui:options
		const colClass = typeof options.colClass === 'string' ? options.colClass : '';
		const classNames = stripCgenhClasses(
			typeof uiSchema?.['ui:classNames'] === 'string' ? uiSchema['ui:classNames'] : undefined
		);

		// Adapt FieldProps to WidgetProps format for HelperWidget
		// For object types, tell the widget it's NOT a string target so it doesn't stringify
		const widgetProps: WidgetProps = {
			id: fieldId,
			value: formData,
			disabled: disabled || false,
			readonly: readonly || false,
			onChange: this.handleChange,
			options,
			schema: {
				...schema,
				// Keep type as object so HelperWidget knows not to stringify
				type: 'object',
			},
			label,
			required: required || false,
			autofocus: false,
			placeholder: '',
			rawErrors: [],
			registry: this.props.registry,
			formContext: this.props.formContext,
			onBlur: this.props.onBlur,
			onFocus: this.props.onFocus,
		};

		const rootClass = [colClass, classNames].filter(Boolean).join(' ');

		return (
			<div className={rootClass}>
				{label && (
					<div className="d-flex align-items-center gap-2 mb-1">
						<label className="form-label mb-0" htmlFor={fieldId}>
							{label}
							{required && <span className="text-danger ms-1">*</span>}
						</label>
						{description && <InfoTooltip description={description} />}
					</div>
				)}
				<HelperWidget {...widgetProps} />
			</div>
		);
	}
}

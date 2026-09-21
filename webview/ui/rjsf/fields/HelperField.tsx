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
	private mounted = false;

	componentDidMount(): void {
		this.mounted = true;
	}

	componentWillUnmount(): void {
		this.mounted = false;
	}

	private handleChange = (value: any) => {
		const { fieldPathId, onChange } = this.props;
		onChange(value, fieldPathId.path, undefined, fieldPathId.$id);
	};

	private handleBlur = (id: string, value: any) => {
		if (this.mounted) this.props.onBlur(id, value);
	};

	render() {
		const { schema, uiSchema, formData, disabled, readonly, required, fieldPathId, name } = this.props;
		const rawOptions = uiSchema?.['ui:options'];
		const options = isRecord(rawOptions) ? rawOptions : {};
		const fieldId = fieldPathId.$id || name || 'helper-field';
		const label = schema?.title || '';
		const description = typeof schema?.description === 'string' ? schema.description : undefined;
		const colClass = typeof options.colClass === 'string' ? options.colClass : '';
		const classNames = stripCgenhClasses(
			typeof uiSchema?.['ui:classNames'] === 'string' ? uiSchema['ui:classNames'] : undefined
		);

		const widgetProps: WidgetProps = {
			id: fieldId,
			name,
			htmlName: fieldPathId.name,
			value: formData,
			disabled: !!disabled,
			readonly: !!readonly,
			onChange: this.handleChange,
			options,
			schema: {
				...schema,
				type: 'object',
			},
			label,
			required: !!required,
			autofocus: false,
			placeholder: '',
			rawErrors: [],
			registry: this.props.registry,
			formContext: this.props.formContext,
			onBlur: this.handleBlur,
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

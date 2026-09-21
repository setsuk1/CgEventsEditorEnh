import React from 'react';
import {
	ariaDescribedByIds,
	enumOptionsIndexForValue,
	enumOptionsValueForIndex,
	type FormContextType,
	type RJSFSchema,
	type StrictRJSFSchema,
	type WidgetProps,
} from '@rjsf/utils';
import {
	hasStaticSelectOptions,
	resolveInitialSelectValue,
	resolveSelectEnumOptions,
} from './SelectWidgetData';
import { buildWidgetSuggestionContext } from './suggestionUtils';
import { commitRjsfWidgetValue, getRjsfImmediateCommitRequest } from './RJSFImmediateCommit';

type SelectWidgetProps<T, S extends StrictRJSFSchema, F extends FormContextType> = WidgetProps<T, S, F>;

function getValue(event: React.SyntheticEvent<HTMLSelectElement>, multiple: boolean) {
	const select = event.currentTarget;
	if (multiple) {
		return Array.from(select.options)
			.filter((option) => option.selected)
			.map((option) => option.value);
	}
	return select.value;
}

export class SelectWidget<T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>
	extends React.PureComponent<SelectWidgetProps<T, S, F>> {
	private hasUserChanged = false;

	componentDidMount(): void {
		this.applyInitialDefaultValue();
	}

	componentDidUpdate(): void {
		this.applyInitialDefaultValue();
	}

	private getFixedEnumOptions() {
		const { schema, options, registry } = this.props;
		const suggestions = hasStaticSelectOptions(schema, options)
			? []
			: buildWidgetSuggestionContext(options, registry?.formContext).suggestions;
		return resolveSelectEnumOptions<S>(schema, options, suggestions);
	}

	private applyInitialDefaultValue() {
		const { schema, options, value, multiple = false, onChange } = this.props;
		const decision = resolveInitialSelectValue<S>({
			hasUserChanged: this.hasUserChanged,
			disabled: Boolean(this.props.disabled),
			readonly: Boolean(this.props.readonly),
			multiple,
			schemaDefault: schema.default,
			currentValue: value,
			enumOptions: this.getFixedEnumOptions(),
			enumDisabled: Array.isArray(options.enumDisabled) ? options.enumDisabled : undefined,
		});
		if (decision.shouldApply) {
			onChange(decision.value);
		}
	}

	private handleFocus = (event: React.FocusEvent<HTMLSelectElement>) => {
		const { id, onFocus, options, multiple = false } = this.props;
		const fixedEnumOptions = this.getFixedEnumOptions();
		const newValue = getValue(event, multiple);
		onFocus(id, enumOptionsValueForIndex<S>(newValue, fixedEnumOptions, options.emptyValue));
	};

	private handleBlur = (event: React.FocusEvent<HTMLSelectElement>) => {
		const { id, onBlur, options, multiple = false } = this.props;
		const fixedEnumOptions = this.getFixedEnumOptions();
		const newValue = getValue(event, multiple);
		onBlur(id, enumOptionsValueForIndex<S>(newValue, fixedEnumOptions, options.emptyValue));
	};

	private handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		this.hasUserChanged = true;
		const { onChange, options, multiple = false, formContext, registry } = this.props;
		const fixedEnumOptions = this.getFixedEnumOptions();
		const newValue = getValue(event, multiple);
		commitRjsfWidgetValue(
			enumOptionsValueForIndex<S>(newValue, fixedEnumOptions, options.emptyValue),
			onChange,
			getRjsfImmediateCommitRequest(formContext || registry?.formContext),
		);
	};

	render() {
		const {
			schema,
			id,
			options,
			value,
			required,
			disabled,
			readonly,
			multiple = false,
			autofocus = false,
			placeholder,
			htmlName,
		} = this.props;
		const { enumDisabled } = options;
		const emptyValue: string | string[] = multiple ? [] : '';
		const fixedEnumOptions = this.getFixedEnumOptions();
		const selectedIndexes = enumOptionsIndexForValue<S>(value, fixedEnumOptions, multiple);
		const hasUnknownValue = !multiple && selectedIndexes === undefined && value !== undefined && value !== null && value !== '';
		const showPlaceholderOption = !multiple && schema.default === undefined && !hasUnknownValue;

		return (
			<select
				id={id}
				name={htmlName || id}
				multiple={multiple}
				role="combobox"
				className="form-select form-select-sm"
				value={selectedIndexes === undefined ? emptyValue : selectedIndexes}
				required={required}
				disabled={disabled || readonly}
				autoFocus={autofocus}
				onBlur={this.handleBlur}
				onFocus={this.handleFocus}
				onChange={this.handleChange}
				aria-describedby={ariaDescribedByIds(id)}
			>
				{hasUnknownValue && <option value="" disabled>{String(value)}</option>}
				{showPlaceholderOption && <option value="">{placeholder}</option>}
				{Array.isArray(fixedEnumOptions) &&
					fixedEnumOptions.map(({ value: optionValue, label }, i) => {
						const isDisabled = enumDisabled && enumDisabled.indexOf(optionValue) !== -1;
						return (
							<option key={i} value={String(i)} disabled={isDisabled}>
								{label}
							</option>
						);
					})}
			</select>
		);
	}
}

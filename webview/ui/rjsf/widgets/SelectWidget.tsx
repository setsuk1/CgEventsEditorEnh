import React from 'react';
import {
	ariaDescribedByIds,
	enumOptionsIndexForValue,
	enumOptionsValueForIndex,
	type EnumOptionsType,
	type FormContextType,
	type RJSFSchema,
	type StrictRJSFSchema,
	type WidgetProps,
} from '@rjsf/utils';
import { isRecord } from '../utils/rjsfUtils';
import { buildWidgetSuggestionContext } from './suggestionUtils';

type SelectWidgetProps<T, S extends StrictRJSFSchema, F extends FormContextType> = WidgetProps<T, S, F>;

function getValue(event: React.SyntheticEvent<HTMLSelectElement>, multiple: boolean) {
	const select = event.currentTarget;
	if (multiple) {
		return Array.from(select.options)
			.slice()
			.filter((o) => o.selected)
			.map((o) => o.value);
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
		const { enumOptions, enumNames } = options;
		if (Array.isArray(enumOptions)) {
			return enumOptions;
		}
		if (Array.isArray(schema.enum)) {
			const schemaEnumNames = Array.isArray(schema.enumNames) ? schema.enumNames : undefined;
			const names = Array.isArray(enumNames) ? enumNames : schemaEnumNames;
			const mapped: EnumOptionsType<S>[] = schema.enum.map((enumValue, index) => ({
				value: enumValue,
				label: names?.[index] ?? String(enumValue),
			}));
			return mapped;
		}
		const { suggestions } = buildWidgetSuggestionContext(options, registry?.formContext);
		if (suggestions.length) {
			return suggestions.map((entry) => ({ value: entry.value, label: entry.label }));
		}
		return enumOptions;
	}

	private applyInitialDefaultValue() {
		if (this.hasUserChanged) {
			return;
		}
		const { id, schema, options, value, registry, multiple = false } = this.props;
		if (!id || multiple) {
			return;
		}
		if (schema.default !== undefined) {
			return;
		}

		const fixedEnumOptions = this.getFixedEnumOptions();
		if (!Array.isArray(fixedEnumOptions) || fixedEnumOptions.length === 0) {
			return;
		}

		const selectedIndex = enumOptionsIndexForValue<S>(value, fixedEnumOptions, false);
		if (typeof selectedIndex !== 'undefined') {
			return;
		}

		const enumDisabled = Array.isArray(options.enumDisabled) ? options.enumDisabled : undefined;
		let resolvedValue: unknown = undefined;
		for (const option of fixedEnumOptions) {
			const optionValue = option.value;
			if (!enumDisabled || enumDisabled.indexOf(optionValue) === -1) {
				resolvedValue = optionValue;
				break;
			}
		}
		if (resolvedValue === undefined) {
			return;
		}

		const formContext = registry?.formContext;
		if (!isRecord(formContext) || typeof formContext.updateFormData !== 'function') {
			return;
		}
		const pathStr = id.replace(/^root_?/, '');
		const path = pathStr ? pathStr.split('_').filter(Boolean) : [];
		formContext.updateFormData(path, resolvedValue, 'init');
	}

	private handleFocus = (event: React.FocusEvent<HTMLSelectElement>) => {
		const { id, onFocus, options, multiple = false } = this.props;
		const fixedEnumOptions = this.getFixedEnumOptions();
		const optEmptyVal = options.emptyValue;
		const newValue = getValue(event, multiple);
		onFocus(id, enumOptionsValueForIndex<S>(newValue, fixedEnumOptions, optEmptyVal));
	};

	private handleBlur = (event: React.FocusEvent<HTMLSelectElement>) => {
		const { id, onBlur, options, multiple = false } = this.props;
		const fixedEnumOptions = this.getFixedEnumOptions();
		const optEmptyVal = options.emptyValue;
		const newValue = getValue(event, multiple);
		onBlur(id, enumOptionsValueForIndex<S>(newValue, fixedEnumOptions, optEmptyVal));
	};

	private handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		this.hasUserChanged = true;
		const { id, onChange, options, registry, multiple = false } = this.props;
		const fixedEnumOptions = this.getFixedEnumOptions();
		const optEmptyVal = options.emptyValue;
		const newValue = getValue(event, multiple);
		const resolved = enumOptionsValueForIndex<S>(newValue, fixedEnumOptions, optEmptyVal);
		onChange(resolved);

		const formContext = registry?.formContext;
		if (!id || !isRecord(formContext) || typeof formContext.updateFormData !== 'function') {
			return;
		}
		const pathStr = id.replace(/^root_?/, '');
		const path = pathStr ? pathStr.split('_').filter(Boolean) : [];
		formContext.updateFormData(path, resolved, true);
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
		const emptyValue = multiple ? [] : '';
		const fixedEnumOptions = this.getFixedEnumOptions();
		const selectedIndexes = enumOptionsIndexForValue<S>(value, fixedEnumOptions, multiple);
		const showPlaceholderOption = !multiple && schema.default === undefined;

		return (
			<select
				id={id}
				name={htmlName || id}
				multiple={multiple}
				role="combobox"
				className="form-select form-select-sm"
				value={typeof selectedIndexes === 'undefined' ? emptyValue : selectedIndexes}
				required={required}
				disabled={disabled || readonly}
				autoFocus={autofocus}
				onBlur={this.handleBlur}
				onFocus={this.handleFocus}
				onChange={this.handleChange}
				aria-describedby={ariaDescribedByIds(id)}
			>
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

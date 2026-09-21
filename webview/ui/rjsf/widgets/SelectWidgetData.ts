import {
	enumOptionsIndexForValue,
	type EnumOptionsType,
	type StrictRJSFSchema,
} from '@rjsf/utils';

export interface SelectSuggestionOption {
	value: string;
	label: string;
}

interface SelectOptionsLike {
	enumOptions?: unknown;
	enumNames?: unknown;
}

export interface InitialSelectValueInput<S extends StrictRJSFSchema> {
	hasUserChanged: boolean;
	disabled: boolean;
	readonly: boolean;
	multiple: boolean;
	schemaDefault: unknown;
	currentValue: any;
	enumOptions: EnumOptionsType<S>[] | undefined;
	enumDisabled?: readonly unknown[];
}

export interface InitialSelectValueDecision {
	shouldApply: boolean;
	value?: unknown;
}

export function hasStaticSelectOptions(
	schema: StrictRJSFSchema,
	options: SelectOptionsLike,
): boolean {
	return Array.isArray(options.enumOptions) || Array.isArray(schema.enum);
}

export function resolveSelectEnumOptions<S extends StrictRJSFSchema>(
	schema: S,
	options: SelectOptionsLike,
	suggestions: readonly SelectSuggestionOption[],
): EnumOptionsType<S>[] | undefined {
	if (Array.isArray(options.enumOptions)) {
		return options.enumOptions as EnumOptionsType<S>[];
	}
	if (Array.isArray(schema.enum)) {
		const schemaWithEnumNames = schema as S & { enumNames?: unknown };
		const schemaEnumNames = Array.isArray(schemaWithEnumNames.enumNames)
			? schemaWithEnumNames.enumNames
			: undefined;
		const names = Array.isArray(options.enumNames) ? options.enumNames : schemaEnumNames;
		return schema.enum.map((enumValue, index) => ({
			value: enumValue,
			label: names?.[index] ?? String(enumValue),
		})) as EnumOptionsType<S>[];
	}
	if (suggestions.length) {
		return suggestions.map((entry) => ({ value: entry.value, label: entry.label })) as EnumOptionsType<S>[];
	}
	return undefined;
}

export function resolveInitialSelectValue<S extends StrictRJSFSchema>(
	input: InitialSelectValueInput<S>,
): InitialSelectValueDecision {
	if (
		input.hasUserChanged
		|| input.disabled
		|| input.readonly
		|| input.multiple
		|| input.schemaDefault !== undefined
	) {
		return { shouldApply: false };
	}
	const enumOptions = input.enumOptions;
	if (!enumOptions?.length) {
		return { shouldApply: false };
	}
	if (enumOptionsIndexForValue<S>(input.currentValue, enumOptions, false) !== undefined) {
		return { shouldApply: false };
	}
	if (input.currentValue !== undefined && input.currentValue !== null && input.currentValue !== '') {
		return { shouldApply: false };
	}
	for (const option of enumOptions) {
		if (!input.enumDisabled || input.enumDisabled.indexOf(option.value) === -1) {
			return { shouldApply: true, value: option.value };
		}
	}
	return { shouldApply: false };
}

import type { UiSchema } from '@rjsf/utils';
import { hasClassToken, isRecord } from '../utils/rjsfUtils';

export interface ObjectFieldLayoutOptions {
	uiOptions: Record<string, any>;
	uiClassNames: string;
	optionClassNames: string;
	hasInlineLayout: boolean;
	hideHeader: boolean;
	collapsed: boolean;
}

export function resolveObjectFieldLayoutOptions(
	uiSchema: UiSchema | undefined,
): ObjectFieldLayoutOptions {
	const rawOptions = uiSchema?.['ui:options'];
	const uiOptions = isRecord(rawOptions) ? rawOptions : {};
	const uiClassNames = typeof uiSchema?.['ui:classNames'] === 'string'
		? uiSchema['ui:classNames']
		: '';
	const optionClassNames = typeof uiOptions.classNames === 'string'
		? uiOptions.classNames
		: '';
	const hasInlineLayout = uiOptions.oneRow === true
		|| hasClassToken(uiClassNames, 'cgenh-config-field--inline')
		|| hasClassToken(optionClassNames, 'cgenh-config-field--inline');

	return {
		uiOptions,
		uiClassNames,
		optionClassNames,
		hasInlineLayout,
		hideHeader: hasInlineLayout || uiOptions.noHeader === true,
		collapsed: uiOptions.collapsed === true,
	};
}

export function resolveNextObjectFieldCollapsedState(
	currentCollapsed: boolean,
	previousLayout: ObjectFieldLayoutOptions,
	nextLayout: ObjectFieldLayoutOptions,
): boolean {
	if (nextLayout.hideHeader) return false;
	if (
		previousLayout.hideHeader !== nextLayout.hideHeader
		|| previousLayout.collapsed !== nextLayout.collapsed
	) {
		return nextLayout.collapsed;
	}
	return currentCollapsed;
}

export interface ArrayFieldLayoutOptions {
	uiOptions: Record<string, any>;
	hasInlineLayout: boolean;
	hideHeader: boolean;
	collapsed: boolean;
}

export function resolveArrayFieldLayoutOptions(
	uiSchema: UiSchema | undefined,
	className?: string,
): ArrayFieldLayoutOptions {
	const rawOptions = uiSchema?.['ui:options'];
	const uiOptions = isRecord(rawOptions) ? rawOptions : {};
	const uiClassNames = typeof uiSchema?.['ui:classNames'] === 'string'
		? uiSchema['ui:classNames']
		: '';
	const propsClassNames = typeof className === 'string' ? className : '';
	const optionClassNames = typeof uiOptions.classNames === 'string' ? uiOptions.classNames : '';
	const hasInlineLayout = uiOptions.oneRow === true
		|| hasClassToken(uiClassNames, 'cgenh-config-field--inline')
		|| hasClassToken(propsClassNames, 'cgenh-config-field--inline')
		|| hasClassToken(optionClassNames, 'cgenh-config-field--inline');

	return {
		uiOptions,
		hasInlineLayout,
		hideHeader: hasInlineLayout || uiOptions.noHeader === true,
		collapsed: uiOptions.collapsed === true,
	};
}

export function resolveNextArrayFieldCollapsedState(
	currentCollapsed: boolean,
	previousLayout: ArrayFieldLayoutOptions,
	nextLayout: ArrayFieldLayoutOptions,
): boolean {
	if (nextLayout.hideHeader) return false;
	if (
		previousLayout.hideHeader !== nextLayout.hideHeader
		|| previousLayout.collapsed !== nextLayout.collapsed
	) {
		return nextLayout.collapsed;
	}
	return currentCollapsed;
}

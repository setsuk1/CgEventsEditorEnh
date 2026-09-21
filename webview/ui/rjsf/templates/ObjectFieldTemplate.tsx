import { ObjectFieldTemplateProps, WidgetProps } from '@rjsf/utils';
import React from 'react';
import { translation } from '../../../trans/Trans';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { Tooltip } from '../../components/common/Tooltip';
import { SvgChevronDown } from '../../svg/SvgChevronDown';
import { SvgChevronRight } from '../../svg/SvgChevronRight';
import { HelperWidget } from '../widgets/HelperWidget';
import { isHelperFormat, isRecord, stripCgenhClasses } from '../utils/rjsfUtils';
import { resolveNextObjectFieldCollapsedState, resolveObjectFieldLayoutOptions } from './FieldLayout';
import { evaluateVisibleOption } from '../utils/visibleOption';

interface ObjectFieldTemplateState {
	collapsed: boolean;
}

/**
 * Custom object field template for RJSF using single-column stack layout
 * Matches the original ConfigsPanel layout
 */
export class ObjectFieldTemplate extends React.PureComponent<ObjectFieldTemplateProps, ObjectFieldTemplateState> {
	constructor(props: ObjectFieldTemplateProps) {
		super(props);
		const layout = resolveObjectFieldLayoutOptions(props.uiSchema);
		this.state = {
			collapsed: layout.hideHeader ? false : layout.collapsed,
		};
	}

	componentDidUpdate(prevProps: ObjectFieldTemplateProps): void {
		const previousLayout = resolveObjectFieldLayoutOptions(prevProps.uiSchema);
		const nextLayout = resolveObjectFieldLayoutOptions(this.props.uiSchema);
		const nextCollapsed = resolveNextObjectFieldCollapsedState(
			this.state.collapsed,
			previousLayout,
			nextLayout,
		);
		if (nextCollapsed !== this.state.collapsed) {
			this.setState({ collapsed: nextCollapsed });
		}
	}

	private toggleCollapsed = () => {
		this.setState((prev) => ({ collapsed: !prev.collapsed }));
	};

	private handleHelperChange = (next: any) => {
		const formContext = this.props.registry?.formContext;
		if (!isRecord(formContext) || typeof formContext.updateFormData !== 'function') return;
		const fieldPath = this.props.fieldPathId?.path;
		if (!Array.isArray(fieldPath)) return;

		const normalized = next === undefined || next === null ? {} : next;
		formContext.updateFormData(fieldPath, normalized, true);
	};

	render() {
		const {
			properties,
			title,
			uiSchema,
			schema,
			fieldPathId,
		} = this.props;
		const formContext = this.props.registry?.formContext;
		const rootFormData = isRecord(formContext) ? formContext.rootFormData : undefined;

		const currentId = fieldPathId?.$id || '';
		const isRoot = !currentId || currentId === 'root';

		const layout = resolveObjectFieldLayoutOptions(uiSchema);
		const { uiOptions, uiClassNames: classNames, optionClassNames } = layout;
		const helper = typeof uiOptions.helper === 'string' ? uiOptions.helper : undefined;
		const helperFormat = typeof uiOptions.format === 'string' ? uiOptions.format : undefined;
		const hasSelectionHelper = typeof helper === 'string' && !!helper.trim();
		const hasViewHelper = isHelperFormat(helperFormat);
		const visibleOpt = uiOptions.visible;
		const isDefinitionRef = Boolean(uiOptions.isDefinitionRef || schema.$ref);
		const isCollapsed = this.state.collapsed;
		const toggleLabel = isCollapsed ? translation.list.expand.getTrans() : translation.list.collapse.getTrans();
		const showHeader = !layout.hideHeader;
		const canCollapse = !isRoot && showHeader;
		const effectiveCollapsed = canCollapse && isCollapsed;
		const rawDescription = typeof schema.description === 'string' ? schema.description : undefined;

		const helperWidgetBaseProps: WidgetProps | null = (hasSelectionHelper || hasViewHelper) ? (() => {
			const fieldId = typeof fieldPathId?.$id === 'string' && fieldPathId.$id ? fieldPathId.$id : 'object';
			return {
				id: `${fieldId}__helper`,
				name: fieldId,
				value: this.props.formData,
				disabled: this.props.disabled || false,
				readonly: this.props.readonly || false,
				onChange: this.handleHelperChange,
				onBlur: (_id: string, _value: any) => undefined,
				onFocus: (_id: string, _value: any) => undefined,
				options: {
					helper,
					format: helperFormat,
					editorOptions: uiOptions.editorOptions,
				},
				schema: {
					...schema,
					type: 'object',
				},
				label: title,
				required: false,
				autofocus: false,
				placeholder: '',
				rawErrors: [] as string[],
				registry: this.props.registry,
				formContext: this.props.registry?.formContext,
			};
		})() : null;

		const headerHelperWidget = (!hasViewHelper && helperWidgetBaseProps) ? (
			<HelperWidget
				{...helperWidgetBaseProps}
				options={{
					...helperWidgetBaseProps.options,
					compact: true,
				}}
			/>
		) : null;

		const bodyHelperWidget = (hasViewHelper && helperWidgetBaseProps) ? (
			<HelperWidget {...helperWidgetBaseProps} />
		) : null;

		if (isRoot) {
			return (
				<div className="row">
					{bodyHelperWidget && <div className="col-12 mb-2">{bodyHelperWidget}</div>}
					{headerHelperWidget && !bodyHelperWidget && <div className="col-12 mb-2">{headerHelperWidget}</div>}
					{properties.map((prop) => prop.content)}
				</div>
			);
		}

		const parentPath = Array.isArray(fieldPathId?.path) ? fieldPathId.path.slice(0, -1) : [];
		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, parentPath);

		if (!isVisible) {
			return null;
		}

		const parentClasses = [
			'cgenh-config-field',
			stripCgenhClasses(optionClassNames),
			stripCgenhClasses(classNames),
		].filter(Boolean).join(' ');

		const header = (!isRoot && showHeader) ? (
			<div className="d-flex align-items-center justify-content-between gap-2 mb-1">
				<div className="d-flex align-items-center gap-2 min-w-0">
					{canCollapse && (
						<Tooltip content={toggleLabel}>
							<button
								type="button"
								className="btn btn-sm btn-outline-secondary p-1"
								onClick={this.toggleCollapsed}
								aria-label={toggleLabel}
							>
								{effectiveCollapsed ? (
									<SvgChevronRight width={14} height={14} aria-hidden="true" />
								) : (
									<SvgChevronDown width={14} height={14} aria-hidden="true" />
								)}
							</button>
						</Tooltip>
					)}
					{title && <span className="form-label mb-0">{title}</span>}
					{rawDescription && <InfoTooltip description={rawDescription} />}
					{headerHelperWidget}
				</div>
			</div>
		) : null;

		if (isDefinitionRef) {
			return (
				<div className={parentClasses}>
					{header}
					<div className="card">
						{!effectiveCollapsed && (
							<div className="card-body p-2">
								{bodyHelperWidget && <div className="mb-2">{bodyHelperWidget}</div>}
								<div className="row g-2">
									{properties.map((prop) => prop.content)}
								</div>
							</div>
						)}
					</div>
				</div>
			);
		}

		return (
			<div className={parentClasses}>
				{header}
				{!effectiveCollapsed && bodyHelperWidget && <div className="mb-2">{bodyHelperWidget}</div>}
				{!effectiveCollapsed && (
					<div className="row g-2">
						{properties.map((prop) => prop.content)}
					</div>
				)}
			</div>
		);
	}
}

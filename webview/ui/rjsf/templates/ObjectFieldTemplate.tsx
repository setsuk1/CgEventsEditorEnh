import { ObjectFieldTemplateProps, WidgetProps } from '@rjsf/utils';
import React from 'react';
import { translation } from '../../../trans/Trans';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { Tooltip } from '../../components/common/Tooltip';
import { SvgChevronDown } from '../../svg/SvgChevronDown';
import { SvgChevronRight } from '../../svg/SvgChevronRight';
import { HelperWidget } from '../widgets/HelperWidget';
import { getCollapseState, isHelperFormat, isRecord, stripCgenhClasses } from '../utils/rjsfUtils';
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
		const { collapsed } = getCollapseState(props.uiSchema);
		const rawOptions = props.uiSchema?.['ui:options'];
		const uiOptions = isRecord(rawOptions) ? rawOptions : {};
		const classNames = typeof props.uiSchema?.['ui:classNames'] === 'string' ? props.uiSchema['ui:classNames'] : '';
		const optionClassNames = typeof uiOptions.classNames === 'string' ? uiOptions.classNames : '';
		const hasInlineLayout = uiOptions.oneRow === true
			|| classNames.includes('cgenh-config-field--inline')
			|| optionClassNames.includes('cgenh-config-field--inline');
		const hideHeader = hasInlineLayout || uiOptions.noHeader === true;
		this.state = {
			collapsed: hideHeader ? false : collapsed,
		};
	}

	componentDidUpdate(prevProps: ObjectFieldTemplateProps): void {
		const prevOptionsRaw = prevProps.uiSchema?.['ui:options'];
		const prevOptions = isRecord(prevOptionsRaw) ? prevOptionsRaw : {};
		const nextOptionsRaw = this.props.uiSchema?.['ui:options'];
		const nextOptions = isRecord(nextOptionsRaw) ? nextOptionsRaw : {};
		const prevCollapsed = prevOptions.collapsed === true;
		const nextCollapsed = nextOptions.collapsed === true;

		const classNames = typeof this.props.uiSchema?.['ui:classNames'] === 'string' ? this.props.uiSchema['ui:classNames'] : '';
		const optionClassNames = typeof nextOptions.classNames === 'string' ? nextOptions.classNames : '';
		const hasInlineLayout = nextOptions.oneRow === true
			|| classNames.includes('cgenh-config-field--inline')
			|| optionClassNames.includes('cgenh-config-field--inline');
		const hideHeader = hasInlineLayout || nextOptions.noHeader === true;

		if (hideHeader) {
			if (this.state.collapsed) {
				this.setState({ collapsed: false });
			}
			return;
		}
		if (prevCollapsed !== nextCollapsed && this.state.collapsed !== nextCollapsed) {
			this.setState({ collapsed: nextCollapsed });
		}
	}

	private toggleCollapsed = () => {
		this.setState((prev) => ({ collapsed: !prev.collapsed }));
	};

	private handleHelperChange = (next: any) => {
		const formContext = this.props.registry?.formContext;
		if (!isRecord(formContext) || typeof formContext.updateFormData !== 'function') {
			return;
		}
		const fieldPath = this.props.fieldPathId?.path;
		if (!Array.isArray(fieldPath)) {
			return;
		}

		let normalized = next;
		if (normalized === undefined || normalized === null) {
			normalized = {};
		}

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

		// Check if this is the root object or a nested object
		// Root object has $id === 'root' or empty path
		const currentId = fieldPathId?.$id || '';
		const isRoot = !currentId || currentId === 'root';

		// Get col class from ui:options for nested objects
		const rawOptions = uiSchema?.['ui:options'];
		const uiOptions = isRecord(rawOptions) ? rawOptions : {};
		const helper = typeof uiOptions.helper === 'string' ? uiOptions.helper : undefined;
		const helperFormat = typeof uiOptions.format === 'string' ? uiOptions.format : undefined;
		const hasSelectionHelper = typeof helper === 'string' && !!helper.trim();
		const hasViewHelper = isHelperFormat(helperFormat);
		const visibleOpt = uiOptions.visible;
		const optionClassNamesRaw = typeof uiOptions.classNames === 'string' ? uiOptions.classNames : undefined;
		const isDefinitionRef = Boolean(uiOptions.isDefinitionRef || schema.$ref);
		const noHeader = uiOptions.noHeader === true;
		const isCollapsed = this.state.collapsed;
		const toggleLabel = isCollapsed ? translation.list.expand.getTrans() : translation.list.collapse.getTrans();

		// Check if grid layout is requested
		const classNames = typeof uiSchema?.['ui:classNames'] === 'string' ? uiSchema['ui:classNames'] : '';

		// Check if inline layout is requested (from parent's gridOptions: ['oneRow'])
		const optionClassNames = optionClassNamesRaw || '';
		const hasInlineLayout = uiOptions.oneRow === true
			|| classNames.includes('cgenh-config-field--inline')
			|| optionClassNames.includes('cgenh-config-field--inline');
		const showHeader = !hasInlineLayout && !noHeader;
		const canCollapse = !isRoot && showHeader;
		const effectiveCollapsed = canCollapse && isCollapsed;

		// Get raw description string from schema
		const rawDescription = typeof schema.description === 'string' ? schema.description : undefined;

		const helperWidgetBaseProps: WidgetProps | null = (hasSelectionHelper || hasViewHelper) ? (() => {
			const fieldId = typeof fieldPathId?.$id === 'string' && fieldPathId.$id ? fieldPathId.$id : 'object';
			return {
				id: `${fieldId}__helper`,
				value: this.props.formData,
				disabled: this.props.disabled || false,
				readonly: this.props.readonly || false,
				onChange: this.handleHelperChange,
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
				rawErrors: [],
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

		// For root level, use stack or grid layout
		if (isRoot) {
			return (
				<div className="row">
					{bodyHelperWidget && <div className="col-12 mb-2">{bodyHelperWidget}</div>}
					{headerHelperWidget && !bodyHelperWidget && <div className="col-12 mb-2">{headerHelperWidget}</div>}
					{properties.map((prop) => prop.content)}
				</div>
			);
		}

		const currentPath = currentId.replace(/^root_?/, '').replace(/_/g, '.');
		const parentPath = currentPath.split('.').slice(0, -1).join('.');
		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, parentPath);

		if (!isVisible) {
			return <div className="d-none">{properties.map((prop) => prop.content)}</div>;
		}

		const parentClasses = [
			'cgenh-config-field',
			stripCgenhClasses(optionClassNamesRaw),
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
								<div className={hasInlineLayout ? 'row g-2' : 'row g-2'}>
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
					<div className={hasInlineLayout ? 'row g-2' : 'row g-2'}>
						{properties.map((prop) => prop.content)}
					</div>
				)}
			</div>
		);
	}
}

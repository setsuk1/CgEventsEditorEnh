import { ArrayFieldItemTemplateProps, ArrayFieldTemplateProps, WidgetProps } from '@rjsf/utils';
import React from 'react';
import { translation } from '../../../trans/Trans';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { Tooltip } from '../../components/common/Tooltip';
import { SvgChevronDown } from '../../svg/SvgChevronDown';
import { SvgChevronRight } from '../../svg/SvgChevronRight';
import { SvgCopy } from '../../svg/SvgCopy';
import { SvgMoveDownFilled } from '../../svg/SvgMoveDownFilled';
import { SvgMoveUpFilled } from '../../svg/SvgMoveUpFilled';
import { SvgPlus } from '../../svg/SvgPlus';
import { SvgRemoveX } from '../../svg/SvgRemoveX';
import { SvgTrash } from '../../svg/SvgTrash';
import { HelperWidget } from '../widgets/HelperWidget';
import { isHelperFormat, isRecord, stripCgenhClasses } from '../utils/rjsfUtils';
import { evaluateVisibleOption } from '../utils/visibleOption';

/**
 * Render a single array item with controls
 */
export class ArrayFieldItemTemplate extends React.PureComponent<ArrayFieldItemTemplateProps, {}> {
	render() {
		const { children, className, buttonsProps, disabled, readonly, hasToolbar } = this.props;
		const {
			hasCopy,
			hasMoveDown,
			hasMoveUp,
			hasRemove,
			onCopyItem,
			onMoveDownItem,
			onMoveUpItem,
			onRemoveItem,
		} = buttonsProps;
		const formContext = this.props.registry?.formContext;
		const commitArrayChange = isRecord(formContext) && typeof formContext.commitArrayChange === 'function'
			? formContext.commitArrayChange
			: undefined;
		const handleMoveUp = (event: React.MouseEvent<HTMLButtonElement>) => {
			commitArrayChange?.();
			onMoveUpItem(event);
		};
		const handleMoveDown = (event: React.MouseEvent<HTMLButtonElement>) => {
			commitArrayChange?.();
			onMoveDownItem(event);
		};
		const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
			commitArrayChange?.();
			onCopyItem(event);
		};
		const handleRemove = (event: React.MouseEvent<HTMLButtonElement>) => {
			commitArrayChange?.();
			onRemoveItem(event);
		};
		const showToolbar = hasToolbar && (hasMoveUp || hasMoveDown || hasRemove || hasCopy);
		const disableAll = disabled || readonly || buttonsProps.disabled || buttonsProps.readonly;
		const rootClass = [
			'border',
			'rounded',
			'p-2',
			className || '',
		].filter(Boolean).join(' ');

		return (
			<div className={rootClass}>
				<div className="d-flex flex-row align-items-start gap-2">
					<div className="flex-grow-1 min-w-0">{children}</div>
					{showToolbar && (
						<div className="btn-group-vertical" role="group" aria-label={translation.list.arrayItemActions.getTrans()}>
							{hasMoveUp && (
								<Tooltip content={translation.list.moveUp.getTrans()}>
									<button
										type="button"
										className="btn btn-sm btn-outline-secondary p-1"
										disabled={disableAll}
										onClick={handleMoveUp}
									>
										<SvgMoveUpFilled aria-hidden="true" />
									</button>
								</Tooltip>
							)}
							{hasMoveDown && (
								<Tooltip content={translation.list.moveDown.getTrans()}>
									<button
										type="button"
										className="btn btn-sm btn-outline-secondary p-1"
										disabled={disableAll}
										onClick={handleMoveDown}
									>
										<SvgMoveDownFilled aria-hidden="true" />
									</button>
								</Tooltip>
							)}
							{hasCopy && (
								<Tooltip content={translation.common.copy.getTrans()}>
									<button
										type="button"
										className="btn btn-sm btn-outline-secondary p-1"
										disabled={disableAll}
										onClick={handleCopy}
									>
										<SvgCopy aria-hidden="true" />
									</button>
								</Tooltip>
							)}
							{hasRemove && (
								<Tooltip content={translation.common.remove.getTrans()}>
									<button
										type="button"
										className="btn btn-sm btn-outline-danger p-1"
										disabled={disableAll}
										onClick={handleRemove}
									>
										<SvgRemoveX aria-hidden="true" />
									</button>
								</Tooltip>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}
}

interface ArrayFieldTemplateState {
	collapsed: boolean;
}

/**
 * Custom array field template for RJSF using Bootstrap
 */
export class ArrayFieldTemplate extends React.PureComponent<ArrayFieldTemplateProps, ArrayFieldTemplateState> {
	constructor(props: ArrayFieldTemplateProps) {
		super(props);
		const rawOptions = props.uiSchema?.['ui:options'];
		const uiOptions = isRecord(rawOptions) ? rawOptions : {};
		const classNames = typeof props.uiSchema?.['ui:classNames'] === 'string' ? props.uiSchema['ui:classNames'] : '';
		const propsClassNames = typeof props.className === 'string' ? props.className : '';
		const optionClassNames = typeof uiOptions.classNames === 'string' ? uiOptions.classNames : '';
		const hasInlineLayout = uiOptions.oneRow === true
			|| classNames.includes('cgenh-config-field--inline')
			|| propsClassNames.includes('cgenh-config-field--inline')
			|| optionClassNames.includes('cgenh-config-field--inline');
		const hideHeader = hasInlineLayout || uiOptions.noHeader === true;
		const collapsed = uiOptions.collapsed === true;
		this.state = {
			collapsed: hideHeader ? false : collapsed,
		};
	}

	componentDidUpdate(prevProps: ArrayFieldTemplateProps): void {
		const prevOptionsRaw = prevProps.uiSchema?.['ui:options'];
		const prevOptions = isRecord(prevOptionsRaw) ? prevOptionsRaw : {};
		const nextOptionsRaw = this.props.uiSchema?.['ui:options'];
		const nextOptions = isRecord(nextOptionsRaw) ? nextOptionsRaw : {};
		const prevCollapsed = prevOptions.collapsed === true;
		const nextCollapsed = nextOptions.collapsed === true;

		const classNames = typeof this.props.uiSchema?.['ui:classNames'] === 'string' ? this.props.uiSchema['ui:classNames'] : '';
		const propsClassNames = typeof this.props.className === 'string' ? this.props.className : '';
		const optionClassNames = typeof nextOptions.classNames === 'string' ? nextOptions.classNames : '';
		const hasInlineLayout = nextOptions.oneRow === true
			|| classNames.includes('cgenh-config-field--inline')
			|| propsClassNames.includes('cgenh-config-field--inline')
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

	private handleRemoveAll = () => {
		const formContext = this.props.registry?.formContext;
		if (!isRecord(formContext) || typeof formContext.updateFormData !== 'function') {
			return;
		}
		// Convert fieldPathId.$id to path array: "root_parent_child" -> ["parent", "child"]
		const currentId = this.props.fieldPathId?.$id || '';
		const pathStr = currentId.replace(/^root_?/, '');
		const path = pathStr ? pathStr.split('_') : [];
		formContext.updateFormData(path, [], true);
	};

	private handleArrayHelperChange = (next: any) => {
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
			normalized = [];
		} else if (!Array.isArray(normalized)) {
			normalized = [normalized];
		}

		formContext.updateFormData(fieldPath, normalized, true);
	};

	render() {
		const {
			canAdd,
			disabled,
			items,
			onAddClick,
			readonly,
			title,
			schema,
			uiSchema,
		} = this.props;

		const rawDescription = typeof schema.description === 'string' ? schema.description : undefined;
		const hideLabel = uiSchema?.['ui:label'] === false;
		const displayTitle = hideLabel ? '' : title;

		const rawOptions = uiSchema?.['ui:options'];
		const uiOptions = isRecord(rawOptions) ? rawOptions : {};
		const helper = typeof uiOptions.helper === 'string' ? uiOptions.helper : undefined;
		const helperFormat = typeof uiOptions.format === 'string' ? uiOptions.format : undefined;
		const hasSelectionHelper = typeof helper === 'string' && !!helper.trim();
		const hasViewHelper = isHelperFormat(helperFormat);
		const noHeader = uiOptions.noHeader === true;

		const uiClassNames = typeof uiSchema?.['ui:classNames'] === 'string' ? uiSchema['ui:classNames'] : '';
		const propsClassNames = typeof this.props.className === 'string' ? this.props.className : '';
		const optionClassNames = typeof uiOptions.classNames === 'string' ? uiOptions.classNames : '';
		const hasInlineLayout = uiOptions.oneRow === true
			|| uiClassNames.includes('cgenh-config-field--inline')
			|| propsClassNames.includes('cgenh-config-field--inline')
			|| optionClassNames.includes('cgenh-config-field--inline');
		const showHeader = !hasInlineLayout && !noHeader;

		const collapseId = this.props.fieldPathId?.$id || '';
		const isRoot = !collapseId || collapseId === 'root';

		const canCollapse = !isRoot && showHeader;
		const effectiveCollapsed = canCollapse && this.state.collapsed;
		const toggleLabel = effectiveCollapsed ? translation.list.expand.getTrans() : translation.list.collapse.getTrans();
		const rootClass = [
			'cgenh-config-field',
			stripCgenhClasses(this.props.className),
			stripCgenhClasses(typeof uiOptions.classNames === 'string' ? uiOptions.classNames : undefined),
		].filter(Boolean).join(' ');

		const formContext = this.props.registry?.formContext;
		const rootFormData = isRecord(formContext) ? formContext.rootFormData : undefined;
		const commitArrayChange = isRecord(formContext) && typeof formContext.commitArrayChange === 'function'
			? formContext.commitArrayChange
			: undefined;
		const registerArrayAdd = isRecord(formContext) && typeof formContext.registerArrayAdd === 'function'
			? formContext.registerArrayAdd
			: undefined;
		const handleAddClick = (event: React.MouseEvent<HTMLButtonElement>) => {
			registerArrayAdd?.(this.props.fieldPathId.path, items.length, schema.items);
			commitArrayChange?.();
			onAddClick(event);
		};
		const visibleOpt = uiOptions.visible;

		// Get the current field's parent path from fieldPathId for resolving sibling references
		// fieldPathId.$id format: "root_parent_child" -> convert to "parent.child"
		const currentId = this.props.fieldPathId?.$id || '';
		const currentPath = currentId.replace(/^root_?/, '').replace(/_/g, '.');
		const parentPath = currentPath.split('.').slice(0, -1).join('.');

		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, parentPath);

		if (!isVisible) {
			return <div className="d-none" />;
		}

		const helperWidgetBaseProps: WidgetProps | null = (hasSelectionHelper || hasViewHelper) ? (() => {
			const fieldId = typeof this.props.fieldPathId?.$id === 'string' && this.props.fieldPathId.$id
				? this.props.fieldPathId.$id
				: 'array';
			return {
				id: `${fieldId}__helper`,
				value: this.props.formData,
				disabled: disabled || false,
				readonly: readonly || false,
				onChange: this.handleArrayHelperChange,
				options: {
					helper,
					format: helperFormat,
					editorOptions: uiOptions.editorOptions,
				},
				schema: {
					...schema,
					type: 'array',
				},
				label: displayTitle,
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

		const actionButtons = (
			<>
				{items.length > 0 && (
					<Tooltip content={translation.list.removeAll.getTrans()}>
						<button
							type="button"
							className="btn btn-sm btn-outline-danger p-1"
							disabled={disabled || readonly}
							onClick={this.handleRemoveAll}
						>
							<SvgTrash width={14} height={14} aria-hidden="true" />
						</button>
					</Tooltip>
				)}
				{canAdd && (
					<Tooltip content={translation.list.addItem.getTrans()}>
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary p-1"
							disabled={disabled || readonly}
							onClick={handleAddClick}
						>
							<SvgPlus aria-hidden="true" />
						</button>
					</Tooltip>
				)}
			</>
		);

		return (
			<div className={rootClass}>
				{showHeader && (
					<div className="d-flex align-items-center justify-content-between gap-2 mb-1">
						<div className="d-flex align-items-center gap-2 min-w-0">
							{canCollapse && (
								<Tooltip content={toggleLabel}>
									<button
										type="button"
										className="btn btn-sm btn-outline-secondary p-1"
										onClick={this.toggleCollapsed}
										disabled={disabled || readonly}
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
							{displayTitle ? <span className="form-label mb-0 text-truncate">{displayTitle}</span> : null}
							{rawDescription && <InfoTooltip description={rawDescription} />}
							{headerHelperWidget}
						</div>
						<div className="d-flex gap-1">
							{actionButtons}
						</div>
					</div>
				)}

				{!showHeader && headerHelperWidget && <div className="mb-2">{headerHelperWidget}</div>}
				{!effectiveCollapsed && bodyHelperWidget && <div className="mb-2">{bodyHelperWidget}</div>}
				{!effectiveCollapsed && items.length === 0 && (
					<div className="text-body-secondary small fst-italic">{translation.validation.noItems.getTrans()}</div>
				)}

				{!effectiveCollapsed && (
					<div className="d-flex flex-column gap-2">
						{items}
					</div>
				)}

				{!showHeader && !effectiveCollapsed && (canAdd || items.length > 0) && (
					<div className="d-flex justify-content-end gap-1 mt-1">
						{actionButtons}
					</div>
				)}
			</div>
		);
	}
}

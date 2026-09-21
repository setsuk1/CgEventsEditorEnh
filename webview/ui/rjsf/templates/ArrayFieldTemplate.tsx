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
import { getRjsfImmediateCommitRequest } from '../widgets/RJSFImmediateCommit';
import { isHelperFormat, isRecord, stripCgenhClasses } from '../utils/rjsfUtils';
import { evaluateVisibleOption } from '../utils/visibleOption';
import { resolveArrayFieldLayoutOptions, resolveNextArrayFieldCollapsedState } from './FieldLayout';

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
		const requestImmediateCommit = getRjsfImmediateCommitRequest(this.props.registry?.formContext);
		const handleMoveUp = (event: React.MouseEvent<HTMLButtonElement>) => {
			requestImmediateCommit?.();
			onMoveUpItem(event);
		};
		const handleMoveDown = (event: React.MouseEvent<HTMLButtonElement>) => {
			requestImmediateCommit?.();
			onMoveDownItem(event);
		};
		const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
			requestImmediateCommit?.();
			onCopyItem(event);
		};
		const handleRemove = (event: React.MouseEvent<HTMLButtonElement>) => {
			requestImmediateCommit?.();
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
		const layout = resolveArrayFieldLayoutOptions(props.uiSchema, props.className);
		this.state = {
			collapsed: layout.hideHeader ? false : layout.collapsed,
		};
	}

	componentDidUpdate(prevProps: ArrayFieldTemplateProps): void {
		const previousLayout = resolveArrayFieldLayoutOptions(prevProps.uiSchema, prevProps.className);
		const nextLayout = resolveArrayFieldLayoutOptions(this.props.uiSchema, this.props.className);

		const nextCollapsed = resolveNextArrayFieldCollapsedState(
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

	private handleRemoveAll = () => {
		const formContext = this.props.registry?.formContext;
		if (!isRecord(formContext) || typeof formContext.updateFormData !== 'function') return;
		const fieldPath = this.props.fieldPathId?.path;
		if (!Array.isArray(fieldPath)) return;
		formContext.updateFormData(fieldPath, [], true);
	};

	private handleArrayHelperChange = (next: any) => {
		const formContext = this.props.registry?.formContext;
		if (!isRecord(formContext) || typeof formContext.updateFormData !== 'function') return;
		const fieldPath = this.props.fieldPathId?.path;
		if (!Array.isArray(fieldPath)) return;

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

		const layout = resolveArrayFieldLayoutOptions(uiSchema, this.props.className);
		const { uiOptions } = layout;
		const helper = typeof uiOptions.helper === 'string' ? uiOptions.helper : undefined;
		const helperFormat = typeof uiOptions.format === 'string' ? uiOptions.format : undefined;
		const hasSelectionHelper = typeof helper === 'string' && !!helper.trim();
		const hasViewHelper = isHelperFormat(helperFormat);
		const showHeader = !layout.hideHeader;

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
		const requestImmediateCommit = getRjsfImmediateCommitRequest(formContext);
		const registerArrayAdd = isRecord(formContext) && typeof formContext.registerArrayAdd === 'function'
			? formContext.registerArrayAdd
			: undefined;
		const handleAddClick = (event: React.MouseEvent<HTMLButtonElement>) => {
			registerArrayAdd?.(this.props.fieldPathId.path, items.length, schema.items);
			requestImmediateCommit?.();
			onAddClick(event);
		};
		const visibleOpt = uiOptions.visible;
		const parentPath = Array.isArray(this.props.fieldPathId?.path) ? this.props.fieldPathId.path.slice(0, -1) : [];
		const isVisible = evaluateVisibleOption(visibleOpt, rootFormData, parentPath);

		if (!isVisible) return <div className="d-none" />;

		const helperWidgetBaseProps: WidgetProps | null = (hasSelectionHelper || hasViewHelper) ? (() => {
			const fieldId = typeof this.props.fieldPathId?.$id === 'string' && this.props.fieldPathId.$id
				? this.props.fieldPathId.$id
				: 'array';
			return {
				id: `${fieldId}__helper`,
				name: fieldId,
				value: this.props.formData,
				disabled: disabled || false,
				readonly: readonly || false,
				onChange: this.handleArrayHelperChange,
				onBlur: (_id: string, _value: any) => undefined,
				onFocus: (_id: string, _value: any) => undefined,
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

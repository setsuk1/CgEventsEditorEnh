import React from 'react';
import {
	type FormContextType,
	type RJSFSchema,
	type StrictRJSFSchema,
	type WidgetProps,
} from '@rjsf/utils';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { translation } from '../../../trans/Trans';
import {
	getCheckboxValueKey,
	groupCheckboxItems,
	normalizeCheckboxOptionItems,
	parseCheckboxValues,
	resolveCheckboxGroupValues,
	resolveCheckboxSelectAllValues,
	toggleCheckboxItemValue,
	type CheckboxGroupBy,
	type CheckboxOptionItem,
} from './CheckboxListData';
import { commitRjsfWidgetValue, getRjsfImmediateCommitRequest } from './RJSFImmediateCommit';

interface CheckboxListWidgetState {
	collapsed: boolean;
	groupCollapsed: Set<string>;
}

type CheckboxListWidgetProps<T, S extends StrictRJSFSchema, F extends FormContextType> = WidgetProps<T, S, F>;

export class CheckboxListWidget<
	T = any,
	S extends StrictRJSFSchema = RJSFSchema,
	F extends FormContextType = any,
> extends React.PureComponent<CheckboxListWidgetProps<T, S, F>, CheckboxListWidgetState> {
	constructor(props: CheckboxListWidgetProps<T, S, F>) {
		super(props);
		this.state = {
			collapsed: props.options?.collapsed === true,
			groupCollapsed: new Set(),
		};
	}

	componentDidUpdate(prevProps: CheckboxListWidgetProps<T, S, F>): void {
		const prevCollapsed = prevProps.options?.collapsed === true;
		const nextCollapsed = this.props.options?.collapsed === true;
		if (prevCollapsed !== nextCollapsed && this.state.collapsed !== nextCollapsed) {
			this.setState({ collapsed: nextCollapsed });
		}
	}

	private getOptionItems(): CheckboxOptionItem[] {
		const { options, registry, name, schema, formContext, uiSchema } = this.props;
		const resolvedContext = formContext || registry?.formContext;
		const uiEnumNames = Array.isArray(uiSchema?.['ui:enumNames']) ? uiSchema['ui:enumNames'] : undefined;
		const itemUiSchema = uiSchema?.items && typeof uiSchema.items === 'object' && !Array.isArray(uiSchema.items)
			? uiSchema.items
			: undefined;
		const itemUiEnumNames = Array.isArray(itemUiSchema?.['ui:enumNames']) ? itemUiSchema['ui:enumNames'] : undefined;

		if (resolvedContext) {
			if (name === 'sources' && Array.isArray(resolvedContext.sourceOptions)) {
				return normalizeCheckboxOptionItems(resolvedContext.sourceOptions);
			}
			if (name === 'resourcesExclude' && Array.isArray(resolvedContext.resources)) {
				return normalizeCheckboxOptionItems(resolvedContext.resources);
			}
		}

		if (Array.isArray(options.availableOptions)) {
			return normalizeCheckboxOptionItems(options.availableOptions);
		}

		if (Array.isArray(options.enumOptions)) {
			const enumValues = options.enumOptions.map((option) => option.value);
			const enumLabels = options.enumOptions.map((option) => option.label);
			return normalizeCheckboxOptionItems(enumValues, enumLabels);
		}

		const itemSchema = schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)
			? schema.items
			: undefined;
		const itemSchemaWithEnumNames = itemSchema as (typeof itemSchema & { enumNames?: unknown }) | undefined;
		const schemaWithEnumNames = schema as S & { enumNames?: unknown };
		if (itemSchema && Array.isArray(itemSchema.enum)) {
			const itemEnumNames = Array.isArray(itemSchemaWithEnumNames?.enumNames)
				? itemSchemaWithEnumNames.enumNames
				: (itemUiEnumNames || uiEnumNames);
			return normalizeCheckboxOptionItems(itemSchema.enum, itemEnumNames);
		}

		if (Array.isArray(schema.enum)) {
			const enumNames = Array.isArray(schemaWithEnumNames.enumNames) ? schemaWithEnumNames.enumNames : uiEnumNames;
			return normalizeCheckboxOptionItems(schema.enum, enumNames);
		}

		return [];
	}

	private getGroupBy(): CheckboxGroupBy {
		const { options } = this.props;
		if (options.groupBy === 'prefix') return 'prefix';
		if (options.groupBy === 'extension') return 'extension';
		return 'none';
	}

	private getInvertSelection(): boolean {
		return this.props.options.invertSelection === true;
	}

	private toggleCollapsed = () => {
		this.setState((prev) => ({ collapsed: !prev.collapsed }));
	};

	private toggleGroupCollapsed = (group: string) => {
		this.setState((prev) => {
			const groupCollapsed = new Set(prev.groupCollapsed);
			if (groupCollapsed.has(group)) groupCollapsed.delete(group);
			else groupCollapsed.add(group);
			return { groupCollapsed };
		});
	};

	private commitValue(next: T): void {
		const formContext = this.props.formContext || this.props.registry?.formContext;
		commitRjsfWidgetValue(
			next,
			this.props.onChange,
			getRjsfImmediateCommitRequest(formContext),
		);
	}

	private handleItemToggle = (item: CheckboxOptionItem) => {
		this.commitValue(toggleCheckboxItemValue(this.props.value, item) as unknown as T);
	};

	private handleSelectAll = (allSelected: boolean) => {
		const availableOptions = this.getOptionItems().map((item) => item.value);
		this.commitValue(
			resolveCheckboxSelectAllValues(
				availableOptions,
				allSelected,
				this.getInvertSelection(),
			) as unknown as T,
		);
	};

	private handleGroupSelectAll = (items: CheckboxOptionItem[], allSelectedInGroup: boolean) => {
		this.commitValue(
			resolveCheckboxGroupValues(
				this.props.value,
				items,
				allSelectedInGroup,
				this.getInvertSelection(),
			) as unknown as T,
		);
	};

	render() {
		const {
			disabled,
			readonly,
			value,
			id,
			label,
			hideLabel,
			options,
			schema,
		} = this.props;
		const availableOptions = this.getOptionItems();
		const currentValue = parseCheckboxValues(value);
		const currentValueKeys = new Set(currentValue.map((item) => getCheckboxValueKey(item)));
		const invertSelection = this.getInvertSelection();
		const isChecked = (item: CheckboxOptionItem) => invertSelection ? !currentValueKeys.has(item.key) : currentValueKeys.has(item.key);

		const optionsByValue = new Map<string, CheckboxOptionItem>();
		availableOptions.forEach((option) => optionsByValue.set(option.key, option));
		currentValue.forEach((itemValue) => {
			const key = getCheckboxValueKey(itemValue);
			if (!optionsByValue.has(key)) optionsByValue.set(key, { key, value: itemValue, displayName: String(itemValue) });
		});
		const allItems = Array.from(optionsByValue.values());

		if (allItems.length === 0) {
			return (
				<div className="cgenh-checkbox text-body-secondary small">
					{translation.validation.noItems.getTrans()}
				</div>
			);
		}

		const groupBy = this.getGroupBy();
		const showGroups = groupBy !== 'none';
		const grouped = showGroups ? groupCheckboxItems(allItems, groupBy, translation.common.other.getTrans()) : new Map<string, CheckboxOptionItem[]>();
		const sortedGroups = showGroups ? Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b)) : [];
		const allSelected = allItems.every(isChecked);

		const baseId = id || 'checkbox-list';
		const showLabel = !!label && (!hideLabel || options.showLabel === true);
		const description = typeof schema.description === 'string' ? schema.description : undefined;
		const headerClass = [
			'cgenh-checkbox__header',
			showLabel ? '' : 'cgenh-checkbox__header--no-label',
		].filter(Boolean).join(' ');

		return (
			<div className="cgenh-checkbox">
				<div className={headerClass}>
					{showLabel && (
						<div className="cgenh-checkbox__header-label">
							<span className="form-label mb-0 text-truncate">{label}</span>
							{description && <InfoTooltip description={description} />}
						</div>
					)}
					<div className="cgenh-checkbox__header-actions">
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary"
							onClick={this.toggleCollapsed}
							disabled={disabled || readonly}
						>
							{this.state.collapsed ? translation.list.expand.getTrans() : translation.list.collapse.getTrans()}
						</button>
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary"
							onClick={() => this.handleSelectAll(allSelected)}
							disabled={disabled || readonly}
						>
							{allSelected ? translation.list.cancelSelectAll.getTrans() : translation.list.selectAll.getTrans()}
						</button>
					</div>
				</div>

				{!this.state.collapsed && (
					showGroups ? (
						<div className="cgenh-checkbox__groups">
							{sortedGroups.map((group, groupIndex) => {
								const items = grouped.get(group) ?? [];
								const isGroupCollapsed = this.state.groupCollapsed.has(group);
								const allSelectedInGroup = items.every(isChecked);

								return (
									<div key={group} className="cgenh-checkbox__group">
										<div className="cgenh-checkbox__group-header">
											<span className="cgenh-checkbox__group-title">{group}</span>
											<button
												type="button"
												className="btn btn-sm btn-outline-secondary"
												onClick={() => this.toggleGroupCollapsed(group)}
												disabled={disabled || readonly}
											>
												{isGroupCollapsed ? translation.list.expand.getTrans() : translation.list.collapse.getTrans()}
											</button>
											<button
												type="button"
												className="btn btn-sm btn-outline-secondary"
												onClick={() => this.handleGroupSelectAll(items, allSelectedInGroup)}
												disabled={disabled || readonly}
											>
												{allSelectedInGroup ? translation.list.cancelSelectAll.getTrans() : translation.list.selectAll.getTrans()}
											</button>
										</div>
										{!isGroupCollapsed && (
											<div className="cgenh-checkbox__items cgenh-checkbox__items--grouped">
												{items.map((item, index) => {
													const itemId = `${baseId}_group_${groupIndex}_${index}`;
													return (
														<div key={item.key} className="cgenh-checkbox__item">
															<input
																id={itemId}
																type="checkbox"
																checked={isChecked(item)}
																onChange={() => this.handleItemToggle(item)}
																disabled={disabled || readonly}
																className="form-check-input"
															/>
															<label htmlFor={itemId} className="cgenh-checkbox__label">
																{item.displayName}
															</label>
														</div>
													);
												})}
											</div>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="cgenh-checkbox__items">
							{allItems.map((item, index) => {
								const itemId = `${baseId}_${index}`;
								return (
									<div key={item.key} className="cgenh-checkbox__item">
										<input
											id={itemId}
											type="checkbox"
											checked={isChecked(item)}
											onChange={() => this.handleItemToggle(item)}
											disabled={disabled || readonly}
											className="form-check-input"
										/>
										<label htmlFor={itemId} className="cgenh-checkbox__label">
											{item.displayName}
										</label>
									</div>
								);
							})}
						</div>
					)
				)}
			</div>
		);
	}
}

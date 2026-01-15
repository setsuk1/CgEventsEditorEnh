import React from 'react';
import {
	type FormContextType,
	type RJSFSchema,
	type StrictRJSFSchema,
	type WidgetProps,
} from '@rjsf/utils';
import { InfoTooltip } from '../../components/common/InfoTooltip';
import { translation } from '../../../trans/Trans';

interface CheckboxListWidgetState {
	collapsed: boolean;
	groupCollapsed: Record<string, boolean>;
}

interface GroupedItem {
	value: string;
	displayName: string;
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
			groupCollapsed: {},
		};
	}

	componentDidUpdate(prevProps: CheckboxListWidgetProps<T, S, F>): void {
		const prevCollapsed = prevProps.options?.collapsed === true;
		const nextCollapsed = this.props.options?.collapsed === true;
		if (prevCollapsed !== nextCollapsed && this.state.collapsed !== nextCollapsed) {
			this.setState({ collapsed: nextCollapsed });
		}
	}

	private parseValue(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value.map((v) => String(v ?? '').trim()).filter(Boolean);
		}
		if (typeof value === 'string') {
			return value
				.split(',')
				.map((v) => v.trim())
				.filter(Boolean);
		}
		return [];
	}

	private normalizeOptionValue(value: unknown): string {
		return String(value ?? '').trim();
	}

	private normalizeOptionItems(values: unknown[], labels?: unknown[]): GroupedItem[] {
		const normalized: GroupedItem[] = [];
		const labelList = Array.isArray(labels) ? labels : undefined;
		values.forEach((value, index) => {
			const normalizedValue = this.normalizeOptionValue(value);
			if (!normalizedValue) {
				return;
			}
			const labelValue = labelList ? labelList[index] : undefined;
			const normalizedLabel = typeof labelValue === 'string' ? labelValue.trim() : '';
			normalized.push({
				value: normalizedValue,
				displayName: normalizedLabel || normalizedValue,
			});
		});
		return normalized;
	}

	private getOptionItems(): GroupedItem[] {
		const { options, registry, id, schema, formContext, uiSchema } = this.props;
		const resolvedContext = formContext || registry?.formContext;
		const uiEnumNames = Array.isArray(uiSchema?.['ui:enumNames']) ? uiSchema['ui:enumNames'] : undefined;
		const itemUiSchema = uiSchema?.items && typeof uiSchema.items === 'object' && !Array.isArray(uiSchema.items)
			? uiSchema.items
			: undefined;
		const itemUiEnumNames = Array.isArray(itemUiSchema?.['ui:enumNames']) ? itemUiSchema['ui:enumNames'] : undefined;

		// Try to get options from formContext based on field name
		if (resolvedContext) {
			// Extract field name from id (e.g., "root_preload_sources" -> "sources")
			const fieldName = id?.split('_').pop();
			if (fieldName === 'sources' && Array.isArray(resolvedContext.sourceOptions)) {
				return this.normalizeOptionItems(resolvedContext.sourceOptions);
			}
			if (fieldName === 'resourcesExclude' && Array.isArray(resolvedContext.resources)) {
				return this.normalizeOptionItems(resolvedContext.resources);
			}
		}

		// Fallback to options.availableOptions if provided
		if (Array.isArray(options.availableOptions)) {
			return this.normalizeOptionItems(options.availableOptions);
		}

		if (Array.isArray(options.enumOptions)) {
			const enumValues = options.enumOptions.map((option) => option.value);
			const enumLabels = options.enumOptions.map((option) => option.label);
			return this.normalizeOptionItems(enumValues, enumLabels);
		}

		const itemSchema = schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)
			? schema.items
			: undefined;
		if (itemSchema && Array.isArray(itemSchema.enum)) {
			const itemEnumNames = Array.isArray(itemSchema.enumNames)
				? itemSchema.enumNames
				: (itemUiEnumNames || uiEnumNames);
			return this.normalizeOptionItems(itemSchema.enum, itemEnumNames);
		}

		if (Array.isArray(schema.enum)) {
			const enumNames = Array.isArray(schema.enumNames)
				? schema.enumNames
				: uiEnumNames;
			return this.normalizeOptionItems(schema.enum, enumNames);
		}

		return [];
	}

	private getGroupBy(): 'extension' | 'prefix' | 'none' {
		const { options } = this.props;
		if (options.groupBy === 'prefix') {
			return 'prefix';
		}
		if (options.groupBy === 'extension') {
			return 'extension';
		}
		return 'none';
	}

	private getInvertSelection(): boolean {
		const { options } = this.props;
		return options.invertSelection === true;
	}

	private groupItems(items: GroupedItem[], groupBy: 'extension' | 'prefix'): Record<string, GroupedItem[]> {
		const grouped: Record<string, GroupedItem[]> = {};

		items.forEach((item) => {
			let groupKey: string;
			let displayName: string;
			const value = item.value;

			if (groupBy === 'extension') {
				// Group by file extension (last dot)
				const dotIdx = value.lastIndexOf('.');
				groupKey = dotIdx >= 0 ? value.slice(dotIdx + 1) || translation.common.other.getTrans() : translation.common.other.getTrans();
				displayName = item.displayName;
			} else {
				// Group by prefix (first dot) - for resources like "ProjectCode.ResourceName"
				const dotIdx = value.indexOf('.');
				groupKey = dotIdx > 0 ? value.slice(0, dotIdx) : translation.common.other.getTrans();
				if (dotIdx > 0) {
					const prefix = `${groupKey}.`;
					displayName = item.displayName.startsWith(prefix) ? item.displayName.slice(prefix.length) : item.displayName;
				} else {
					displayName = item.displayName;
				}
			}

			if (!grouped[groupKey]) {
				grouped[groupKey] = [];
			}
			grouped[groupKey].push({ value, displayName });
		});

		return grouped;
	}

	private toggleCollapsed = () => {
		this.setState((prev) => ({ collapsed: !prev.collapsed }));
	};

	private toggleGroupCollapsed = (group: string) => {
		this.setState((prev) => ({
			groupCollapsed: {
				...prev.groupCollapsed,
				[group]: !prev.groupCollapsed[group],
			},
		}));
	};

	private handleItemToggle = (item: string) => {
		const { onChange, value } = this.props;
		const currentValue = this.parseValue(value);
		const invertSelection = this.getInvertSelection();
		const newValue = new Set(currentValue);

		if (invertSelection) {
			// For inverted selection (resources): checked = NOT in array (not excluded)
			if (newValue.has(item)) {
				newValue.delete(item);
			} else {
				newValue.add(item);
			}
		} else {
			// Normal selection (sources): checked = IN array
			if (newValue.has(item)) {
				newValue.delete(item);
			} else {
				newValue.add(item);
			}
		}

		onChange(Array.from(newValue) as unknown as T);
	};

	private handleSelectAll = (allSelected: boolean) => {
		const { onChange } = this.props;
		const availableOptions = this.getOptionItems().map((item) => item.value);
		const invertSelection = this.getInvertSelection();

		if (invertSelection) {
			// For inverted selection: allSelected means array is empty (nothing excluded)
			if (allSelected) {
				// Deselect all -> add all to exclusion list
				onChange(availableOptions as unknown as T);
			} else {
				// Select all -> clear exclusion list
				onChange([] as unknown as T);
			}
		} else {
			// Normal selection: allSelected means all items are in array
			if (allSelected) {
				// Deselect all -> clear array
				onChange([] as unknown as T);
			} else {
				// Select all -> add all items
				onChange(availableOptions as unknown as T);
			}
		}
	};

	private handleGroupSelectAll = (group: string, items: GroupedItem[], allSelectedInGroup: boolean) => {
		const { onChange, value } = this.props;
		const currentValue = this.parseValue(value);
		const invertSelection = this.getInvertSelection();
		const newValue = new Set(currentValue);

		if (invertSelection) {
			if (allSelectedInGroup) {
				// Deselect all in group -> add all to exclusion
				items.forEach(({ value: itemValue }) => newValue.add(itemValue));
			} else {
				// Select all in group -> remove from exclusion
				items.forEach(({ value: itemValue }) => newValue.delete(itemValue));
			}
		} else {
			if (allSelectedInGroup) {
				// Deselect all in group -> remove from selection
				items.forEach(({ value: itemValue }) => newValue.delete(itemValue));
			} else {
				// Select all in group -> add to selection
				items.forEach(({ value: itemValue }) => newValue.add(itemValue));
			}
		}

		onChange(Array.from(newValue) as unknown as T);
	};

	private isItemChecked(item: string): boolean {
		const { value } = this.props;
		const currentValue = this.parseValue(value);
		const invertSelection = this.getInvertSelection();
		const isInArray = currentValue.includes(item);

		// For inverted selection: checked = NOT in array
		// For normal selection: checked = IN array
		return invertSelection ? !isInArray : isInArray;
	}

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
		const currentValue = this.parseValue(value);
		const invertSelection = this.getInvertSelection();

		// Include any values that are in the current selection but not in available options
		const optionsByValue = new Map<string, GroupedItem>();
		availableOptions.forEach((option) => {
			optionsByValue.set(option.value, option);
		});
		currentValue.forEach((itemValue) => {
			if (!optionsByValue.has(itemValue)) {
				optionsByValue.set(itemValue, { value: itemValue, displayName: itemValue });
			}
		});
		const allItems = Array.from(optionsByValue.values());
		const hasOptions = allItems.length > 0;

		if (!hasOptions) {
			return (
				<div className="cgenh-checkbox text-body-secondary small">
					{translation.validation.noItems.getTrans()}
				</div>
			);
		}

		const groupBy = this.getGroupBy();
		const showGroups = groupBy !== 'none';
		const grouped = showGroups ? this.groupItems(allItems, groupBy) : {};
		const sortedGroups = showGroups ? Object.keys(grouped).sort((a, b) => a.localeCompare(b)) : [];

		// Calculate if all items are selected
		const allValues = allItems.map((item) => item.value);
		const allSelected = invertSelection
			? allValues.every((itemValue) => !currentValue.includes(itemValue))
			: allValues.every((itemValue) => currentValue.includes(itemValue));

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
							{sortedGroups.map((group) => {
								const items = grouped[group];
								const isGroupCollapsed = !!this.state.groupCollapsed[group];
								const allSelectedInGroup = invertSelection
									? items.every(({ value: itemValue }) => !currentValue.includes(itemValue))
									: items.every(({ value: itemValue }) => currentValue.includes(itemValue));

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
												onClick={() => this.handleGroupSelectAll(group, items, allSelectedInGroup)}
												disabled={disabled || readonly}
											>
												{allSelectedInGroup ? translation.list.cancelSelectAll.getTrans() : translation.list.selectAll.getTrans()}
											</button>
										</div>
										{!isGroupCollapsed && (
											<div className="cgenh-checkbox__items cgenh-checkbox__items--grouped">
												{items.map(({ value: itemValue, displayName }, index) => {
													const safeGroup = group.replace(/[^a-zA-Z0-9_-]+/g, '-');
													const itemId = `${baseId}_${safeGroup}_${index}`;
													return (
														<div key={itemValue} className="cgenh-checkbox__item">
															<input
																id={itemId}
																type="checkbox"
																checked={this.isItemChecked(itemValue)}
																onChange={() => this.handleItemToggle(itemValue)}
																disabled={disabled || readonly}
																className="form-check-input"
															/>
															<label htmlFor={itemId} className="cgenh-checkbox__label">
																{displayName}
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
									<div key={item.value} className="cgenh-checkbox__item">
										<input
											id={itemId}
											type="checkbox"
											checked={this.isItemChecked(item.value)}
											onChange={() => this.handleItemToggle(item.value)}
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

function getResponsiveGridClasses(gridOptions: number | undefined): string {
	const normalizedValue = Math.min(Math.max(gridOptions ?? 12, 1), 12);
	if (normalizedValue === 12) return 'col-12';
	if (normalizedValue > 6) return `col-12 col-sm-${normalizedValue}`;
	return `col-12 col-sm-6 col-md-${normalizedValue}`;
}

export interface SchemaGridLayoutInput {
	useGridLayout: boolean;
	gridColumns?: unknown;
	gridOptions?: readonly string[];
	inheritedGridOptions?: readonly string[];
	inheritedHasSingleField?: boolean;
}

export interface SchemaGridLayout {
	colClass: string;
	oneRow: boolean;
	fullWidth: boolean;
	noHeader: boolean;
}

function includesGridOption(
	options: readonly string[] | undefined,
	option: string,
): boolean {
	return options?.includes(option) === true;
}

export function resolveSchemaGridLayout(
	input: SchemaGridLayoutInput,
): SchemaGridLayout {
	const gridColumns = input.useGridLayout ? input.gridColumns : undefined;
	const colSize = typeof gridColumns === 'number' && Number.isFinite(gridColumns) && gridColumns > 0
		? Math.min(12, Math.max(1, gridColumns))
		: 12;
	const hasOneRow =
		includesGridOption(input.gridOptions, 'oneRow')
		|| includesGridOption(input.inheritedGridOptions, 'oneRow')
		|| input.inheritedHasSingleField === true;
	const hasFullWidth =
		includesGridOption(input.gridOptions, 'fullwidth')
		|| includesGridOption(input.inheritedGridOptions, 'fullwidth');
	const hasNoHeader =
		includesGridOption(input.gridOptions, 'noHeader')
		|| includesGridOption(input.inheritedGridOptions, 'noHeader');

	const oneRow = input.useGridLayout && hasOneRow;
	const fullWidth = input.useGridLayout && hasFullWidth;
	const noHeader = input.useGridLayout && hasNoHeader;
	return {
		colClass: getResponsiveGridClasses(fullWidth ? 12 : colSize),
		oneRow,
		fullWidth,
		noHeader,
	};
}

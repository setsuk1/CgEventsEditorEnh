export function getResponsiveGridClasses(gridOptions: number | undefined): string {
	const normalizedValue = Math.min(Math.max(gridOptions ?? 12, 1), 12);

	if (normalizedValue === 12) {
		return 'col-xs-12';
	}
	if (normalizedValue > 6) {
		return `col-xs-12 col-sm-${normalizedValue}`;
	}
	return `col-xs-12 col-sm-6 col-md-${normalizedValue}`;
}

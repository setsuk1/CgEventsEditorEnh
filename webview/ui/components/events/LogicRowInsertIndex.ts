export function computeLogicRowInsertIndex(
	itemsElement: Element,
	elementsAtPoint: Element[],
	clientY: number
): number {
	for (let i = 0; i < elementsAtPoint.length; i++) {
		const elem = elementsAtPoint[i];
		if (!(elem instanceof HTMLElement)) {
			continue;
		}
		const row = elem.classList.contains('cgenh-logic-row')
			? elem
			: elem.closest?.('.cgenh-logic-row');
		if (!(row instanceof HTMLElement)) {
			continue;
		}
		if (!itemsElement.contains(row)) {
			continue;
		}
		const rawIndex = row.getAttribute('data-logic-index');
		if (!rawIndex) {
			continue;
		}
		const index = Number.parseInt(rawIndex, 10);
		if (!Number.isFinite(index)) {
			continue;
		}
		const rect = row.getBoundingClientRect();
		const mid = rect.top + rect.height / 2;
		return clientY < mid ? index : index + 1;
	}

	const logicRows = itemsElement.querySelectorAll('.cgenh-logic-row');
	if (logicRows.length === 0) {
		return 0;
	}

	for (let i = 0; i < logicRows.length; i++) {
		const row = logicRows[i];
		if (!(row instanceof HTMLElement)) {
			continue;
		}
		const rect = row.getBoundingClientRect();
		if (clientY < rect.top + rect.height / 2) {
			const rawIndex = row.getAttribute('data-logic-index');
			if (rawIndex) {
				const index = Number.parseInt(rawIndex, 10);
				if (Number.isFinite(index)) {
					return index;
				}
			}
			return i;
		}
	}

	const last = logicRows[logicRows.length - 1];
	if (last instanceof HTMLElement) {
		const rawIndex = last.getAttribute('data-logic-index');
		if (rawIndex) {
			const index = Number.parseInt(rawIndex, 10);
			if (Number.isFinite(index)) {
				return index + 1;
			}
		}
	}
	return logicRows.length;
}


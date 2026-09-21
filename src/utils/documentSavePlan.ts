export type DocumentSaveAction =
	| 'send-current'
	| 'save-current'
	| 'apply-edit'
	| 'reject-stale';

export interface DocumentSavePlanInput {
	baseVersion: number | undefined;
	currentVersion: number;
	serializedText: string;
	currentText: string;
	isDirty: boolean;
	acceptedBaseVersion?: number;
	lastAppliedVersion?: number;
}

export function resolveDocumentSaveAction(
	input: DocumentSavePlanInput,
): DocumentSaveAction {
	if (input.serializedText === input.currentText) {
		return input.isDirty ? 'save-current' : 'send-current';
	}
	const canApplyCurrentSnapshot = input.baseVersion !== undefined && (
		input.baseVersion === input.currentVersion
		|| (
			input.baseVersion === input.acceptedBaseVersion
			&& input.currentVersion === input.lastAppliedVersion
		)
	);
	return canApplyCurrentSnapshot ? 'apply-edit' : 'reject-stale';
}

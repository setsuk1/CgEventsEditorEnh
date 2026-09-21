export type RjsfImmediateCommitRequest = () => void;

export function getRjsfImmediateCommitRequest(
	formContext: unknown,
): RjsfImmediateCommitRequest | undefined {
	if (!formContext || typeof formContext !== 'object') return undefined;
	const candidate = (formContext as Record<string, unknown>).requestImmediateCommit;
	return typeof candidate === 'function'
		? candidate as RjsfImmediateCommitRequest
		: undefined;
}

export function commitRjsfWidgetValue<T>(
	value: T,
	onChange: (value: T) => void,
	requestCommit?: RjsfImmediateCommitRequest,
): void {
	requestCommit?.();
	onChange(value);
}

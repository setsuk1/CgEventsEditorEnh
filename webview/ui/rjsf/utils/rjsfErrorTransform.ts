import { RJSFValidationError } from '@rjsf/utils';

function hasLimit(params: unknown): params is { limit: unknown } {
	return !!params && typeof params === 'object' && 'limit' in params;
}

function isLimitOne(params: unknown): boolean {
	if (!hasLimit(params)) {
		return false;
	}
	return params.limit === 1;
}

export function transformRjsfValidationErrors(
	errors: RJSFValidationError[],
	requiredMessage: string
): RJSFValidationError[] {
	if (!Array.isArray(errors) || errors.length === 0) {
		return errors;
	}
	if (!requiredMessage) {
		return errors;
	}

	let changed = false;
	const next = errors.map((error) => {
		const name = error.name;
		const isRequired =
			name === 'required' ||
			(name === 'minLength' && isLimitOne(error.params)) ||
			(name === 'minItems' && isLimitOne(error.params));
		if (!isRequired) {
			return error;
		}
		if (error.message === requiredMessage) {
			return error;
		}
		changed = true;
		return { ...error, message: requiredMessage };
	});
	return changed ? next : errors;
}

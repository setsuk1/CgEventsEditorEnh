import { translation } from '../../../trans/Trans';
import { EVENT_FOLDER_REGEX, EVENT_NAME_REGEX } from '../../utils/validators';

export type EventIdentityValidationError =
	| 'event-id-required'
	| 'event-id-invalid'
	| 'event-id-exists'
	| 'event-folder-invalid';

export interface EventIdentityValidationResult {
	value: string;
	error?: EventIdentityValidationError;
}

export function validateEventId(
	rawValue: unknown,
	currentEventId: string,
	eventIdExists: (eventId: string) => boolean,
): EventIdentityValidationResult {
	const value = typeof rawValue === 'string' ? rawValue.trim() : '';
	if (!value) {
		return { value, error: 'event-id-required' };
	}
	if (!EVENT_NAME_REGEX.test(value)) {
		return { value, error: 'event-id-invalid' };
	}
	if (value !== currentEventId && eventIdExists(value)) {
		return { value, error: 'event-id-exists' };
	}
	return { value };
}

export function validateEventFolder(rawValue: unknown): EventIdentityValidationResult {
	const value = typeof rawValue === 'string' ? rawValue.trim() : '';
	if (!EVENT_FOLDER_REGEX.test(value)) {
		return { value, error: 'event-folder-invalid' };
	}
	return { value };
}

export function getEventIdentityValidationMessage(
	error: EventIdentityValidationError,
): string {
	switch (error) {
		case 'event-id-required':
			return translation.events.eventNameRequired.getTrans();
		case 'event-id-invalid':
			return translation.events.eventNameInvalid.getTrans();
		case 'event-id-exists':
			return translation.events.eventNameExists.getTrans();
		case 'event-folder-invalid':
			return translation.events.folderNameInvalid.getTrans();
	}
	const exhaustive: never = error;
	return exhaustive;
}

import { editor } from '../../../editor/CgEventsEditor';
import { resolveSuggestions } from '../../utils/suggestionResolver';
import { isRecord } from '../utils/rjsfUtils';

export interface WidgetSuggestionContext {
	suggestions: Array<{ value: string; label: string }>;
}

export function buildWidgetSuggestionContext(options: unknown, _formContext: unknown): WidgetSuggestionContext {
	const rawOptions = isRecord(options) ? options : undefined;
	const rawSuggestions = rawOptions && Array.isArray(rawOptions['suggestions']) ? rawOptions['suggestions'] : [];
	const normalizedSuggestions = rawSuggestions.filter((entry): entry is string => typeof entry === 'string');
	if (!normalizedSuggestions.length) {
		return { suggestions: [] };
	}

	let suggestTitles: Record<string, unknown> | undefined;
	const rawSuggestTitles = rawOptions ? rawOptions['suggestTitles'] : undefined;
	if (isRecord(rawSuggestTitles)) {
		suggestTitles = {};
		for (const [key, value] of Object.entries(rawSuggestTitles)) {
			suggestTitles[key] = value;
		}
	}

	return {
		suggestions: resolveSuggestions(
			normalizedSuggestions,
			suggestTitles,
			undefined,
			editor.getEvents(),
			editor.getItems(),
			editor.getCgApp(),
			editor.getResources(),
			editor.getSources()
		),
	};
}

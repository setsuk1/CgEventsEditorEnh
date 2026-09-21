import { getSelectedLanguage } from '@shared';
import { editor } from '../../../editor/CgEventsEditor';
import { resolveSuggestions } from '../../utils/suggestionResolver';
import { isRecord } from '../utils/rjsfUtils';

export interface WidgetSuggestionContext {
	suggestions: Array<{ value: string; label: string }>;
}

interface SuggestionCacheEntry {
	suggestTitles: unknown;
	events: unknown;
	items: unknown;
	cgapp: unknown;
	resources: unknown;
	sources: unknown;
	languageCode: string;
	context: WidgetSuggestionContext;
}

const EMPTY_CONTEXT: WidgetSuggestionContext = { suggestions: [] };
const contextCache = new WeakMap<any[], SuggestionCacheEntry>();

export function buildWidgetSuggestionContext(options: unknown, _formContext: unknown): WidgetSuggestionContext {
	const rawOptions = isRecord(options) ? options : undefined;
	const suggestions = rawOptions && Array.isArray(rawOptions.suggestions) ? rawOptions.suggestions : undefined;
	if (!suggestions?.length) return EMPTY_CONTEXT;

	const rawSuggestTitles = rawOptions?.suggestTitles;
	const suggestTitles = isRecord(rawSuggestTitles) ? rawSuggestTitles : undefined;
	const events = editor.getEvents();
	const items = editor.getItems();
	const cgapp = editor.getCgApp();
	const resources = editor.getResources();
	const sources = editor.getSources();
	const languageCode = getSelectedLanguage().code;
	const cached = contextCache.get(suggestions);
	if (
		cached &&
		cached.suggestTitles === suggestTitles &&
		cached.events === events &&
		cached.items === items &&
		cached.cgapp === cgapp &&
		cached.resources === resources &&
		cached.sources === sources &&
		cached.languageCode === languageCode
	) {
		return cached.context;
	}

	const resolved = resolveSuggestions(
		suggestions,
		suggestTitles,
		undefined,
		events,
		items,
		cgapp,
		resources,
		sources
	);
	const seen = new Set<string>();
	const context: WidgetSuggestionContext = {
		suggestions: resolved.filter((entry) => {
			if (seen.has(entry.value)) return false;
			seen.add(entry.value);
			return true;
		}),
	};
	contextCache.set(suggestions, {
		suggestTitles,
		events,
		items,
		cgapp,
		resources,
		sources,
		languageCode,
		context,
	});
	return context;
}

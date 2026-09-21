export interface TextSuggestion {
	value: string;
	label?: string;
}

export interface TextSuggestionAvailability {
	suggestions?: readonly TextSuggestion[];
	disabled?: boolean;
	readOnly?: boolean;
	textarea?: boolean;
}

export function canShowTextSuggestions(input: TextSuggestionAvailability): boolean {
	return !input.disabled
		&& !input.readOnly
		&& !input.textarea
		&& Boolean(input.suggestions?.length);
}

export function textSuggestionsEqual(
	a: readonly TextSuggestion[],
	b: readonly TextSuggestion[],
): boolean {
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index++) {
		if (a[index].value !== b[index].value || a[index].label !== b[index].label) {
			return false;
		}
	}
	return true;
}

export function sortTextSuggestions(
	suggestions: readonly TextSuggestion[],
): TextSuggestion[] {
	return [...suggestions].sort((a, b) => a.value.localeCompare(b.value));
}

export function filterTextSuggestions(
	input: string,
	suggestions: readonly TextSuggestion[],
): TextSuggestion[] {
	const query = input.toLowerCase();
	return suggestions.filter((suggestion) =>
		suggestion.value.toLowerCase().includes(query)
		|| Boolean(suggestion.label?.toLowerCase().includes(query))
	);
}


export interface TextHighlightSegment {
	text: string;
	match: boolean;
}

export function getTextHighlightSegments(
	text: string,
	query: string,
): TextHighlightSegment[] {
	const raw = String(text ?? '');
	const needle = query.trim();
	if (!needle) return raw ? [{ text: raw, match: false }] : [];

	const lower = raw.toLowerCase();
	const lowerNeedle = needle.toLowerCase();
	const segments: TextHighlightSegment[] = [];
	let cursor = 0;
	let matchIndex = lower.indexOf(lowerNeedle);

	while (matchIndex !== -1) {
		if (matchIndex > cursor) {
			segments.push({ text: raw.slice(cursor, matchIndex), match: false });
		}
		segments.push({
			text: raw.slice(matchIndex, matchIndex + needle.length),
			match: true,
		});
		cursor = matchIndex + needle.length;
		matchIndex = lower.indexOf(lowerNeedle, cursor);
	}
	if (cursor < raw.length) {
		segments.push({ text: raw.slice(cursor), match: false });
	}
	return segments;
}

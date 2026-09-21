import assert from 'node:assert/strict';
import test from 'node:test';
import {
	canShowTextSuggestions,
	filterTextSuggestions,
	getTextHighlightSegments,
	sortTextSuggestions,
	textSuggestionsEqual,
} from '../webview/ui/components/inputs/TextInputSuggestions';

const suggestions = [
	{ value: 'beta', label: 'Second' },
	{ value: 'alpha', label: 'First' },
	{ value: 'gamma' },
];

test('text suggestions compare values and labels in order', () => {
	assert.equal(textSuggestionsEqual(suggestions, [...suggestions]), true);
	assert.equal(textSuggestionsEqual(suggestions, [...suggestions].reverse()), false);
	assert.equal(
		textSuggestionsEqual([{ value: 'a', label: 'A' }], [{ value: 'a', label: 'B' }]),
		false,
	);
});

test('text suggestions sort without mutating the source', () => {
	const source = [...suggestions];
	const sorted = sortTextSuggestions(source);
	assert.deepEqual(sorted.map((item) => item.value), ['alpha', 'beta', 'gamma']);
	assert.deepEqual(source, suggestions);
});

test('text suggestions filter case-insensitively by value or label', () => {
	assert.deepEqual(filterTextSuggestions('ALP', suggestions).map((item) => item.value), ['alpha']);
	assert.deepEqual(filterTextSuggestions('second', suggestions).map((item) => item.value), ['beta']);
	assert.deepEqual(filterTextSuggestions('', suggestions), suggestions);
});


test('text highlight segments preserve text and mark case-insensitive matches', () => {
	assert.deepEqual(getTextHighlightSegments('Alpha beta ALPHA', 'alpha'), [
		{ text: 'Alpha', match: true },
		{ text: ' beta ', match: false },
		{ text: 'ALPHA', match: true },
	]);
	assert.deepEqual(getTextHighlightSegments('plain', ''), [{ text: 'plain', match: false }]);
	assert.deepEqual(getTextHighlightSegments('', 'x'), []);
});


test('text suggestion availability consistently blocks non-interactive inputs', () => {
	const available = [{ value: 'a' }];
	assert.equal(canShowTextSuggestions({ suggestions: available }), true);
	assert.equal(canShowTextSuggestions({ suggestions: available, disabled: true }), false);
	assert.equal(canShowTextSuggestions({ suggestions: available, readOnly: true }), false);
	assert.equal(canShowTextSuggestions({ suggestions: available, textarea: true }), false);
	assert.equal(canShowTextSuggestions({ suggestions: [] }), false);
	assert.equal(canShowTextSuggestions({}), false);
});

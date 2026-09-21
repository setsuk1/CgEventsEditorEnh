import assert from 'node:assert/strict';
import test from 'node:test';
import { LANG } from '../shared/locales/language';
import {
	generateTranslation,
	offLanguageChange,
	onLanguageChange,
	setLanguage,
	Translation,
} from '../shared/translation/Translation';

test('translation parameters preserve the full nested path', () => {
	const translation = new Translation(LANG.EN);
	translation.addItem('message', 'Hello {{ user.profile.name }}');

	assert.equal(
		translation.trans('message', { user: { profile: { name: 'Alice' } } }),
		'Hello Alice',
	);
});

test('translation parameter keys are matched literally', () => {
	const translation = new Translation(LANG.EN);
	translation.addItem('message', '{{a.b}} / {{axb}} / {{a[b]}}');

	assert.equal(
		translation.trans('message', { 'a.b': 'dot', 'a[b]': 'bracket' }),
		'dot / {{axb}} / bracket',
	);
});

test('translation replacement values remain literal', () => {
	const translation = new Translation(LANG.EN);
	translation.addItem('message', 'Value: {{value}}');

	assert.equal(translation.trans('message', { value: '$&-$1-$$' }), 'Value: $&-$1-$$');
});

test('translation item keys may shadow Object prototype names', () => {
	const translation = new Translation(LANG.EN);
	assert.equal(translation.trans('toString'), 'toString');
	assert.equal(translation.trans('constructor'), 'constructor');

	translation.addItem('toString', 'translated toString');
	translation.addItem('constructor', 'translated constructor');
	translation.addItem('__proto__', 'translated proto');

	assert.equal(translation.trans('toString'), 'translated toString');
	assert.equal(translation.trans('constructor'), 'translated constructor');
	assert.equal(translation.trans('__proto__'), 'translated proto');
});

test('translation JSON import ignores inherited enumerable entries', () => {
	const translation = new Translation(LANG.EN);
	const json = Object.create({ inherited: 'should not import' }) as Record<string, unknown>;
	json.own = 'imported';
	translation.importJson(json);

	assert.equal(translation.trans('own'), 'imported');
	assert.equal(translation.trans('inherited'), 'inherited');
});

test('translation parameter replacement ignores inherited enumerable entries', () => {
	const translation = new Translation(LANG.EN);
	translation.addItem('message', '{{own}} / {{inherited}}');
	const params = Object.create({ inherited: 'leaked' }) as Record<string, unknown>;
	params.own = 'safe';

	assert.equal(translation.trans('message', params), 'safe / {{inherited}}');
});

test('generated translation structure supports prototype-shadowing keys', () => {
	const json = JSON.parse('{"toString":"value","nested":{"constructor":"value","__proto__":{"leaf":"value"}},"__proto__":"value"}');
	const generated: any = generateTranslation(json);

	assert.equal(generated.toString.getFullName(), 'toString');
	assert.equal(generated.nested.constructor.getFullName(), 'nested.constructor');
	assert.equal(generated.nested.__proto__.leaf.getFullName(), 'nested.__proto__.leaf');
	assert.equal(generated.__proto__.getFullName(), '__proto__');
});

test('language listeners may unsubscribe themselves without skipping peers', () => {
	const calls: string[] = [];
	const first = () => {
		calls.push('first');
		offLanguageChange(first);
	};
	const second = () => {
		calls.push('second');
	};

	assert.equal(onLanguageChange(first), true);
	assert.equal(onLanguageChange(second), true);
	try {
		setLanguage(LANG.EN, LANG.EN);
		assert.deepEqual(calls, ['first', 'second']);

		calls.length = 0;
		setLanguage(LANG.EN, LANG.EN);
		assert.deepEqual(calls, ['second']);
	} finally {
		offLanguageChange(first);
		offLanguageChange(second);
	}
});

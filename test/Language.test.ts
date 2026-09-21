import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getByCode,
	getPrimaryLanguageTag,
	isLikeLanguage,
	isSimilarLanguage,
	LANG,
	normalizeLanguageTag,
} from '../shared/locales/language';

test('language tag normalization preserves existing case and separator matching semantics', () => {
	assert.equal(normalizeLanguageTag('ZH_Hant'), 'zh-hant');
	assert.equal(isLikeLanguage('zh_Hant', 'ZH-hant'), true);
	assert.equal(isLikeLanguage('zh-Hant', 'zh-TW'), false);
});

test('language similarity compares normalized primary language tags', () => {
	assert.equal(getPrimaryLanguageTag('EN_us'), 'en');
	assert.equal(isSimilarLanguage('en-US', 'EN_gb'), true);
	assert.equal(isSimilarLanguage('zh-Hant', 'zh_CN'), true);
	assert.equal(isSimilarLanguage('en-US', 'fr-FR'), false);
});

test('language lookup does not expose Object prototype members for unknown runtime codes', () => {
	assert.strictEqual(getByCode(LANG.EN.code), LANG.EN);
	assert.equal(getByCode('toString' as any), undefined);
	assert.equal(getByCode('__proto__' as any), undefined);
});

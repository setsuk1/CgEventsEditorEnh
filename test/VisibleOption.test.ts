import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateVisibleOption, pruneHiddenFields } from '../webview/ui/rjsf/utils/visibleOption';

test('form-data pruning removes unsafe keys even without UI metadata', () => {
	const data = JSON.parse(`{
		"safe": {
			"keep": 1,
			"constructor": { "polluted": true },
			"deep": { "prototype": { "polluted": true }, "keep": 2 }
		},
		"rows": [
			{ "keep": 3, "__proto__": { "polluted": true } },
			{ "nested": { "constructor": { "polluted": true }, "keep": 4 } }
		],
		"__proto__": { "polluted": true }
	}`);

	const pruned = pruneHiddenFields(data, undefined, data);

	assert.deepEqual(pruned, {
		safe: { keep: 1, deep: { keep: 2 } },
		rows: [{ keep: 3 }, { nested: { keep: 4 } }],
	});
	assert.equal((Object.prototype as any).polluted, undefined);
});

test('form-data pruning preserves clean references when nothing changes', () => {
	const data = { safe: { keep: 1 }, rows: [{ keep: 2 }] };
	assert.strictEqual(pruneHiddenFields(data, undefined, data), data);
});

test('form-data pruning still applies visibility metadata while sanitizing unknown children', () => {
	const data = JSON.parse('{"visible":1,"hidden":2,"extra":{"constructor":{"polluted":true},"keep":3}}');
	const uiSchema: any = {
		hidden: { 'ui:options': { visible: false } },
	};

	assert.deepEqual(pruneHiddenFields(data, uiSchema, data), {
		visible: 1,
		extra: { keep: 3 },
	});
});


test('visible expressions evaluate comparisons and relative field references', () => {
	const data = { enabled: true, count: 3, nested: { name: 'Alpha' } };
	assert.equal(evaluateVisibleOption('{enabled} == true', data, []), true);
	assert.equal(evaluateVisibleOption('{count} > 5', data, []), false);
	assert.equal(evaluateVisibleOption('{name} == "Alpha"', data, ['nested']), true);
});

test('visible expressions support match regex literals and fail open on invalid expressions', () => {
	const data = { name: 'Alpha-42' };
	assert.equal(evaluateVisibleOption('match({name}, /alpha-\\d+/i)', data, []), true);
	assert.equal(evaluateVisibleOption('not valid (', data, []), true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getBasePreloadSummaryCounts } from '../webview/ui/components/base/BaseSettingsData';

test('base settings summary counts only real resource exclusions', () => {
	assert.deepEqual(
		getBasePreloadSummaryCounts(
			{ resourcesExclude: ['a', 'a', 'missing'], sources: ['one', 'two'] },
			['a', 'b', 'c'],
		),
		{ includedResources: 2, sourcesCount: 2 },
	);
});

test('base settings summary handles missing preload arrays and duplicate resource inventory safely', () => {
	assert.deepEqual(
		getBasePreloadSummaryCounts({}, ['a', 'a', 'b']),
		{ includedResources: 2, sourcesCount: 0 },
	);
	assert.deepEqual(
		getBasePreloadSummaryCounts({ resourcesExclude: [1, null, 'b'] }, ['a', 'b']),
		{ includedResources: 1, sourcesCount: 0 },
	);
});

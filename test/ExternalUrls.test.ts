import assert from 'node:assert/strict';
import test from 'node:test';
import { ExternalUrlCode } from '../shared/messages';
import { resolveExternalUrl } from '../src/utils/externalUrls';

test('external URL resolver returns static destinations', () => {
	assert.equal(
		resolveExternalUrl(ExternalUrlCode.ORIGINAL_EDITOR_DISCUSSION),
		'https://code.gamelet.com/discuss',
	);
	assert.equal(
		resolveExternalUrl(ExternalUrlCode.OLD_EDITOR_SAMPLE_DOWNLOAD),
		'https://twmission.blogspot.com/2012/11/blog-post_29.html',
	);
});

test('online editor URL requires and encodes the project code', () => {
	assert.equal(resolveExternalUrl(ExternalUrlCode.ONLINE_EDITOR), undefined);
	assert.equal(
		resolveExternalUrl(ExternalUrlCode.ONLINE_EDITOR, 'project / 中文'),
		'https://code.gamelet.com/edit/project%20%2F%20%E4%B8%AD%E6%96%87',
	);
});

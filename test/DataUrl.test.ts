import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBase64DataUrl } from '../webview/helper/dataUrl';

const expected = [65, 66, 67];
const base64 = 'QUJD';

test('base64 data URL decoder accepts raw base64 payloads', () => {
	assert.deepEqual(Array.from(decodeBase64DataUrl(base64)), expected);
});

test('base64 data URL decoder accepts octet-stream data URLs', () => {
	assert.deepEqual(
		Array.from(decodeBase64DataUrl(`data:application/octet-stream;base64,${base64}`)),
		expected,
	);
});

test('base64 data URL decoder accepts audio MIME data URLs', () => {
	assert.deepEqual(
		Array.from(decodeBase64DataUrl(`data:audio/mpeg;base64,${base64}`)),
		expected,
	);
});

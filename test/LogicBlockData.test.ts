import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLogicBlockList } from '../webview/ui/components/events/LogicBlockData';

test('logic list normalization trims block types and preserves object data', () => {
	const data = { value: 1 };
	const blocks = normalizeLogicBlockList([
		{ type: ' action ', data },
		{ type: 'check' },
	]);

	assert.deepEqual(blocks, [
		{ type: 'action', data },
		{ type: 'check' },
	]);
	assert.strictEqual(blocks?.[0].data, data);
});

test('logic list normalization rejects malformed entries', () => {
	for (const value of [
		null,
		{},
		[null],
		[{}],
		[{ type: '   ' }],
		[{ type: 'ok', data: [] }],
		[{ type: 'ok', data: 'bad' }],
	]) {
		assert.equal(normalizeLogicBlockList(value), undefined);
	}
});

test('logic list normalization rejects unsafe nested object keys', () => {
	const polluted = JSON.parse('[{"type":"ok","data":{"__proto__":{"polluted":true}}}]');
	assert.equal(normalizeLogicBlockList(polluted), undefined);
	assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

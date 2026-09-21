import assert from 'node:assert/strict';
import test from 'node:test';
import { isCgAppInfo, isCgItemInfoList } from '../shared/resources';

function item(overrides: Record<string, unknown> = {}) {
	return {
		code: 'item-1',
		name: 'Item 1',
		iconUrl: '',
		...overrides,
	};
}

function cgApp(overrides: Record<string, unknown> = {}) {
	return {
		appResourcePack: {
			aliasMap: {},
			resourceMap: {},
		},
		...overrides,
	};
}

test('item validation accepts the fields used by item suggestions', () => {
	assert.equal(isCgItemInfoList({ list: [item()] }), true);
	assert.equal(isCgItemInfoList({ list: [item({ name: undefined, iconUrl: undefined })] }), true);
});

test('item validation rejects invalid suggestion codes', () => {
	assert.equal(isCgItemInfoList({ list: [item({ code: '' })] }), false);
	assert.equal(isCgItemInfoList({ list: [item({ code: '   ' })] }), false);
	assert.equal(isCgItemInfoList({ list: [item({ code: 123 })] }), false);
	assert.equal(isCgItemInfoList({ list: [item({ code: {} })] }), false);
});

test('item validation rejects malformed display fields', () => {
	assert.equal(isCgItemInfoList({ list: [item({ name: {} })] }), false);
	assert.equal(isCgItemInfoList({ list: [item({ iconUrl: {} })] }), false);
});

test('CgApp validation allows missing or string project codes', () => {
	assert.equal(isCgAppInfo(cgApp()), true);
	assert.equal(isCgAppInfo(cgApp({ projectCode: '' })), true);
	assert.equal(isCgAppInfo(cgApp({ projectCode: 'project-123' })), true);
});

test('CgApp validation rejects malformed project codes', () => {
	assert.equal(isCgAppInfo(cgApp({ projectCode: 123 })), false);
	assert.equal(isCgAppInfo(cgApp({ projectCode: {} })), false);
	assert.equal(isCgAppInfo(cgApp({ projectCode: [] })), false);
});

test('CgApp validation accepts valid resource aliases', () => {
	assert.equal(isCgAppInfo(cgApp({
		appResourcePack: {
			aliasMap: {
				image: { resourceId: 1 },
				testSound: { resourceId: 2, mode: 'TEST' },
			},
			resourceMap: {
				1: { type: 'image' },
				2: { type: 'sound' },
			},
		},
	})), true);
});

test('CgApp validation rejects malformed resource aliases', () => {
	for (const alias of [
		{},
		{ resourceId: '1' },
		{ resourceId: Number.NaN },
		{ resourceId: 1, mode: 'DEV' },
	]) {
		assert.equal(isCgAppInfo(cgApp({
			appResourcePack: {
				aliasMap: { sample: alias },
				resourceMap: { 1: { type: 'image' } },
			},
		})), false, `expected alias ${JSON.stringify(alias)} to be rejected`);
	}
});

test('CgApp validation rejects inherited enumerable resource aliases', () => {
	const aliasMap = Object.create({ inherited: { resourceId: 1 } }) as Record<string, unknown>;
	aliasMap.own = { resourceId: 1 };
	assert.equal(isCgAppInfo(cgApp({
		appResourcePack: {
			aliasMap,
			resourceMap: { 1: { type: 'image' } },
		},
	})), false);
});

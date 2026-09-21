import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgAppInfo } from '../shared/resources';
import { buildResourceLists } from '../src/utils/resourceList';

function createCgApp(aliasMap: Record<string, any>, resourceMap: Record<string | number, any>): ICgAppInfo {
	return { appResourcePack: { aliasMap, resourceMap } } as unknown as ICgAppInfo;
}

test('resource list builder filters, sorts, and excludes TEST aliases', () => {
	const result = buildResourceLists(createCgApp(
		{
			zeta: { resourceId: 1 },
			alpha: { resourceId: 2, mode: 'TEST' },
			ignored: { resourceId: 3 },
		},
		{
			1: { type: 'image' },
			2: { type: 'sound' },
			3: { type: 'unsupported' },
		},
	));
	assert.deepEqual(result.all, ['alpha', 'zeta']);
	assert.deepEqual(result.excludingTest, ['zeta']);
});

test('resource list builder matches supported resource types case-insensitively', () => {
	const result = buildResourceLists(createCgApp(
		{
			upperImage: { resourceId: 1 },
			camelSoundPack: { resourceId: 2 },
			lowerSoundPack: { resourceId: 3 },
		},
		{
			1: { type: 'IMAGE' },
			2: { type: 'soundPack' },
			3: { type: 'soundpack' },
		},
	));
	assert.deepEqual(result.all, ['camelSoundPack', 'lowerSoundPack', 'upperImage']);
	assert.deepEqual(result.excludingTest, ['camelSoundPack', 'lowerSoundPack', 'upperImage']);
});

test('resource list builder only reads own aliases and resources', () => {
	const aliasMap = Object.create({ inheritedAlias: { resourceId: 1 } }) as Record<string, any>;
	aliasMap.ownAlias = { resourceId: 2 };
	aliasMap.inheritedResourceAlias = { resourceId: 3 };

	const resourceMap = Object.create({ 3: { type: 'image' } }) as Record<string | number, any>;
	resourceMap[1] = { type: 'image' };
	resourceMap[2] = { type: 'image' };

	const result = buildResourceLists(createCgApp(aliasMap, resourceMap));
	assert.deepEqual(result.all, ['ownAlias']);
	assert.deepEqual(result.excludingTest, ['ownAlias']);
});

test('resource list builder returns empty lists without app metadata', () => {
	assert.deepEqual(buildResourceLists(undefined), { all: [], excludingTest: [] });
});
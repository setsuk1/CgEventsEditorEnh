import type { ICgAppInfo } from '../../shared';

const ALLOWED_PRELOAD_RESOURCE_TYPES = new Set([
	'image', 'spritesheet', 'gaf', 'spine', 'sound', 'text', 'tmx', 'twmap', 'twrole', 'other', 'soundpack',
]);

export interface ResourceLists {
	all: string[];
	excludingTest: string[];
}

function compareResourceNames(a: string, b: string): -1 | 0 | 1 {
	const lowerA = a.toLowerCase();
	const lowerB = b.toLowerCase();
	if (lowerA < lowerB) return -1;
	if (lowerA > lowerB) return 1;

	const aIsLower = a === lowerA;
	const bIsLower = b === lowerB;
	if (aIsLower !== bIsLower) return aIsLower ? -1 : 1;
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

export function buildResourceLists(cgApp: ICgAppInfo | undefined): ResourceLists {
	if (!cgApp) return { all: [], excludingTest: [] };
	const { aliasMap, resourceMap } = cgApp.appResourcePack;
	const all: string[] = [];
	const excludingTest: string[] = [];

	for (const key of Object.keys(aliasMap)) {
		const alias = aliasMap[key];
		if (!alias || !Object.hasOwn(resourceMap, alias.resourceId)) continue;
		const resource = resourceMap[alias.resourceId];
		if (!resource || !ALLOWED_PRELOAD_RESOURCE_TYPES.has(resource.type.toLowerCase())) continue;
		all.push(key);
		if (alias.mode !== 'TEST') excludingTest.push(key);
	}

	all.sort(compareResourceNames);
	excludingTest.sort(compareResourceNames);
	return { all, excludingTest };
}

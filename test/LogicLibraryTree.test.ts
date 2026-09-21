import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsSchemaEntry } from '../shared/schema';
import {
	buildLogicLibraryTree,
	getLogicLibraryFolderPath,
	searchLogicLibraryFolders,
	searchLogicLibraryItems,
} from '../webview/ui/components/events/LogicLibraryModel';

function entry(
	overrides: Partial<ICgEventsSchemaEntry> = {},
): ICgEventsSchemaEntry {
	return {
		project: '',
		source: { path: '', filename: '' },
		toString: {},
		className: '',
		timestamp: 1,
		label: {},
		description: {},
		allpaths: {},
		properties: [],
		...overrides,
	};
}

test('logic library folder path falls back through allpaths, project, and root', () => {
	assert.deepEqual(
		getLogicLibraryFolderPath(entry({ allpaths: { en: [['Folder', 'Nested']] } })),
		['Folder', 'Nested'],
	);
	assert.deepEqual(getLogicLibraryFolderPath(entry({ project: 'Project A' })), ['Project A']);
	assert.deepEqual(getLogicLibraryFolderPath(entry()), ['root']);
});

test('logic library folder path preserves prototype-shadowing locale keys', () => {
	const allpaths = JSON.parse('{"__proto__":[["Prototype Locale"]]}');
	assert.deepEqual(getLogicLibraryFolderPath(entry({ allpaths })), ['Prototype Locale']);
});

test('logic library tree skips deprecated entries and safely supports prototype-named folders', () => {
	const tree = buildLogicLibraryTree({
		active: entry({
			className: 'Active',
			allpaths: { en: [['__proto__', 'Nested']] },
		}),
		deprecated: entry({
			className: 'Deprecated',
			deprecated: true,
			allpaths: { en: [['Hidden']] },
		}),
	});

	assert.equal(Object.prototype.hasOwnProperty.call(tree.children, '__proto__'), true);
	assert.equal(tree.children['__proto__'].children.Nested.items[0]?.key, 'active');
	assert.equal(Object.prototype.hasOwnProperty.call(tree.children, 'Hidden'), false);
});

test('logic library folder search returns descendant paths relative to the current base path', () => {
	const tree = buildLogicLibraryTree({
		one: entry({ className: 'One', allpaths: { en: [['Animals', 'Cats']] } }),
		two: entry({ className: 'Two', allpaths: { en: [['Animals', 'Dogs']] } }),
	});
	const animals = tree.children.Animals;

	assert.deepEqual(searchLogicLibraryFolders(animals, ['Animals'], 'cat'), [
		{ name: 'Cats', path: ['Animals', 'Cats'] },
	]);
	assert.deepEqual(searchLogicLibraryFolders(animals, ['Animals'], '   '), []);
});

test('logic library item search traverses descendants and matches labels or keys', () => {
	const tree = buildLogicLibraryTree({
		catAction: entry({ className: 'Create Cat', allpaths: { en: [['Animals', 'Cats']] } }),
		dogAction: entry({ className: 'Create Dog', allpaths: { en: [['Animals', 'Dogs']] } }),
	});

	assert.deepEqual(
		searchLogicLibraryItems(tree.children.Animals, 'cat').map((item) => item.key),
		['catAction'],
	);
	assert.deepEqual(
		searchLogicLibraryItems(tree.children.Animals, 'dogAction').map((item) => item.key),
		['dogAction'],
	);
	assert.deepEqual(
		searchLogicLibraryItems(tree.children.Animals, '').map((item) => item.key).sort(),
		['catAction', 'dogAction'],
	);
});

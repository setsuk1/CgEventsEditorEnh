import assert from 'node:assert/strict';
import test from 'node:test';
import { getLogicLibraryChildNamesAtPathIndex, resolveLogicLibraryPath } from '../webview/ui/components/events/LogicLibraryModel';
import { createSafeRecord } from '../webview/ui/utils/safeRecord';

interface Node {
	name: string;
	children: Record<string, Node>;
}

function node(name: string): Node {
	return { name, children: createSafeRecord<Node>() };
}

test('logic library path resolution keeps the longest existing prefix', () => {
	const root = node('root');
	const a = node('a');
	const b = node('b');
	root.children.a = a;
	a.children.b = b;

	const resolved = resolveLogicLibraryPath(root, ['a', 'b', 'removed', 'child']);

	assert.strictEqual(resolved.node, b);
	assert.deepEqual(resolved.path, ['a', 'b']);
});

test('logic library path resolution treats prototype-like names as normal own keys', () => {
	const root = node('root');
	const child = node('toString');
	const prototypeLikeKey: string = 'toString';
	root.children[prototypeLikeKey] = child;

	const resolved = resolveLogicLibraryPath(root, [prototypeLikeKey]);

	assert.strictEqual(resolved.node, child);
	assert.deepEqual(resolved.path, ['toString']);
});


test('logic library child lookup rejects invalid path prefixes instead of falling back to an ancestor', () => {
	const root = node('root');
	const animals = node('animals');
	const cats = node('cats');
	const dogs = node('dogs');
	root.children.animals = animals;
	animals.children.cats = cats;
	animals.children.dogs = dogs;

	assert.deepEqual(
		getLogicLibraryChildNamesAtPathIndex(root, ['animals'], 1),
		['cats', 'dogs'],
	);
	assert.deepEqual(
		getLogicLibraryChildNamesAtPathIndex(root, ['missing', 'animals'], 2),
		[],
	);
});

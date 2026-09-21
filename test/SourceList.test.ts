import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { getSourceRelativePath, isPreloadSource, isTestSource, PRELOAD_SOURCE_EXCLUDE_GLOB } from '../src/utils/sourceList';

test('source list policy excludes code and markdown files from preload', () => {
	for (const source of [
		'script.js', 'script.JSX', 'module.mjs', 'module.cjs',
		'source.ts', 'source.TSX', 'module.mts', 'module.cts', 'README.MD',
	]) {
		assert.equal(isPreloadSource(source), false, `expected ${source} to be excluded`);
	}
});

test('source list policy keeps non-code assets and extensionless files', () => {
	for (const source of ['scene.events', 'images/bg.png', 'audio/theme.mp3', 'assets/data.json', 'LICENSE']) {
		assert.equal(isPreloadSource(source), true, `expected ${source} to be preloadable`);
	}
});

test('source list policy identifies only the test folder subtree', () => {
	assert.equal(isTestSource('test'), true);
	assert.equal(isTestSource('test/fixture.events'), true);
	assert.equal(isTestSource('test/nested/fixture.json'), true);
	assert.equal(isTestSource('testing/fixture.events'), false);
	assert.equal(isTestSource('src/test/fixture.events'), false);
	assert.equal(isTestSource('Test/fixture.events'), false);
});

test('source list policy exports the findFiles exclusion glob', () => {
	assert.equal(PRELOAD_SOURCE_EXCLUDE_GLOB, '**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,md}');
});


test('source relative paths stay inside the source root and use slash separators', () => {
	const root = path.join('workspace', 'src');
	assert.equal(
		getSourceRelativePath(root, path.join(root, 'folder', 'asset.json')),
		'folder/asset.json',
	);
	assert.equal(getSourceRelativePath(root, root), undefined);
	assert.equal(getSourceRelativePath(root, path.join('workspace', 'outside.json')), undefined);
});

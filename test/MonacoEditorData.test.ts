import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getMonacoContainerClassNames,
	getMonacoEditorOptions,
	resolveMonacoTheme,
} from '../webview/ui/components/common/MonacoEditorData';

test('Monaco theme follows VS Code body classes', () => {
	assert.equal(resolveMonacoTheme(['vscode-high-contrast']), 'hc-black');
	assert.equal(resolveMonacoTheme(['vscode-light']), 'vs');
	assert.equal(resolveMonacoTheme(['vscode-high-contrast-light']), 'vs');
	assert.equal(resolveMonacoTheme(['vscode-dark']), 'vs-dark');
	assert.equal(resolveMonacoTheme([]), 'vs-dark');
	assert.equal(resolveMonacoTheme(['vscode-light', 'vscode-high-contrast']), 'hc-black');
});

test('Monaco container classes preserve fill and compact layout semantics', () => {
	assert.deepEqual(
		getMonacoContainerClassNames({ className: 'extra', compact: true, fill: false }),
		{
			rootClassName: 'd-flex flex-column gap-2 w-100 cgenh-json-editor extra',
			wrapperClassName: 'border rounded overflow-hidden cgenh-monaco-wrapper--compact',
		},
	);
	assert.deepEqual(
		getMonacoContainerClassNames({ compact: true, fill: true }),
		{
			rootClassName: 'd-flex flex-column gap-2 w-100 cgenh-json-editor flex-grow-1 min-h-0',
			wrapperClassName: 'border rounded overflow-hidden flex-grow-1 cgenh-monaco-wrapper--fill',
		},
	);
});

test('Monaco editor options only vary minimap visibility with compact mode', () => {
	const normal = getMonacoEditorOptions(false);
	const compact = getMonacoEditorOptions(true);
	assert.equal(normal.minimap.enabled, true);
	assert.equal(compact.minimap.enabled, false);
	assert.equal(normal.tabSize, compact.tabSize);
	assert.equal(normal.wordWrap, 'on');
	assert.equal(normal.formatOnPaste, true);
});

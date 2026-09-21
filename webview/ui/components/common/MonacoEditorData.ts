export type MonacoThemeName = 'hc-black' | 'vs' | 'vs-dark';

export interface MonacoContainerClassOptions {
	className?: string;
	compact?: boolean;
	fill?: boolean;
}

export function resolveMonacoTheme(classes: Iterable<string>): MonacoThemeName {
	const classSet = new Set(classes);
	if (classSet.has('vscode-high-contrast')) return 'hc-black';
	if (classSet.has('vscode-light') || classSet.has('vscode-high-contrast-light')) return 'vs';
	return 'vs-dark';
}

export function getMonacoContainerClassNames(
	options: MonacoContainerClassOptions,
): { rootClassName: string; wrapperClassName: string } {
	const rootClassName = [
		'd-flex',
		'flex-column',
		'gap-2',
		'w-100',
		'cgenh-json-editor',
		options.fill ? 'flex-grow-1 min-h-0' : '',
		options.className ?? '',
	].filter(Boolean).join(' ');

	const wrapperClassName = [
		'border',
		'rounded',
		'overflow-hidden',
		options.fill
			? 'flex-grow-1 cgenh-monaco-wrapper--fill'
			: options.compact
				? 'cgenh-monaco-wrapper--compact'
				: 'cgenh-monaco-wrapper--default',
	].filter(Boolean).join(' ');

	return { rootClassName, wrapperClassName };
}

export function getMonacoEditorOptions(compact: boolean) {
	return {
		minimap: { enabled: !compact },
		scrollBeyondLastLine: false,
		fontSize: 14,
		lineNumbers: 'on' as const,
		renderWhitespace: 'selection' as const,
		tabSize: 2,
		insertSpaces: true,
		automaticLayout: true,
		formatOnPaste: true,
		formatOnType: true,
		wordWrap: 'on' as const,
		wrappingIndent: 'indent' as const,
		folding: true,
		foldingStrategy: 'indentation' as const,
		showFoldingControls: 'always' as const,
		matchBrackets: 'always' as const,
		autoClosingBrackets: 'always' as const,
		autoClosingQuotes: 'always' as const,
		suggest: {
			showKeywords: true,
			showSnippets: true,
		},
	};
}

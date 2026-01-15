import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import React from 'react';

interface MonacoEditorComponentProps {
	value: string;
	error?: string;
	onChange: (text: string) => void;
	onCommit?: (text: string) => void;
	className?: string;
	compact?: boolean;
	fill?: boolean;
}

/**
 * Monaco Editor wrapper for JSON editing with VSCode integration
 */
export class MonacoEditorComponent extends React.PureComponent<MonacoEditorComponentProps> {
	private editor: monaco.editor.IStandaloneCodeEditor | null = null;
	private changeTimeout: NodeJS.Timeout | null = null;
	private clipboardDisposables: monaco.IDisposable[] = [];
	// Track editor value so we can ignore parent echoes and avoid re-rendering Monaco.
	private internalValue: string;

	constructor(props: MonacoEditorComponentProps) {
		super(props);
		this.internalValue = props.value;
	}

	shouldComponentUpdate(nextProps: MonacoEditorComponentProps): boolean {
		if (nextProps.error !== this.props.error) return true;
		if (nextProps.className !== this.props.className) return true;
		if (nextProps.compact !== this.props.compact) return true;
		if (nextProps.fill !== this.props.fill) return true;

		if (nextProps.value !== this.props.value) {
			return nextProps.value !== this.internalValue;
		}

		return false;
	}

	componentDidUpdate(prevProps: MonacoEditorComponentProps): void {
		// Update editor content if value prop changes from external source
		if (prevProps.value !== this.props.value && this.props.value !== this.internalValue) {
			this.internalValue = this.props.value;
			if (this.editor) {
				const currentPosition = this.editor.getPosition();
				this.editor.setValue(this.props.value);
				if (currentPosition) {
					this.editor.setPosition(currentPosition);
				}
			}
		}
	}

	componentWillUnmount(): void {
		if (this.changeTimeout) {
			clearTimeout(this.changeTimeout);
		}
		this.clipboardDisposables.forEach((disposable) => disposable.dispose());
		this.clipboardDisposables = [];
		if (this.editor) {
			this.editor.dispose();
		}
	}

	private handleEditorDidMount: OnMount = (editor, monaco) => {
		this.editor = editor;
		this.internalValue = this.props.value;

		// Configure Monaco for VSCode webview context
		monaco.editor.defineTheme('vscode-dark-custom', {
			base: 'vs-dark',
			inherit: true,
			rules: [],
			colors: {
				'editor.background': '#1e1e1e',
				'editor.foreground': '#d4d4d4',
				'editorLineNumber.foreground': '#858585',
				'editorLineNumber.activeForeground': '#c6c6c6',
				'editor.selectionBackground': '#264f78',
				'editor.inactiveSelectionBackground': '#3a3d41',
			},
		});

		monaco.editor.setTheme('vscode-dark-custom');

		// Configure JSON language settings
		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			schemas: [],
			enableSchemaRequest: false,
		});

		// Set initial value
		editor.setValue(this.props.value);

		// Focus editor
		editor.focus();

		const defaultPasteAction = editor.getAction('editor.action.clipboardPasteAction');
		const pasteOverride = monaco.editor.registerCommand('editor.action.clipboardPasteAction', async () => {
			let text = '';
			if (navigator?.clipboard?.readText) {
				try {
					text = await navigator.clipboard.readText();
				} catch {
					text = '';
				}
			}
			if (!text) {
				if (defaultPasteAction) {
					await defaultPasteAction.run();
				}
				return;
			}
			editor.pushUndoStop();
			editor.trigger('keyboard', 'type', { text });
			editor.pushUndoStop();
		});

		const keybindings = monaco.editor.addKeybindingRules([
			{
				keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX,
				command: 'editor.action.clipboardCutAction',
				when: 'textInputFocus',
			},
			{
				keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC,
				command: 'editor.action.clipboardCopyAction',
				when: 'textInputFocus',
			},
			{
				keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
				command: 'editor.action.clipboardPasteAction',
				when: 'textInputFocus',
			},
		]);

		this.clipboardDisposables.push(pasteOverride, keybindings);

		const blurDisposable = editor.onDidBlurEditorText(() => {
			if (this.props.onCommit) {
				this.props.onCommit(this.internalValue);
			}
		});
		this.clipboardDisposables.push(blurDisposable);
	};

	private handleEditorChange = (value: string | undefined) => {
		const newValue = value ?? '';
		this.internalValue = newValue;

		// Debounce the onChange callback to avoid excessive updates
		if (this.changeTimeout) {
			clearTimeout(this.changeTimeout);
		}

		this.changeTimeout = setTimeout(() => {
			this.props.onChange(newValue);
		}, 300);
	};

	render() {
		const { error, className, compact, fill } = this.props;
		const rootClassName = [
			'd-flex',
			'flex-column',
			'gap-2',
			'w-100',
			'cgenh-json-editor',
			fill ? 'flex-grow-1 min-h-0' : '',
			className ?? '',
		].filter(Boolean).join(' ');
		const wrapperClassName = [
			'border',
			'rounded',
			'overflow-hidden',
			fill ? 'flex-grow-1 cgenh-monaco-wrapper--fill' : compact ? 'cgenh-monaco-wrapper--compact' : 'cgenh-monaco-wrapper--default',
		].filter(Boolean).join(' ');

		return (
			<div className={rootClassName}>
				<div className={wrapperClassName}>
					<Editor
						height="100%"
						defaultLanguage="json"
						value={this.props.value}
						onChange={this.handleEditorChange}
						onMount={this.handleEditorDidMount}
						options={{
							minimap: { enabled: !compact },
							scrollBeyondLastLine: false,
							fontSize: 14,
							lineNumbers: 'on',
							renderWhitespace: 'selection',
							tabSize: 2,
							insertSpaces: true,
							automaticLayout: true,
							formatOnPaste: true,
							formatOnType: true,
							wordWrap: 'on',
							wrappingIndent: 'indent',
							folding: true,
							foldingStrategy: 'indentation',
							showFoldingControls: 'always',
							matchBrackets: 'always',
							autoClosingBrackets: 'always',
							autoClosingQuotes: 'always',
							suggest: {
								showKeywords: true,
								showSnippets: true,
							},
						}}
					/>
				</div>
				{error && (
					<div className="alert alert-danger py-1 mb-0" role="alert">
						{error}
					</div>
				)}
			</div>
		);
	}
}

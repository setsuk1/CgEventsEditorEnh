import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import React from 'react';
import { flushSync } from 'react-dom';
import {
	getMonacoContainerClassNames,
	getMonacoEditorOptions,
	resolveMonacoTheme,
} from './MonacoEditorData';

interface MonacoEditorComponentProps {
	value: string;
	error?: string;
	onChange: (text: string) => void;
	onCommit?: (text: string) => void;
	className?: string;
	compact?: boolean;
	fill?: boolean;
}

type MonacoReactModule = typeof import('@monaco-editor/react');
type MonacoApi = typeof import('monaco-editor');

interface MonacoEditorComponentState {
	EditorComponent?: MonacoReactModule['default'];
	loadFailed: boolean;
}

/**
 * Monaco Editor wrapper for JSON editing with VSCode integration.
 * The Monaco runtime is loaded only when an editor is actually mounted.
 */
export class MonacoEditorComponent extends React.PureComponent<MonacoEditorComponentProps, MonacoEditorComponentState> {
	private editor: Monaco.editor.IStandaloneCodeEditor | null = null;
	private monacoApi: MonacoApi | null = null;
	private changeTimeout: NodeJS.Timeout | null = null;
	private editorDisposables: Monaco.IDisposable[] = [];
	private themeObserver: MutationObserver | null = null;
	private internalValue: string;
	private disposed = false;

	constructor(props: MonacoEditorComponentProps) {
		super(props);
		this.internalValue = props.value;
		this.state = {
			EditorComponent: undefined,
			loadFailed: false,
		};
	}

	componentDidMount(): void {
		void this.loadEditorRuntime();
	}

	public getValue(): string {
		return this.internalValue;
	}

	shouldComponentUpdate(nextProps: MonacoEditorComponentProps, nextState: MonacoEditorComponentState): boolean {
		if (nextState.EditorComponent !== this.state.EditorComponent || nextState.loadFailed !== this.state.loadFailed) return true;
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
		if (prevProps.value !== this.props.value && this.props.value !== this.internalValue) {
			this.internalValue = this.props.value;
			if (this.editor) {
				const currentPosition = this.editor.getPosition();
				this.editor.setValue(this.props.value);
				if (currentPosition) this.editor.setPosition(currentPosition);
			}
		}
	}

	componentWillUnmount(): void {
		this.disposed = true;
		this.flushPendingChange(false);
		this.themeObserver?.disconnect();
		this.themeObserver = null;
		this.editorDisposables.forEach((disposable) => disposable.dispose());
		this.editorDisposables = [];
		this.editor?.dispose();
		this.editor = null;
		this.monacoApi = null;
	}

	private async loadEditorRuntime(): Promise<void> {
		try {
			const [monacoReact, monacoApi] = await Promise.all([
				import('@monaco-editor/react'),
				import('monaco-editor'),
			]);
			if (this.disposed) return;
			monacoReact.loader.config({ monaco: monacoApi });
			this.monacoApi = monacoApi;
			this.setState({ EditorComponent: monacoReact.default, loadFailed: false });
		} catch (error) {
			if (this.disposed) return;
			console.error('Failed to load Monaco editor:', error);
			this.setState({ loadFailed: true });
		}
	}

	private flushPendingChange(synchronous = true): void {
		if (!this.changeTimeout) return;
		clearTimeout(this.changeTimeout);
		this.changeTimeout = null;
		const notifyChange = () => this.props.onChange(this.internalValue);
		if (synchronous) {
			flushSync(notifyChange);
		} else {
			// Preserve the last debounced draft without imposing commit/history semantics.
			notifyChange();
		}
	}

	private syncTheme = (): void => {
		this.monacoApi?.editor.setTheme(resolveMonacoTheme(document.body.classList));
	};

	private handleEditorDidMount: OnMount = (editor, monacoApi) => {
		this.editor = editor;
		this.monacoApi = monacoApi;
		this.internalValue = this.props.value;
		this.syncTheme();
		this.themeObserver = new MutationObserver(this.syncTheme);
		this.themeObserver.observe(document.body, {
			attributes: true,
			attributeFilter: ['class'],
		});

		monacoApi.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			schemas: [],
			enableSchemaRequest: false,
		});

		editor.focus();
		const defaultPasteAction = editor.getAction('editor.action.clipboardPasteAction');
		editor.addCommand(
			monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyV,
			async () => {
				let text = '';
				if (navigator.clipboard?.readText) {
					try {
						text = await navigator.clipboard.readText();
					} catch {
						text = '';
					}
				}
				if (this.disposed || this.editor !== editor) return;
				if (!text) {
					await defaultPasteAction?.run();
					return;
				}
				editor.pushUndoStop();
				editor.trigger('keyboard', 'type', { text });
				editor.pushUndoStop();
			},
			'textInputFocus'
		);

		this.editorDisposables.push(editor.onDidBlurEditorText(() => {
			this.flushPendingChange();
			this.props.onCommit?.(this.internalValue);
		}));
	};

	private handleEditorChange = (value: string | undefined) => {
		this.internalValue = value ?? '';
		if (this.changeTimeout) clearTimeout(this.changeTimeout);
		this.changeTimeout = setTimeout(() => {
			this.changeTimeout = null;
			this.props.onChange(this.internalValue);
		}, 300);
	};

	render() {
		const { error, className, compact, fill } = this.props;
		const { EditorComponent, loadFailed } = this.state;
		const { rootClassName, wrapperClassName } = getMonacoContainerClassNames({
			className,
			compact,
			fill,
		});

		return (
			<div className={rootClassName}>
				<div className={wrapperClassName}>
					{EditorComponent ? (
						<EditorComponent
							height="100%"
							defaultLanguage="json"
							value={this.props.value}
							onChange={this.handleEditorChange}
							onMount={this.handleEditorDidMount}
							options={getMonacoEditorOptions(Boolean(compact))}
						/>
					) : (
						<div className="d-flex align-items-center justify-content-center h-100" aria-busy={!loadFailed} />
					)}
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

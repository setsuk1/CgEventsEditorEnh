import { name } from 'package.json';
import { CustomTextEditorProvider, Disposable, ExtensionContext, FileSystemWatcher, TextDocument, Uri, WebviewPanel, window, workspace } from 'vscode';
import { CgEventsEditorWebViewPanel } from './CgEventsEditorWebViewPanel';
import { injectDefaultJsonToEvents } from './command';

export class CgEventsEditorProvider implements CustomTextEditorProvider {
	public static readonly viewType = `${name}.eventsEditor`;

	public static register(context: ExtensionContext): Disposable {
		const provider = new CgEventsEditorProvider(context);
		return window.registerCustomEditorProvider(
			CgEventsEditorProvider.viewType,
			provider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			},
		);
	}

	public static setupWatcher(): FileSystemWatcher[] {
		const eventsWatcher = workspace.createFileSystemWatcher('**/*.events');
		eventsWatcher.onDidCreate(async uri => {
			const file = await workspace.fs.readFile(uri);
			if (!file.byteLength) {
				return injectDefaultJsonToEvents(uri);
			}
		});
		return [eventsWatcher];
	}

	protected readonly _context: ExtensionContext;

	public readonly uri: Uri;

	constructor(context: ExtensionContext) {
		this._context = context;
		this.uri = context.extensionUri;
	}

	public resolveCustomTextEditor(document: TextDocument, webviewPanel: WebviewPanel): void {
		new CgEventsEditorWebViewPanel(this, document, webviewPanel);
	}
}

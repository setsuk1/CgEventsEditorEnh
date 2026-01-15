import { editorLangs, ExternalUrlCode, ICgEventsParseSuccess, IEditorLanguageCode, IIncomingMessageLanguageSyncData, IIncomingMessageMap, IncomingMessageType, IOutgoingMessageLanguageSyncData, IOutgoingMessageMap, isLikeLanguage, ISortingPreset, ISortingPresetsRecord, isSimilarLanguage, ISyncLanguageOptions, OutgoingMessageType } from '@shared';
import { name, publisher } from 'package.json';
import { commands, ConfigurationChangeEvent, ConfigurationTarget, Disposable, env, Range, TextDocument, TextDocumentChangeEvent, Uri, WebviewPanel, window, workspace, WorkspaceEdit, WorkspaceFolder } from 'vscode';
import { CgEventsEditorProvider } from "./CgEventsEditorProvider";
import { CgProjectParser } from './CgProjectParser';
import { VSConfigProps } from './enums/VSConfigProps';

export class CgEventsEditorWebViewPanel {
    protected readonly _provider: CgEventsEditorProvider;
    protected readonly _document: TextDocument;
    protected readonly _webviewPanel: WebviewPanel;
    protected readonly _cgProjectParser: CgProjectParser;
    protected readonly _isForTest: boolean;

    protected _subscriptions: Disposable[] = [];

    public readonly workspace: WorkspaceFolder | undefined;

    constructor(provider: CgEventsEditorProvider, document: TextDocument, webviewPanel: WebviewPanel) {
        this._provider = provider;
        this._document = document;
        this._webviewPanel = webviewPanel;
        this.workspace = workspace.getWorkspaceFolder(document.uri);
        this._cgProjectParser = CgProjectParser.getInstance(this.workspace);
        this._cgProjectParser.addLabel(this);
        this._isForTest = this._cgProjectParser.isForTest(document.uri) ?? false;

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [provider.uri],
        };

        this._setupSubscriptions();

        webviewPanel.webview.html = this.renderWebviewHtml();
    }

    private _setupSubscriptions() {
        this._subscriptions.push(this._webviewPanel.onDidDispose(this._panelDispose, this));
        this._subscriptions.push(this._webviewPanel.webview.onDidReceiveMessage(this._recvMsg, this));
        this._subscriptions.push(workspace.onDidChangeTextDocument(this._onDocumentChange, this));
        this._subscriptions.push(workspace.onDidChangeConfiguration(this._onConfigurationChange, this));
    }

    private _panelDispose() {
        this._cgProjectParser.removeLabel(this);
        this._subscriptions.forEach(v => v.dispose());
    }

    private _onDocumentChange(event: TextDocumentChangeEvent) {
        if (event.document.uri.toString() !== this._document.uri.toString()) {
            return;
        }
        this._sendJson();
    }

    private _onConfigurationChange(event: ConfigurationChangeEvent) {
        if (event.affectsConfiguration(`${name}.${VSConfigProps.LANGUAGE}`, this._document.uri)) {
            const config = this.getVSCodeConfig();
            if (config.get<ISyncLanguageOptions>(VSConfigProps.SYNC_LANGUAGE, 'ask') === 'auto') {
                this._sendLanguage();
            }
        } else if (event.affectsConfiguration(`${name}.${VSConfigProps.SYNC_LANGUAGE}`, this._document.uri)) {
            this._sendLanguage(undefined, true);
        }
        if (event.affectsConfiguration(`${name}.${VSConfigProps.SORTING_PRESETS}`, this._document.uri)) {
            this._sendSortingPresets();
        }
    }

    public getVSCodeConfig() {
        return workspace.getConfiguration(name, this._document.uri);
    }

    public parseLanguage<T = 'auto'>(language: string, fallback = 'auto' as T): IEditorLanguageCode | T {
        language = language?.trim()?.toLowerCase();
        if (language === undefined) {
            return fallback;
        }
        const lang = editorLangs.find(lang => isLikeLanguage(lang.code, language)) || editorLangs.find(lang => isSimilarLanguage(lang.code, language));
        if (lang) {
            return lang.code;
        }
        return fallback;
    }

    public getLanguageSettings(lang?: string): IIncomingMessageLanguageSyncData {
        const config = this.getVSCodeConfig();
        const language = this.parseLanguage(lang || config.get<string>(VSConfigProps.LANGUAGE, 'auto'));
        const languageCode = language === 'auto' ? this.parseLanguage(env.language, editorLangs[0].code) : language;
        const syncLanguage = config.get<ISyncLanguageOptions>(VSConfigProps.SYNC_LANGUAGE, 'ask');
        return { language, languageCode, syncLanguage };
    }

    public getHtmlLang() {
        const config = this.getVSCodeConfig();
        return this.parseLanguage(config.get<string>(VSConfigProps.LANGUAGE, 'auto'), editorLangs[0].code);
    }

    public asWebviewUri(path: string, base = this._provider.uri) {
        return this._webviewPanel.webview.asWebviewUri(Uri.joinPath(base, path));
    }

    private renderWebviewHtml(): string {
        const htmlLang = this.getHtmlLang();
        const scriptUri = this.asWebviewUri('dist/webview/index.js');
        const vendorCssUri = this.asWebviewUri('dist/webview/index.css');

        return `
            <!DOCTYPE html>
            <html lang="${htmlLang}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${vendorCssUri}">
            </head>
            <body class="cgenh-events-body">
                <div id="cgevents-root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private _sendMessage<T extends IncomingMessageType>(type: T, data: IIncomingMessageMap[T]) {
        return this._webviewPanel.webview.postMessage({ type, data });
    }

    private _sendLanguage(lang?: string, onlyAsk = false) {
        const data = this.getLanguageSettings(lang);
        if (onlyAsk) {
            delete data.language;
            delete data.languageCode;
        }
        this._sendMessage(IncomingMessageType.LANGUAGE_SYNC, data);
    }

    private _sendJson() {
        this._sendMessage(IncomingMessageType.EVENTS_JSON, CgProjectParser.parseEvents(this._document.getText()));
    }

    private async _sendSchema() {
        this._sendMessage(IncomingMessageType.EVENTS_SCHEMA_JSON, await this._cgProjectParser.getEventsSchema());
    }

    private async _sendCgApp() {
        this._sendMessage(IncomingMessageType.CGAPP, await this._cgProjectParser.getCgApp());
    }

    private async _sendSources() {
        this._sendMessage(IncomingMessageType.PROJECT_SOURCES, await this._cgProjectParser.getSourceList(!this._isForTest));
    }

    private async _sendResources() {
        this._sendMessage(IncomingMessageType.PROJECT_RESOURCES, await this._cgProjectParser.getResourceList(!this._isForTest));
    }

    private async _sendItems() {
        this._sendMessage(IncomingMessageType.PROJECT_ITEMS, await this._cgProjectParser.getItemList());
    }

    private _sendSortingPresets() {
        const config = this.getVSCodeConfig();
        const presetsRecord = config.get<ISortingPresetsRecord>(VSConfigProps.SORTING_PRESETS, {});
        const presets: ISortingPreset[] = Object.entries(presetsRecord).map(([name, rules]) => ({ name, rules }));
        this._sendMessage(IncomingMessageType.SORTING_PRESETS, presets);
    }

    private async _recvMsg(msg: { [T in OutgoingMessageType]: { type: T; data: IOutgoingMessageMap[T] } }[OutgoingMessageType]) {
        switch (msg.type) {
            case OutgoingMessageType.READY:
                this._sendLanguage();
                this._sendJson();
                this._sendSchema();
                this._sendCgApp();
                this._sendSources();
                this._sendResources();
                this._sendItems();
                this._sendSortingPresets();
                break;
            case OutgoingMessageType.LANGUAGE_SYNC:
                this._updageLanguageSettings(msg.data);
                break;
            case OutgoingMessageType.SAVE:
                this._saveFile(msg.data);
                break;
            case OutgoingMessageType.SORTING_PRESETS_SAVE:
                this._saveSortingPreset(msg.data);
                break;
            case OutgoingMessageType.SORTING_PRESETS_DELETE:
                this._deleteSortingPreset(msg.data);
                break;
            case OutgoingMessageType.OPEN_VSCODE_SETTINGS:
                this._openVSCodeSettings();
                break;
            case OutgoingMessageType.OPEN_EXTERNAL_URL:
                this._openExternalUrl(msg.data);
                break;
        }
    }

    private async _updageLanguageSettings(data: IOutgoingMessageLanguageSyncData) {
        const { language, syncLanguage } = data;
        let config = this.getVSCodeConfig();
        if (syncLanguage !== undefined && syncLanguage !== 'once') {
            await config.update(VSConfigProps.SYNC_LANGUAGE, syncLanguage, ConfigurationTarget.Global);
        }
        if (language !== undefined) {
            this._sendLanguage(language);
            config = this.getVSCodeConfig();
            const sync = config.get<ISyncLanguageOptions>(VSConfigProps.SYNC_LANGUAGE, 'ask');
            if (syncLanguage === 'once' || sync === 'auto') {
                if (sync !== 'auto') {
                    await config.update(VSConfigProps.SYNC_LANGUAGE, 'auto', ConfigurationTarget.Global);
                }
                await config.update(VSConfigProps.LANGUAGE, this.parseLanguage(language), ConfigurationTarget.Global);
                if (sync !== 'auto') {
                    await config.update(VSConfigProps.SYNC_LANGUAGE, sync, ConfigurationTarget.Global);
                }
            }
        }
    }

    private async _saveFile(data: ICgEventsParseSuccess) {
        const parsedData = CgProjectParser.serializeEvents(data);
        if (parsedData.format === 'error') {
            window.showErrorMessage(`Failed to save: format error`);
            return;
        }
        const edit = new WorkspaceEdit();
        edit.replace(this._document.uri, new Range(
            this._document.positionAt(0),
            this._document.positionAt(this._document.getText().length)
        ), parsedData.text);
        const success = await workspace.applyEdit(edit);
        if (!success) {
            window.showErrorMessage(`Failed to save: apply error`);
            return;
        }
        const save = await this._document.save();
        if (!save) {
            window.showErrorMessage(`Failed to save: save error`);
            return;
        }
    }

    private _openVSCodeSettings() {
        commands.executeCommand('workbench.action.openSettings', `@ext:${publisher}.${name}`);
    }

    private static readonly EXTERNAL_URLS: Record<ExternalUrlCode, string> = {
        [ExternalUrlCode.OLD_EDITOR_BASIC_TUTORIAL]: 'https://twmission.blogspot.com/2012/11/blog-post.html',
        [ExternalUrlCode.OLD_EDITOR_TUTORIAL_SECTION]: 'https://twmission.blogspot.com/2012/11/blog-post_4745.html',
        [ExternalUrlCode.OLD_EDITOR_DISCUSSION]: 'https://twmission.blogspot.com/2012/12/blog-post.html',
        [ExternalUrlCode.OLD_EDITOR_SAMPLE_DOWNLOAD]: 'https://twmission.blogspot.com/2012/11/blog-post_29.html',
        [ExternalUrlCode.ORIGINAL_EDITOR_BASIC_TUTORIAL]: 'https://haskasu.github.io/code.gamelet.doc/zh/intro.html',
        [ExternalUrlCode.ORIGINAL_EDITOR_TUTORIAL_SECTION]: 'https://www.youtube.com/playlist?list=PL1GxW0vJciBTV9DNrhhRpB80gl5irQRx8',
        [ExternalUrlCode.ORIGINAL_EDITOR_DISCUSSION]: 'https://code.gamelet.com/discuss',
        [ExternalUrlCode.ORIGINAL_EDITOR_SAMPLE_DOWNLOAD]: 'https://code.gamelet.com/projects',
        [ExternalUrlCode.ONLINE_EDITOR]: 'https://code.gamelet.com/edit/'
    };

    private async _openExternalUrl(code: ExternalUrlCode) {
        let url = CgEventsEditorWebViewPanel.EXTERNAL_URLS[code];
        if (!url) {
            return;
        }
        if (code === ExternalUrlCode.ONLINE_EDITOR) {
            const projectCode = (await this._cgProjectParser.getCgApp())?.projectCode;
            if (!projectCode) {
                window.showErrorMessage('Failed to open online editor: project code not found.');
                return;
            }
            url += encodeURIComponent(projectCode);
        }
        env.openExternal(Uri.parse(url));
    }

    private async _saveSortingPreset(preset: ISortingPreset) {
        const config = this.getVSCodeConfig();
        const presets = config.get<ISortingPresetsRecord>(VSConfigProps.SORTING_PRESETS, {});
        presets[preset.name] = preset.rules;
        await config.update(VSConfigProps.SORTING_PRESETS, presets, ConfigurationTarget.Global);
    }

    private async _deleteSortingPreset(name: string) {
        const config = this.getVSCodeConfig();
        const presets = Object.assign({}, config.get<ISortingPresetsRecord>(VSConfigProps.SORTING_PRESETS, {}));
        delete presets[name];
        await config.update(VSConfigProps.SORTING_PRESETS, presets, ConfigurationTarget.Global);
    }
}

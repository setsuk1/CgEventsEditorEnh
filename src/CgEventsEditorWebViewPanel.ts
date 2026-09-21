import { editorLangs, ExternalUrlCode, ICgEventsParseSuccess, ICgItemInfoList, IEditorLanguageCode, IIncomingMessageLanguageSyncData, IIncomingMessageMap, IncomingMessageType, IOutgoingMessageLanguageSyncData, isCgEventsDocument, isLikeLanguage, isOutgoingMessage, ISortingPreset, isSimilarLanguage, ISyncLanguageOptions, OutgoingMessageType } from '@shared';
import { randomUUID } from 'crypto';
import { name, publisher } from 'package.json';
import { commands, ConfigurationChangeEvent, ConfigurationTarget, Disposable, env, Range, TextDocument, TextDocumentChangeEvent, Uri, WebviewPanel, window, workspace, WorkspaceEdit, WorkspaceFolder } from 'vscode';
import { CgEventsEditorProvider } from "./CgEventsEditorProvider";
import { CgProjectChange, CgProjectParser } from './CgProjectParser';
import { VSConfigProps } from './enums/VSConfigProps';
import { resolveDocumentSaveAction } from './utils/documentSavePlan';
import { resolveExternalUrl } from './utils/externalUrls';
import { sanitizeSortingPresetsRecord } from './utils/sortingPresets';

const DOCUMENT_CHANGE_DEBOUNCE_MS = 75;
const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export class CgEventsEditorWebViewPanel {
    protected readonly _provider: CgEventsEditorProvider;
    protected readonly _document: TextDocument;
    protected readonly _webviewPanel: WebviewPanel;
    protected readonly _cgProjectParser: CgProjectParser;
    protected readonly _isForTest: boolean;
    protected _subscriptions: Disposable[] = [];
    private readonly _messageToken = randomUUID();
    private _saveTail: Promise<void> = Promise.resolve();
    private _languageSettingsTail: Promise<void> = Promise.resolve();
    private _sortingPresetTail: Promise<void> = Promise.resolve();
    private _applyingWebviewEdit = false;
    private _lastAcceptedWebviewBaseVersion: number | undefined;
    private _lastAppliedWebviewDocumentVersion: number | undefined;
    private _disposed = false;
    private _documentChangeTimer: NodeJS.Timeout | undefined;
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
            localResourceRoots: this.workspace ? [provider.uri, this.workspace.uri] : [provider.uri],
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
        this._disposed = true;
        this._cgProjectParser.removeLabel(this);
        if (this._documentChangeTimer !== undefined) {
            clearTimeout(this._documentChangeTimer);
            this._documentChangeTimer = undefined;
        }
        this._subscriptions.forEach(v => v.dispose());
        this._subscriptions.length = 0;
    }

    public onCgProjectChange(change: CgProjectChange): void {
        switch (change) {
            case 'sources':
                void this._sendSources();
                break;
            case 'schema':
                void this._sendSchema();
                break;
            case 'cgapp':
                void this._sendCgApp();
                void this._sendResources();
                break;
            case 'items':
                void this._sendItems();
                break;
        }
    }

    private _onDocumentChange(event: TextDocumentChangeEvent) {
        if (event.document.uri.toString() !== this._document.uri.toString() || this._applyingWebviewEdit) return;
        this._lastAcceptedWebviewBaseVersion = undefined;
        this._lastAppliedWebviewDocumentVersion = undefined;
        if (this._documentChangeTimer !== undefined) clearTimeout(this._documentChangeTimer);
        this._documentChangeTimer = setTimeout(() => {
            this._documentChangeTimer = undefined;
            this._sendJson();
        }, DOCUMENT_CHANGE_DEBOUNCE_MS);
    }

    private _onConfigurationChange(event: ConfigurationChangeEvent) {
        if (event.affectsConfiguration(`${name}.${VSConfigProps.LANGUAGE}`, this._document.uri)) {
            this._sendLanguage();
        } else if (event.affectsConfiguration(`${name}.${VSConfigProps.SYNC_LANGUAGE}`, this._document.uri)) {
            this._sendLanguage(undefined, true);
        }
        if (event.affectsConfiguration(`${name}.${VSConfigProps.SORTING_PRESETS}`, this._document.uri)) this._sendSortingPresets();
    }

    public getVSCodeConfig() {
        return workspace.getConfiguration(name, this._document.uri);
    }

    public parseLanguage<T = 'auto'>(language: string, fallback = 'auto' as T): IEditorLanguageCode | T {
        language = language?.trim()?.toLowerCase();
        if (language === undefined) return fallback;
        const lang = editorLangs.find(lang => isLikeLanguage(lang.code, language)) || editorLangs.find(lang => isSimilarLanguage(lang.code, language));
        return lang ? lang.code : fallback;
    }

    public getLanguageSettings(lang?: string): IIncomingMessageLanguageSyncData {
        const config = this.getVSCodeConfig();
        const language = this.parseLanguage(lang || config.get<string>(VSConfigProps.LANGUAGE, 'auto'));
        const languageCode = language === 'auto' ? this.parseLanguage(env.language, editorLangs[0].code) : language;
        const syncLanguage = config.get<ISyncLanguageOptions>(VSConfigProps.SYNC_LANGUAGE, 'ask');
        return { language, languageCode, syncLanguage };
    }

    public getHtmlLang() {
        return this.getLanguageSettings().languageCode;
    }

    public asWebviewUri(path: string, base = this._provider.uri) {
        return this._webviewPanel.webview.asWebviewUri(Uri.joinPath(base, path));
    }

    private renderWebviewHtml(): string {
        const htmlLang = this.getHtmlLang();
        const webview = this._webviewPanel.webview;
        const scriptUri = this.asWebviewUri('dist/webview/index.js');
        const vendorCssUri = this.asWebviewUri('dist/webview/index.css');
        const editorWorkerUri = this.asWebviewUri('dist/webview/monaco-workers/editor.worker.js');
        const jsonWorkerUri = this.asWebviewUri('dist/webview/monaco-workers/json.worker.js');

        return `
            <!DOCTYPE html>
            <html lang="${htmlLang}">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; media-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; worker-src ${webview.cspSource} blob:; frame-src https://*.gamelet.online;">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${vendorCssUri}">
            </head>
            <body class="cgenh-events-body">
                <div id="cgevents-root" data-message-token="${this._messageToken}" data-monaco-editor-worker="${editorWorkerUri}" data-monaco-json-worker="${jsonWorkerUri}"></div>
                <script type="module" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private _sendMessage<T extends IncomingMessageType>(type: T, data: IIncomingMessageMap[T]) {
        if (this._disposed) return Promise.resolve(false);
        return this._webviewPanel.webview.postMessage({ token: this._messageToken, type, data });
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
        const documentVersion = this._document.version;
        const parsed = CgProjectParser.parseEvents(this._document.getText());
        if (parsed.format !== 'error' && !isCgEventsDocument(parsed.json)) {
            this._sendMessage(IncomingMessageType.EVENTS_JSON, {
                format: 'error',
                error: 'Invalid events document structure',
                documentVersion
            });
            return;
        }
        this._sendMessage(
            IncomingMessageType.EVENTS_JSON,
            { ...parsed, documentVersion }
        );
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
        const items = await this._cgProjectParser.getItemList();
        if (this._disposed) return;
        if (!items || !this.workspace) {
            this._sendMessage(IncomingMessageType.PROJECT_ITEMS, items);
            return;
        }
        const list = items.list.map(item => {
            if (!item.iconUrl) return item;
            if (item.iconUrl.startsWith('//')) {
                return { ...item, iconUrl: `https:${item.iconUrl}` };
            }
            if (URI_SCHEME_RE.test(item.iconUrl)) return item;
            const relativePath = item.iconUrl.replace(/^\/+/, '');
            return {
                ...item,
                iconUrl: this._webviewPanel.webview.asWebviewUri(Uri.joinPath(this.workspace!.uri, relativePath)).toString()
            };
        });
        this._sendMessage(IncomingMessageType.PROJECT_ITEMS, { ...items, list } as ICgItemInfoList);
    }

    private _sendSortingPresets() {
        const config = this.getVSCodeConfig();
        const presetsRecord = sanitizeSortingPresetsRecord(config.get<unknown>(VSConfigProps.SORTING_PRESETS));
        const presets: ISortingPreset[] = Object.entries(presetsRecord).map(([name, rules]) => ({ name, rules }));
        this._sendMessage(IncomingMessageType.SORTING_PRESETS, presets);
    }

    private async _recvMsg(msg: unknown) {
        if (!msg || typeof msg !== 'object' || Array.isArray(msg) || (msg as { token?: unknown }).token !== this._messageToken) return;
        if (!isOutgoingMessage(msg)) return;
        switch (msg.type) {
            case OutgoingMessageType.READY:
                this._sendLanguage();
                this._sendJson();
                void this._sendSchema();
                void this._sendCgApp();
                void this._sendSources();
                void this._sendResources();
                void this._sendItems();
                this._sendSortingPresets();
                break;
            case OutgoingMessageType.LANGUAGE_SYNC: {
                const task = this._languageSettingsTail.then(() => this._updateLanguageSettings(msg.data));
                this._languageSettingsTail = task.catch(() => undefined);
                await task;
                break;
            }
            case OutgoingMessageType.SAVE: {
                const data = msg.data;
                const task = this._saveTail.then(() => this._saveFile(data));
                this._saveTail = task.catch(() => undefined);
                await task;
                break;
            }
            case OutgoingMessageType.SORTING_PRESETS_SAVE: {
                const task = this._sortingPresetTail.then(() => this._saveSortingPreset(msg.data));
                this._sortingPresetTail = task.catch(() => undefined);
                await task;
                break;
            }
            case OutgoingMessageType.SORTING_PRESETS_DELETE: {
                const task = this._sortingPresetTail.then(() => this._deleteSortingPreset(msg.data));
                this._sortingPresetTail = task.catch(() => undefined);
                await task;
                break;
            }
            case OutgoingMessageType.OPEN_VSCODE_SETTINGS:
                this._openVSCodeSettings();
                break;
            case OutgoingMessageType.OPEN_EXTERNAL_URL:
                await this._openExternalUrl(msg.data);
                break;
        }
    }

    private async _updateLanguageSettings(data: IOutgoingMessageLanguageSyncData) {
        const { language, syncLanguage } = data;
        let config = this.getVSCodeConfig();
        if (syncLanguage !== undefined && syncLanguage !== 'once') await config.update(VSConfigProps.SYNC_LANGUAGE, syncLanguage, ConfigurationTarget.Global);
        if (language === undefined) return;
        this._sendLanguage(language);
        config = this.getVSCodeConfig();
        const sync = config.get<ISyncLanguageOptions>(VSConfigProps.SYNC_LANGUAGE, 'ask');
        if (syncLanguage === 'once' || sync === 'auto') {
            if (sync !== 'auto') await config.update(VSConfigProps.SYNC_LANGUAGE, 'auto', ConfigurationTarget.Global);
            await config.update(VSConfigProps.LANGUAGE, this.parseLanguage(language), ConfigurationTarget.Global);
            if (sync !== 'auto') await config.update(VSConfigProps.SYNC_LANGUAGE, sync, ConfigurationTarget.Global);
        }
    }

    private async _saveFile(data: ICgEventsParseSuccess) {
        const parsedData = CgProjectParser.serializeEvents(data);
        if (parsedData.format === 'error') {
            window.showErrorMessage('Failed to save: format error');
            return;
        }

        try {
            const currentText = this._document.getText();
            const action = resolveDocumentSaveAction({
                baseVersion: data.documentVersion,
                currentVersion: this._document.version,
                serializedText: parsedData.text,
                currentText,
                isDirty: this._document.isDirty,
                acceptedBaseVersion: this._lastAcceptedWebviewBaseVersion,
                lastAppliedVersion: this._lastAppliedWebviewDocumentVersion,
            });
            if (action === 'send-current') {
                this._sendJson();
                return;
            }
            if (action === 'save-current') {
                if (!await this._document.save()) {
                    window.showErrorMessage('Failed to save: save error');
                    return;
                }
                this._sendJson();
                return;
            }
            if (action === 'reject-stale') {
                window.showWarningMessage('Unable to save because the events file changed outside the visual editor. Review the latest document changes before saving again.');
                return;
            }
            const edit = new WorkspaceEdit();
            edit.replace(this._document.uri, new Range(this._document.positionAt(0), this._document.positionAt(currentText.length)), parsedData.text);
            this._applyingWebviewEdit = true;
            let applied: boolean;
            try {
                applied = await workspace.applyEdit(edit);
            } finally {
                this._applyingWebviewEdit = false;
            }
            if (!applied) {
                window.showErrorMessage('Failed to save: apply error');
                return;
            }
            this._lastAcceptedWebviewBaseVersion = data.documentVersion;
            this._lastAppliedWebviewDocumentVersion = this._document.version;
            if (!await this._document.save()) {
                window.showErrorMessage('Failed to save: save error');
                return;
            }
            this._sendJson();
        } catch (error) {
            console.error('Failed to save events file:', error);
            window.showErrorMessage('Failed to save: unexpected error');
        }
    }

    private _openVSCodeSettings() {
        void commands.executeCommand('workbench.action.openSettings', `@ext:${publisher}.${name}`);
    }

    private async _openExternalUrl(code: ExternalUrlCode) {
        const projectCode = code === ExternalUrlCode.ONLINE_EDITOR
            ? (await this._cgProjectParser.getCgApp())?.projectCode
            : undefined;
        const url = resolveExternalUrl(code, projectCode);
        if (!url) {
            if (code === ExternalUrlCode.ONLINE_EDITOR) {
                window.showErrorMessage('Failed to open online editor: project code not found.');
            }
            return;
        }
        await env.openExternal(Uri.parse(url));
    }

    private async _saveSortingPreset(preset: ISortingPreset) {
        const config = this.getVSCodeConfig();
        const presets = sanitizeSortingPresetsRecord(config.get<unknown>(VSConfigProps.SORTING_PRESETS));
        const existing = presets[preset.name];
        if (existing && existing.length === preset.rules.length && existing.every((rule, index) => rule.order === preset.rules[index].order && rule.target === preset.rules[index].target)) return;
        presets[preset.name] = preset.rules;
        await config.update(VSConfigProps.SORTING_PRESETS, presets, ConfigurationTarget.Global);
    }

    private async _deleteSortingPreset(name: string) {
        const config = this.getVSCodeConfig();
        const presets = sanitizeSortingPresetsRecord(config.get<unknown>(VSConfigProps.SORTING_PRESETS));
        if (!Object.hasOwn(presets, name)) return;
        delete presets[name];
        await config.update(VSConfigProps.SORTING_PRESETS, presets, ConfigurationTarget.Global);
    }
}
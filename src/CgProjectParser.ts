import { ICgAppInfo, ICgEventsDocument, ICgEventsParseResult, ICgEventsSchema, ICgEventsSerializeResult, ICgItemInfoList, isCgEventsDocument, isCgEventsSchema, isCgItemInfoList, ObjectUtil } from '@shared';
import { FileSystemWatcher, FileType, RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { parseCgAppFromScriptsText } from './utils/cgAppScripts';
import { compareDefaultEventSourceOrder, type DefaultEventSourceOrder, filterDefaultConfigs, mergeDefaultEvents } from './utils/defaultEventsMerge';
import { parseEventsText, serializeEventsText } from './utils/eventsCodec';
import { mergeEventsSchemaMap } from './utils/eventsSchemaMerge';
import { fsUtil } from './utils/fsUtil';
import { LazyAsyncLoad } from './utils/LazyAsyncLoad';
import { buildResourceLists } from './utils/resourceList';
import { getSourceRelativePath as resolveSourceRelativePath, isPreloadSource, isTestSource, PRELOAD_SOURCE_EXCLUDE_GLOB } from './utils/sourceList';

const DISPOSE_TIMEOUT = 60000;
const SCRIPTS_PATH = '/static/js/scripts.js';
const ITEMS_PATH = '/static/json/items.json';
const SRC_FOLDER_PATH = '/src';
const EVENTS_SCHEMA_FILE_NAME = 'events.schema.json';
const CG_EVENTS_ELEMENT_CATEGORIES = ['trigger', 'check', 'action', 'definition'] as const;
const DEFAULT_EVENTS_JSON_FILE_NAME = 'default.events.json';
const BASE_DEFAULT_EVENTS_JSON: ICgEventsDocument = {
    $schema: 'https://code.gamelet.com/gassets/schema/events/v1',
    config: {
        stage: {
            width: 800,
            height: 600,
            backgroundColor: '#999999',
            resolutionPolicy: 'showAll',
            alignHorizontal: 'center',
            alignVertical: 'middle'
        },
        preload: {
            resourcesExclude: [],
            sources: []
        }
    },
    events: []
};

export type CgProjectChange = 'sources' | 'schema' | 'cgapp' | 'items';
export type CgProjectFileChange = 'create' | 'change' | 'delete';

export interface CgProjectChangeListener {
    onCgProjectChange?(change: CgProjectChange): void;
}

interface DefaultEventsSource extends DefaultEventSourceOrder {
    json: unknown;
}

function getSourceRelativePath(workspaceFolder: WorkspaceFolder, uri: Uri): string | undefined {
    const srcPath = Uri.joinPath(workspaceFolder.uri, SRC_FOLDER_PATH).fsPath;
    return resolveSourceRelativePath(srcPath, uri.fsPath);
}

function isDefaultEventsPatch(value: unknown): value is ICgEventsDocument {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const patch = value as Record<string, unknown>;
    const config = patch.config === undefined ? {} : patch.config;
    const events = patch.events === undefined ? [] : patch.events;
    return isCgEventsDocument({ ...patch, config, events });
}

export class CgProjectParser {
    protected static readonly _map = new Map<string, CgProjectParser>();
    protected static _emptyInstance: CgProjectParser | undefined;

    public static getInstance(workspace: WorkspaceFolder | undefined): CgProjectParser {
        if (!workspace) {
            if (!CgProjectParser._emptyInstance) {
                CgProjectParser._emptyInstance = new CgProjectParser();
            }
            return CgProjectParser._emptyInstance;
        }

        const key = workspace.uri.toString();
        let parser = CgProjectParser._map.get(key);
        if (!parser) {
            parser = new CgProjectParser(workspace);
            CgProjectParser._map.set(key, parser);
        }
        return parser;
    }

    public static getInstanceInWorkspace(uri: Uri): CgProjectParser & { workspace: WorkspaceFolder } | undefined {
        const workspaceFolder = workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) return undefined;
        const parser = CgProjectParser._map.get(workspaceFolder.uri.toString());
        if (parser?.workspace) {
            return parser as CgProjectParser & { workspace: WorkspaceFolder };
        }
        return undefined;
    }

    public static onAllEvent(
        watcher: FileSystemWatcher,
        listener: (event: CgProjectFileChange, uri: Uri) => void | Promise<void>
    ): void {
        watcher.onDidCreate(e => listener('create', e));
        watcher.onDidChange(e => listener('change', e));
        watcher.onDidDelete(e => listener('delete', e));
    }

    public static setupWatcher(): FileSystemWatcher[] {
        const scriptsWatcher = workspace.createFileSystemWatcher('**' + SCRIPTS_PATH);
        CgProjectParser.onAllEvent(scriptsWatcher, async (event, uri: Uri) => {
            const parser = this.getInstanceInWorkspace(uri);
            if (!parser || !parser._scriptsLoad.started || Uri.joinPath(parser.workspace.uri, SCRIPTS_PATH).toString() !== uri.toString()) {
                return;
            }
            if (event === 'delete') {
                await parser._scriptsLoad.waitForPending();
                parser._cgApp = undefined;
                parser._resourceList = [];
                parser._resourceExcludeTestList = [];
                parser._isResourceListNeedUpdate = false;
                parser._notifyLabels('cgapp');
                return;
            }
            await parser._scriptsLoad.waitForPending();
            await parser._loadScripts();
            parser._notifyLabels('cgapp');
        });

        const itemsWatcher = workspace.createFileSystemWatcher('**' + ITEMS_PATH);
        CgProjectParser.onAllEvent(itemsWatcher, async (event, uri: Uri) => {
            const parser = this.getInstanceInWorkspace(uri);
            if (!parser || !parser._itemsLoad.started || Uri.joinPath(parser.workspace.uri, ITEMS_PATH).toString() !== uri.toString()) {
                return;
            }
            if (event === 'delete') {
                await parser._itemsLoad.waitForPending();
                parser._itemList = undefined;
                parser._notifyLabels('items');
                return;
            }
            await parser._itemsLoad.waitForPending();
            await parser._loadItems();
            parser._notifyLabels('items');
        });

        const srcWatcher = workspace.createFileSystemWatcher('**' + SRC_FOLDER_PATH + '/**/*');
        CgProjectParser.onAllEvent(srcWatcher, async (event, uri: Uri) => {
            const parser = this.getInstanceInWorkspace(uri);
            if (!parser || !getSourceRelativePath(parser.workspace, uri)) return;

            if (event === 'create') {
                try {
                    const stat = await workspace.fs.stat(uri);
                    if ((stat.type & FileType.File) === 0) return;
                } catch {
                    return;
                }
            }

            if ((event === 'create' || event === 'delete') && parser._updateSource(uri, event === 'delete')) {
                parser._notifyLabels('sources');
            }
        });

        const schemaWatcher = workspace.createFileSystemWatcher('**/' + EVENTS_SCHEMA_FILE_NAME);
        CgProjectParser.onAllEvent(schemaWatcher, async (event, uri: Uri) => {
            const parser = this.getInstanceInWorkspace(uri);
            if (!parser || !parser._eventsSchemaLoad.started) return;
            const key = uri.toString();
            parser._eventsSchemaVersions.set(key, (parser._eventsSchemaVersions.get(key) ?? 0) + 1);
            if (event === 'delete') {
                if (parser._removeEventsSchemaFromMap(uri)) parser._notifyLabels('schema');
                return;
            }
            if (await parser._updateEventsSchemaInMap(uri)) parser._notifyLabels('schema');
        });

        return [scriptsWatcher, itemsWatcher, srcWatcher, schemaWatcher];
    }

    public static parseEvents(input: string): ICgEventsParseResult {
        return parseEventsText(input);
    }

    public static serializeEvents(input: ICgEventsParseResult): ICgEventsSerializeResult {
        return serializeEventsText(input);
    }

    protected readonly _labelList = new Set<CgProjectChangeListener>();
    protected _cgApp: ICgAppInfo | undefined;
    protected _itemList: ICgItemInfoList | undefined;
    protected _resourceList: string[] = [];
    protected _resourceExcludeTestList: string[] = [];
    protected _sourceList: string[] = [];
    protected _sourceExcludeTestList: string[] = [];
    protected _sourceVersion = 0;
    protected _eventsSchemaMap: Record<string, ICgEventsSchema> = {};
    protected _eventsSchemaVersions = new Map<string, number>();
    protected _eventsSchema: ICgEventsSchema = this._createEmptyEventsSchema();
    protected _isResourceListNeedUpdate = true;
    protected _isSourceListNeedSort = false;
    protected _isEventsSchemaNeedMerge = false;
    protected readonly _scriptsLoad = new LazyAsyncLoad();
    protected readonly _itemsLoad = new LazyAsyncLoad();
    protected readonly _sourceLoad = new LazyAsyncLoad();
    protected _updateEventsSchemaPromises: Promise<boolean>[] = [];
    protected readonly _eventsSchemaLoad = new LazyAsyncLoad();
    protected _disposeTimeout: NodeJS.Timeout | undefined;
    public readonly uriStr: string | undefined;

    private constructor(public readonly workspace?: WorkspaceFolder) {
        this.uriStr = workspace?.uri.toString();
        console.log(`CG project parser create at ${this.uriStr}`);
    }

    public addLabel(label: CgProjectChangeListener) {
        if (this._disposeTimeout !== undefined) {
            clearTimeout(this._disposeTimeout);
            this._disposeTimeout = undefined;
        }
        this._labelList.add(label);
    }

    public removeLabel(label: CgProjectChangeListener) {
        this._labelList.delete(label);
        if (this._labelList.size !== 0) return;
        if (this._disposeTimeout !== undefined) clearTimeout(this._disposeTimeout);
        this._disposeTimeout = setTimeout(() => {
            this._disposeTimeout = undefined;
            if (this._labelList.size === 0) this.dispose();
        }, DISPOSE_TIMEOUT);
    }

    protected _notifyLabels(change: CgProjectChange): void {
        for (const label of this._labelList) {
            label?.onCgProjectChange?.(change);
        }
    }

    public dispose() {
        if (this._disposeTimeout !== undefined) {
            clearTimeout(this._disposeTimeout);
            this._disposeTimeout = undefined;
        }
        if (CgProjectParser._emptyInstance === this) {
            CgProjectParser._emptyInstance = undefined;
        } else if (this.uriStr !== undefined) {
            CgProjectParser._map.delete(this.uriStr);
        }
    }

    protected async _readScripts(uri: Uri): Promise<void> {
        try {
            const text = await fsUtil.readFile(uri);
            if (!text) {
                this._cgApp = undefined;
                return;
            }
            this._cgApp = parseCgAppFromScriptsText(text);
        } catch (e) {
            this._cgApp = undefined;
            console.error(`Error in read scripts at ${this.uriStr}:`, e);
        }
    }

    private _loadScriptsData(): Promise<void> {
        if (!this.workspace) return Promise.resolve();
        this._isResourceListNeedUpdate = true;
        return this._readScripts(Uri.joinPath(this.workspace.uri, SCRIPTS_PATH));
    }

    protected _loadScripts(): Promise<void> {
        return this._scriptsLoad.reload(() => this._loadScriptsData());
    }

    public async getCgApp(): Promise<ICgAppInfo | undefined> {
        if (!this.workspace) return this._cgApp;
        await this._scriptsLoad.ensure(() => this._loadScriptsData());
        return this._cgApp;
    }

    protected async _readItems(uri: Uri): Promise<void> {
        const items = await fsUtil.readJson(uri);
        this._itemList = isCgItemInfoList(items) ? items : undefined;
    }

    private _loadItemsData(): Promise<void> {
        if (!this.workspace) return Promise.resolve();
        return this._readItems(Uri.joinPath(this.workspace.uri, ITEMS_PATH));
    }

    protected _loadItems(): Promise<void> {
        return this._itemsLoad.reload(() => this._loadItemsData());
    }

    public async getItemList(): Promise<ICgItemInfoList | undefined> {
        if (!this.workspace) return this._itemList;
        await this._itemsLoad.ensure(() => this._loadItemsData());
        return this._itemList;
    }

    protected _updateResourceList(): void {
        const { all, excludingTest } = buildResourceLists(this._cgApp);
        this._resourceList = all;
        this._resourceExcludeTestList = excludingTest;
        this._isResourceListNeedUpdate = false;
    }

    public async getResourceList(excludeTest = false): Promise<string[]> {
        if (this._isResourceListNeedUpdate) {
            await this.getCgApp();
            this._updateResourceList();
        }
        return excludeTest ? this._resourceExcludeTestList : this._resourceList;
    }

    protected async _findAllSource(): Promise<void> {
        if (!this.workspace) return;
        const workspaceFolder = this.workspace;
        const srcUri = Uri.joinPath(workspaceFolder.uri, SRC_FOLDER_PATH);
        for (;;) {
            const sourceVersion = this._sourceVersion;
            const uris = await workspace.findFiles(
                new RelativePattern(srcUri, '**'),
                PRELOAD_SOURCE_EXCLUDE_GLOB
            );
            if (sourceVersion !== this._sourceVersion) continue;

            const sourceList = uris
                .map(uri => getSourceRelativePath(workspaceFolder, uri))
                .filter((relativePath): relativePath is string => !!relativePath && isPreloadSource(relativePath));
            this._sourceList = sourceList;
            this._sourceExcludeTestList = sourceList.filter(relativePath => !isTestSource(relativePath));
            this._isSourceListNeedSort = true;
            return;
        }
    }

    protected _updateSource(uri: Uri, del = false): boolean {
        if (!this.workspace) return false;
        const relativePath = getSourceRelativePath(this.workspace, uri);
        if (!relativePath || !isPreloadSource(relativePath)) return false;
        this._sourceVersion += 1;
        const index = this._sourceList.indexOf(relativePath);
        const indexEx = this._sourceExcludeTestList.indexOf(relativePath);
        if (del) {
            let changed = false;
            if (index !== -1) {
                this._sourceList.splice(index, 1);
                changed = true;
            }
            if (indexEx !== -1) {
                this._sourceExcludeTestList.splice(indexEx, 1);
                changed = true;
            }
            return changed;
        }
        let changed = false;
        if (index === -1) {
            this._sourceList.push(relativePath);
            this._isSourceListNeedSort = true;
            changed = true;
        }
        if (!isTestSource(relativePath) && indexEx === -1) {
            this._sourceExcludeTestList.push(relativePath);
            this._isSourceListNeedSort = true;
            changed = true;
        }
        return changed;
    }

    public async getSourceList(excludeTest = false): Promise<string[]> {
        await this._sourceLoad.ensure(() => this._findAllSource());
        if (this._isSourceListNeedSort) {
            this._sourceList.sort();
            this._sourceExcludeTestList.sort();
            this._isSourceListNeedSort = false;
        }
        return excludeTest ? this._sourceExcludeTestList : this._sourceList;
    }

    protected _createEmptyEventsSchema(): ICgEventsSchema {
        return { trigger: {}, check: {}, action: {}, definition: {} };
    }

    protected _removeEventsSchemaFromMap(uri: Uri): boolean {
        const key = uri.toString();
        if (!(key in this._eventsSchemaMap)) return false;
        delete this._eventsSchemaMap[key];
        this._isEventsSchemaNeedMerge = true;
        return true;
    }

    protected async __updateEventsSchemaInMap(uri: Uri, version: number): Promise<boolean> {
        const key = uri.toString();
        const schema = await fsUtil.readJson(uri);
        if ((this._eventsSchemaVersions.get(key) ?? 0) !== version) return false;
        if (!isCgEventsSchema(schema)) return this._removeEventsSchemaFromMap(uri);
        this._eventsSchemaMap[key] = schema;
        this._isEventsSchemaNeedMerge = true;
        return true;
    }

    protected _updateEventsSchemaInMap(uri: Uri): Promise<boolean> {
        const version = this._eventsSchemaVersions.get(uri.toString()) ?? 0;
        const promise = this.__updateEventsSchemaInMap(uri, version).finally(() => {
            const index = this._updateEventsSchemaPromises.indexOf(promise);
            if (index !== -1) this._updateEventsSchemaPromises.splice(index, 1);
        });
        this._updateEventsSchemaPromises.push(promise);
        return promise;
    }

    protected async _checkUpdateEventsSchemaPromisesResolve() {
        while (this._updateEventsSchemaPromises.length) {
            await Promise.all(this._updateEventsSchemaPromises);
        }
    }

    private async _loadEventsSchemaData(): Promise<void> {
        if (!this.workspace) return;
        const uris = await workspace.findFiles(new RelativePattern(this.workspace, '**/' + EVENTS_SCHEMA_FILE_NAME));
        for (const uri of uris) this._updateEventsSchemaInMap(uri);
        await this._checkUpdateEventsSchemaPromisesResolve();
    }

    protected _mergeEventsSchemasInMap(): void {
        this._eventsSchema = mergeEventsSchemaMap(this._eventsSchemaMap);
    }

    public isEmptyEventsSchema(schema: ICgEventsSchema): boolean {
        for (const cat of CG_EVENTS_ELEMENT_CATEGORIES) {
            if (Object.keys(schema[cat] ?? {}).length) return false;
        }
        return true;
    }

    public async getEventsSchema(): Promise<ICgEventsSchema> {
        await this._eventsSchemaLoad.ensure(() => this._loadEventsSchemaData());
        await this._checkUpdateEventsSchemaPromisesResolve();
        if (this._isEventsSchemaNeedMerge) {
            this._mergeEventsSchemasInMap();
            this._isEventsSchemaNeedMerge = false;
        }
        return this._eventsSchema;
    }

    protected _filterDefaultEvents(json: ICgEventsDocument, schema: ICgEventsSchema): ICgEventsDocument {
        filterDefaultConfigs(json?.config?.configs, schema.definition);
        return json;
    }

    protected async _readDefaultEventsSource(uri: Uri): Promise<DefaultEventsSource | undefined> {
        try {
            const [json, stat] = await Promise.all([
                fsUtil.readJson(uri),
                workspace.fs.stat(uri)
            ]);
            if (!json) return undefined;
            return {
                json,
                mtime: stat.mtime,
                key: uri.toString()
            };
        } catch {
            return undefined;
        }
    }

    protected async _findAllDefaultEvents(): Promise<ICgEventsDocument[]> {
        if (!this.workspace) return [];
        const uris = await workspace.findFiles(new RelativePattern(this.workspace, '**/' + DEFAULT_EVENTS_JSON_FILE_NAME));
        if (!uris.length) return [];
        const [schema, files] = await Promise.all([
            this.getEventsSchema(),
            Promise.all(uris.map(uri => this._readDefaultEventsSource(uri)))
        ]);
        return files
            .filter((file): file is DefaultEventsSource & { json: ICgEventsDocument } =>
                !!file && isDefaultEventsPatch(file.json)
            )
            .sort(compareDefaultEventSourceOrder)
            .map(file => this._filterDefaultEvents(file.json, schema));
    }

    public async getDefaultEvents(): Promise<ICgEventsDocument> {
        const json = ObjectUtil.deepCloneObject(BASE_DEFAULT_EVENTS_JSON) ?? {} as ICgEventsDocument;
        if (this.workspace === undefined) return json;
        for (const defaultEventsJson of await this._findAllDefaultEvents()) {
            mergeDefaultEvents(json, defaultEventsJson);
        }
        return json;
    }

    public isForTest(uri: Uri): boolean | undefined {
        if (!this.workspace) return undefined;
        const relativePath = getSourceRelativePath(this.workspace, uri);
        return relativePath ? isTestSource(relativePath) : false;
    }
}

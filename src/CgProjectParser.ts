import { ICgAppInfo, ICgEventsDocument, ICgEventsParseResult, ICgEventsSchema, ICgEventsSerializeResult, ICgItemInfoList, ObjectUtil } from '@shared';
import LZString from 'lz-string';
import path from 'path';
import { FileSystemWatcher, RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { fsUtil } from './utils/fsUtil';
import { stringUtil } from './utils/stringUtil';

const DISPOSE_TIMEOUT = 60000;

const LZ_PREFIX = '/*lz*/';

const SCRIPTS_KEY = '"CgCfg"';
const SCRIPTS_PATH = '/static/js/scripts.js';

const ITEMS_PATH = '/static/json/items.json';

const ALLOW_PRELOAD_RESOURECE_TYPES = ['image', 'spritesheet', 'gaf', 'spine', 'sound', 'text', 'tmx', 'twmap', 'twrole', 'other', 'soundPack'];

const SRC_FOLDER_PATH = '/src';
const EXCLUDE_PRELOAD_SOURCE_EXTS = ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'md'];

const EVENTS_SCHEMA_FILE_NAME = 'events.schema.json';
const CG_EVENTS_ELEMENT_CATEGORIES = ['trigger', 'check', 'action', 'definition'] as const;

const DEFAULT_EVENTS_JSON_FILE_NAME = 'default.events.json';
const BASE_DEFUALT_EVENTS_JSON: ICgEventsDocument = {
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

const TEST_FOLDER_NAME = 'test';
const TEST_FOLDER_PATH = SRC_FOLDER_PATH + '/' + TEST_FOLDER_NAME;

export class CgProjectParser {
    protected static readonly _map: Record<string, CgProjectParser> = {};
    protected static _emptyInstance: CgProjectParser | undefined;

    public static getInstance(workspace: WorkspaceFolder | undefined): CgProjectParser {
        if (!workspace) {
            return CgProjectParser._emptyInstance ?? new CgProjectParser();
        }
        return CgProjectParser._map[workspace.uri.toString()] ?? new CgProjectParser(workspace);
    }

    public static getInstanceInWorkspace(uri: Uri): CgProjectParser & { workspace: WorkspaceFolder } | undefined {
        const workspaceFolder = workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            const parser = CgProjectParser._map[workspaceFolder.uri.toString()];
            if (parser && parser.workspace) {
                return parser as CgProjectParser & { workspace: WorkspaceFolder };
            }
        }
    }

    public static onAllEvent(watcher: FileSystemWatcher, listener: (event: string, uri: Uri) => any, thisArgs?: any): void {
        watcher.onDidCreate(e => listener.call(thisArgs, 'create', e));
        watcher.onDidChange(e => listener.call(thisArgs, 'change', e));
        watcher.onDidDelete(e => listener.call(thisArgs, 'delete', e));
    }

    public static setupWatcher(): FileSystemWatcher[] {
        const scriptsWatcher = workspace.createFileSystemWatcher('**' + SCRIPTS_PATH);
        CgProjectParser.onAllEvent(scriptsWatcher, (_, uri: Uri) => {
            const parser = this.getInstanceInWorkspace(uri);
            if (parser && parser._loadScriptsPromise !== undefined && Uri.joinPath(parser.workspace.uri, SCRIPTS_PATH).toString() === uri.toString()) {
                return parser._loadScripts();
            }
        });

        const itemsWatcher = workspace.createFileSystemWatcher('**' + ITEMS_PATH);
        CgProjectParser.onAllEvent(itemsWatcher, (_, uri: Uri) => {
            const parser = this.getInstanceInWorkspace(uri);
            if (parser && parser._loadItemsPromise !== undefined && Uri.joinPath(parser.workspace.uri, ITEMS_PATH).toString() === uri.toString()) {
                return parser._loadItems();
            }
        });

        const srcWatcher = workspace.createFileSystemWatcher('**' + SRC_FOLDER_PATH + '/**/*');
        CgProjectParser.onAllEvent(srcWatcher, (event: string, uri: Uri) => {
            const parser = this.getInstanceInWorkspace(uri);
            if (!parser || !uri.toString().startsWith(Uri.joinPath(parser.workspace.uri, SRC_FOLDER_PATH).toString())) {
                return;
            }

            if (event === 'create' || event === 'delete') {
                parser._updateSource(uri, event.startsWith('d'));
            }

            switch (path.posix.basename(uri.path)) {
                case EVENTS_SCHEMA_FILE_NAME:
                    if (parser._loadEventsSchemaPromise !== undefined) {
                        parser._updateEventsSchemaInMap(uri);
                    }
                    break;
                case DEFAULT_EVENTS_JSON_FILE_NAME:
            }
        });

        return [scriptsWatcher, itemsWatcher, srcWatcher];
    }

    public static parseEvents(input: string): ICgEventsParseResult {
        try {
            input = input.trim();
            if (input.startsWith('{')) {
                return {
                    format: 'json',
                    json: JSON.parse(input)
                };
            }
            try {
                input = atob(input);
            } catch { }
            if (!input.startsWith('{')) {
                input = input.substring(LZ_PREFIX.length);

                const index = Math.floor((input.length - 3) / 2);
                input = input.substring(0, index) + input.substring(index + 3);
                input = LZString.decompressFromBase64(input);
            }
            return {
                format: 'lz',
                json: JSON.parse(input)
            };
        } catch (e) {
            console.error('Error in parse events:', e);
            return {
                format: 'error',
                error: e
            };
        }
    }

    public static serializeEvents(input: ICgEventsParseResult): ICgEventsSerializeResult {
        try {
            switch (input.format) {
                case 'json':
                    return {
                        format: 'json',
                        text: JSON.stringify(input.json, null, '\t')
                    };
                case 'lz':
                    let output = LZString.compressToBase64(JSON.stringify(input.json));
                    const index = Math.floor(output.length / 2);
                    let n = (17 * output.length).toString(36);
                    if (n.length > 3) {
                        n = n.substring(0, 3);
                    } else {
                        for (; n.length < 3;) {
                            n += '0';
                        }
                    }
                    output = output.substring(0, index) + n + output.substring(index);
                    output = btoa(LZ_PREFIX + output);
                    return {
                        format: 'lz',
                        text: output
                    };
            }
            throw Error('Invalid format');
        } catch (e) {
            console.error('Error in serialize events:', e);
            return {
                format: 'error',
                error: e
            };
        }
    }

    protected readonly _labelList: any[] = [];

    protected _cgApp: ICgAppInfo | undefined;
    protected _itemList: ICgItemInfoList | undefined;
    protected _resourceList: string[] = [];
    protected _resourceExcludeTestList: string[] = [];
    protected _sourceList: string[] = [];
    protected _sourceExcludeTestList: string[] = [];
    protected _eventsSchemaMap: Record<string, ICgEventsSchema> = {};
    protected _eventsSchema: ICgEventsSchema = this._createEmptyEventsSchema();

    protected _isSourceListNeedSort: boolean = false;
    protected _isEventsSchemaNeedMerge: boolean = false;

    protected _loadScriptsPromise: Promise<void> | undefined | null;
    protected _loadItemsPromise: Promise<void> | undefined | null;
    protected _loadSourcePromise: Promise<void> | undefined | null;
    protected _updateEventsSchemaPromises: Promise<void>[] = [];
    protected _loadEventsSchemaPromise: Promise<void> | undefined | null;

    protected _disposeTimeout: NodeJS.Timeout | undefined;

    public readonly uriStr: string | undefined;

    constructor(public readonly workspace?: WorkspaceFolder) {
        if (!workspace) {
            if (CgProjectParser._emptyInstance) {
                return CgProjectParser._emptyInstance;
            }
            CgProjectParser._emptyInstance = this;
        } else {
            this.uriStr = workspace.uri.toString();
            if (CgProjectParser._map[this.uriStr]) {
                return CgProjectParser._map[this.uriStr];
            }
            CgProjectParser._map[this.uriStr] = this;
        }
        console.log(`CG project parser create at ${this.uriStr}`);
    }

    public addLabel(label: any) {
        this._labelList.push(label);
        console.log(`CG project parser add label at ${this.uriStr}`);
    }

    public removeLabel(label: any) {
        const index = this._labelList.indexOf(label);
        if (index !== -1) {
            this._labelList.splice(index, 1);
        }
        console.log(`CG project parser remove label at ${this.uriStr}`);
        if (this._labelList.length === 0) {
            if (this._disposeTimeout !== undefined) {
                clearTimeout(this._disposeTimeout);
            }
            this._disposeTimeout = setTimeout(() => {
                if (this._labelList.length === 0) {
                    this.dispose();
                }
            }, DISPOSE_TIMEOUT);
        }
    }

    public dispose() {
        if (CgProjectParser._emptyInstance === this) {
            CgProjectParser._emptyInstance = undefined;
        } else if (this.uriStr !== undefined) {
            delete CgProjectParser._map[this.uriStr];
        }
        console.log(`CG project parser dispose at ${this.uriStr}`);
    }

    protected async _readScripts(uri: Uri): Promise<void> {
        try {
            const text = await fsUtil.readFile(uri);
            if (!text) {
                this._cgApp = undefined;
                return;
            }
            const index = text.lastIndexOf(SCRIPTS_KEY);
            const sIndex = text.indexOf('"', index + SCRIPTS_KEY.length) + 1;
            const eIndex = text.indexOf('"', sIndex + 1);
            if (index === -1 || sIndex === -1 || eIndex === -1) {
                this._cgApp = undefined;
                return;
            }
            this._cgApp = JSON.parse(atob(text.substring(sIndex, eIndex)));
        } catch (e) {
            this._cgApp = undefined;
            console.error(`Error in read scripts at ${this.uriStr}:`, e);
        }
    }

    protected async _loadScripts(): Promise<void> {
        if (!this.workspace) {
            return;
        }
        if (this._loadScriptsPromise) {
            return this._loadScriptsPromise;
        }
        this._loadScriptsPromise = this._readScripts(Uri.joinPath(this.workspace.uri, SCRIPTS_PATH))
            .finally(() => { this._loadScriptsPromise = null; });
        this._resourceList = [];
        console.log(`Loading scripts.js at ${this.uriStr}`);
        return this._loadScriptsPromise;
    }

    public async getCgApp(): Promise<ICgAppInfo | undefined> {
        if (!this._cgApp && this.workspace) {
            await this._loadScripts();
        }
        return this._cgApp;
    }

    protected async _loadingItemsIconAsBase64(): Promise<void> {
        if (!this.workspace || !this._itemList) {
            return;
        }

        const workspaceFolder = this.workspace;
        await Promise.all(this._itemList.list.map(async item => {
            const iconUri = Uri.joinPath(workspaceFolder.uri, item.iconUrl);
            const ext = path.extname(iconUri.fsPath).substring(1);
            const base64 = await fsUtil.readFile(iconUri, 'base64');
            item.iconUrl = `data:image/${ext};base64,${base64}`;
        }));
    };

    protected async _readItems(uri: Uri): Promise<void> {
        try {
            this._itemList = await fsUtil.readJson(uri);
            await this._loadingItemsIconAsBase64();
        } catch (e) {
            this._itemList = undefined;
            console.error(`Error in read items at ${this.uriStr}:`, e);
        }
    }

    protected async _loadItems(): Promise<void> {
        if (!this.workspace) {
            return;
        }
        if (this._loadItemsPromise) {
            return this._loadItemsPromise;
        }
        this._loadItemsPromise = this._readItems(Uri.joinPath(this.workspace.uri, ITEMS_PATH))
            .finally(() => { this._loadItemsPromise = null; });
        console.log(`Loading items.json at ${this.uriStr}`);
        return this._loadItemsPromise;
    }

    public async getItemList(): Promise<ICgItemInfoList | undefined> {
        if (!this._itemList && this.workspace) {
            await this._loadItems();
        }
        return this._itemList;
    }

    protected _updateResourceList(): void {
        if (!this.workspace || !this._cgApp) {
            return;
        }
        const { aliasMap, resourceMap } = this._cgApp.appResourcePack;
        const list: string[] = [];
        const excludeTestList: string[] = [];
        for (const key in aliasMap) {
            const id = aliasMap[key].resourceId;
            const type = resourceMap[id].type;
            if (!ALLOW_PRELOAD_RESOURECE_TYPES.includes(type)) {
                continue;
            }
            list.push(key);
            if (aliasMap[key].mode !== 'TEST') {
                excludeTestList.push(key);
            }
        }
        this._resourceList = list;
        this._resourceExcludeTestList = excludeTestList;
        console.log(`Update resource list at ${this.uriStr}`);
    }

    public async getResourceList(excludeTest = false): Promise<string[]> {
        if (this._resourceList.length === 0) {
            await this.getCgApp();
            this._updateResourceList();
            this._resourceList = this._resourceList.sort(stringUtil.compareCaseAware);
            this._resourceExcludeTestList = this._resourceExcludeTestList.sort(stringUtil.compareCaseAware);
        }
        if (excludeTest) {
            return this._resourceExcludeTestList;
        }
        return this._resourceList;
    }

    protected async _findAllSource(): Promise<void> {
        if (!this.workspace) {
            return;
        }

        const srcUri = Uri.joinPath(this.workspace.uri, SRC_FOLDER_PATH);
        const uris = await workspace.findFiles(
            new RelativePattern(srcUri, '**'),
            `**/*.{${EXCLUDE_PRELOAD_SOURCE_EXTS.join(',')}}`
        );

        this._sourceList = uris.map(uri => path.posix.relative(srcUri.toString(), uri.toString()));
        this._sourceExcludeTestList = this._sourceList.filter(uriStr => !uriStr.startsWith(TEST_FOLDER_NAME));
        this._isSourceListNeedSort = true;
    }

    protected async _loadSource(): Promise<void> {
        if (!this.workspace) {
            return;
        }
        if (this._loadSourcePromise) {
            return this._loadSourcePromise;
        }
        this._loadSourcePromise = this._findAllSource().finally(() => { this._loadSourcePromise = null; });
        console.log(`Loading project source at ${this.uriStr}`);
        return this._loadSourcePromise;
    }

    protected _updateSource(uri: Uri, del = false): void {
        if (!this.workspace) {
            return;
        }

        const srcUri = Uri.joinPath(this.workspace.uri, SRC_FOLDER_PATH);
        const uriStr = path.posix.relative(srcUri.toString(), uri.toString());
        const index = this._sourceList.indexOf(uriStr);
        const indexEx = this._sourceExcludeTestList.indexOf(uriStr);
        if (del) {
            if (index !== -1) {
                this._sourceList.splice(index, 1);
            }
            if (indexEx !== -1) {
                this._sourceExcludeTestList.splice(indexEx, 1);
            }
        } else {
            if (index === -1) {
                this._sourceList.push(uriStr);
                this._isSourceListNeedSort = true;
            }
            if (indexEx === -1 && uriStr.startsWith(TEST_FOLDER_NAME)) {
                this._sourceExcludeTestList.push(uriStr);
                this._isSourceListNeedSort = true;
            }
        }
    }

    public async getSourceList(excludeTest = false): Promise<string[]> {
        if (this._loadSourcePromise === undefined) {
            await this._loadSource();
        }
        if (this._loadSourcePromise) {
            await this._loadSourcePromise;
        }
        if (this._isSourceListNeedSort) {
            this._sourceList.sort();
            this._sourceExcludeTestList.sort();
            this._isSourceListNeedSort = false;
        }
        if (excludeTest) {
            return this._sourceExcludeTestList;
        }
        return this._sourceList;
    }

    protected _createEmptyEventsSchema(): ICgEventsSchema {
        return {
            trigger: {},
            check: {},
            action: {},
            definition: {}
        };
    }

    protected async __updateEventsSchemaInMap(uri: Uri): Promise<void> {
        const schema = await fsUtil.readJson(uri) as ICgEventsSchema | undefined;
        this._isEventsSchemaNeedMerge = true;
        if (typeof schema !== 'object') {
            delete this._eventsSchemaMap[uri.toString()];
            return;
        }
        this._eventsSchemaMap[uri.toString()] = schema;
    }

    protected _updateEventsSchemaInMap(uri: Uri): Promise<void> {
        const promise = this.__updateEventsSchemaInMap(uri).finally(() => {
            const index = this._updateEventsSchemaPromises.indexOf(promise);
            if (index !== -1) {
                this._updateEventsSchemaPromises.splice(index, 1);
            }
        });
        this._updateEventsSchemaPromises.push(promise);
        return promise;
    }

    protected async _checkUpdateEventsSchemaPromisesResolve() {
        while (this._updateEventsSchemaPromises.length) {
            await Promise.all(this._updateEventsSchemaPromises);
        }
    }

    protected async _loadEventsSchema(): Promise<void> {
        if (!this.workspace) {
            return;
        }
        if (this._loadEventsSchemaPromise) {
            return this._loadEventsSchemaPromise;
        }

        const workspaceFolder = this.workspace;
        this._loadEventsSchemaPromise = (async () => {
            const pattern = new RelativePattern(workspaceFolder, '**/' + EVENTS_SCHEMA_FILE_NAME);
            const uris = await workspace.findFiles(pattern);
            if (!uris.length) {
                console.error(`Could not find any events.schema.json files at ${this.uriStr}`);
                return;
            }
            uris.forEach(uri => this._updateEventsSchemaInMap(uri));
            await this._checkUpdateEventsSchemaPromisesResolve();
        })().finally(() => this._loadEventsSchemaPromise = null);

        return this._loadEventsSchemaPromise;
    };

    protected _mergeIntoEventsSchema(target: ICgEventsSchema, source: ICgEventsSchema): void {
        for (const cat of CG_EVENTS_ELEMENT_CATEGORIES) {
            const cat1 = target[cat];
            const cat2 = source?.[cat] ?? {};
            for (const type in cat2) {
                const val1 = cat1[type];
                const val2 = cat2[type];
                if (!val1) {
                    cat1[type] = val2;
                    continue;
                }
                console.info(`Found same ${cat} schema [${type}] at ${this.uriStr}`);
                if (val1.timestamp > val2.timestamp) {
                    continue;
                }
                cat1[type] = val2;
            }
        }
    }

    protected _mergeEventsSchemasInMap(): void {
        this._eventsSchema = this._createEmptyEventsSchema();
        for (const key in this._eventsSchemaMap) {
            this._mergeIntoEventsSchema(this._eventsSchema, this._eventsSchemaMap[key]);
        }
        console.log(`Merge schema in map at ${this.uriStr}`);
    }

    public isEmptyEventsSchema(schema: ICgEventsSchema): boolean {
        for (const cat of CG_EVENTS_ELEMENT_CATEGORIES) {
            for (const _ in schema[cat] ?? {}) {
                return false;
            }
        }
        return true;
    }

    public async getEventsSchema(): Promise<ICgEventsSchema> {
        if (this.isEmptyEventsSchema(this._eventsSchema)) {
            await this._loadEventsSchema();
        }
        await this._checkUpdateEventsSchemaPromisesResolve();
        if (this._isEventsSchemaNeedMerge) {
            this._mergeEventsSchemasInMap();
            this._isEventsSchemaNeedMerge = false;
        }
        return this._eventsSchema;
    }

    protected _filterDefaultEvents(json: ICgEventsDocument, schema: ICgEventsSchema): ICgEventsDocument {
        const configs = json?.config?.configs;
        if (configs) {
            const defTypes = schema.definition;
            for (const defType in configs) {
                if (defTypes?.[defType]?.use !== 'config') {
                    delete configs[defType];
                }
            }
        }
        return json;
    }

    protected async _findAllDefaultEvents(): Promise<ICgEventsDocument[]> {
        if (!this.workspace) {
            return [];
        }
        const pattern = new RelativePattern(this.workspace, '**/' + DEFAULT_EVENTS_JSON_FILE_NAME);
        const uris = await workspace.findFiles(pattern);
        if (!uris.length) {
            return [];
        }

        const [schema, files] = await Promise.all([
            this.getEventsSchema(),
            Promise.all(
                uris.map(uri => Promise.all([fsUtil.readJson(uri), workspace.fs.stat(uri)])
                    .then(file => {
                        if (file[0] && file[1]) {
                            return file;
                        }
                        return undefined;
                    }, () => undefined))
            )
        ]);
        return files
            .filter(file => !!file)
            .sort((a, b) => a[1].mtime - b[1].mtime)
            .map(file => this._filterDefaultEvents(file[0], schema));
    }

    protected _mergeIntoDefaultEvents(target: ICgEventsDocument, source: ICgEventsDocument): void {
        if (!target || !source) {
            return;
        }
        const { config: { stage: sStage, preload: sPreload, configs: sConfigs } = {}, events: sEvents = [] } = source;
        let { config: { stage: tStage, preload: tPreload, configs: tConfigs }, events: tEvents } = target;
        if (sStage) {
            Object.assign(tStage, sStage);
        }
        if (sPreload) {
            if (sPreload.sources) {
                tPreload.sources = Array.from(new Set(tPreload.sources.concat(sPreload.sources)));
            }
            if (sPreload.resourcesExclude) {
                tPreload.resourcesExclude = Array.from(new Set(tPreload.resourcesExclude.concat(sPreload.resourcesExclude)));
            }
        }
        if (sConfigs) {
            if (!tConfigs) {
                tConfigs = target.config.configs = {};
            }
            ObjectUtil.removeKeysWithSameValue(tConfigs, sConfigs);
            ObjectUtil.safeAssign(tConfigs, sConfigs);
        }
        if (sEvents) {
            for (const sEvent of sEvents) {
                if (tEvents.some(tEvent => tEvent.id === sEvent.id)) {
                    continue;
                }
                tEvents.push(sEvent);
            }
        }
    }

    public async getDefaultEvents(): Promise<ICgEventsDocument> {
        const json = ObjectUtil.deepCloneObject(BASE_DEFUALT_EVENTS_JSON) ?? {} as ICgEventsDocument;
        if (this.workspace === undefined) {
            return json;
        }
        const defaultEventsJsons = await this._findAllDefaultEvents();
        for (const defaultEventsJson of defaultEventsJsons) {
            this._mergeIntoDefaultEvents(json, defaultEventsJson);
        }
        return json;
    }

    public isForTest(uri: Uri): boolean | undefined {
        if (!this.workspace) {
            return undefined;
        }
        return uri.toString().startsWith(Uri.joinPath(this.workspace.uri, TEST_FOLDER_PATH).toString());
    }
}

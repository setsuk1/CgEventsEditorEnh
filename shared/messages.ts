import { ICgEventsParseResult, ICgEventsParseSuccess, isCgEventsDocument } from './events';
import { LANG } from './locales/language';
import { ICgAppInfo, ICgItemInfoList, isCgAppInfo, isCgItemInfoList } from './resources';
import { ICgEventsSchema, isCgEventsSchema } from './schema';

export enum IncomingMessageType {
	LANGUAGE_SYNC = 'language_sync',
	EVENTS_SCHEMA_JSON = 'events_schema_json',
	EVENTS_JSON = 'events_json',
	CGAPP = 'cgapp',
	PROJECT_SOURCES = 'project_sources',
	PROJECT_RESOURCES = 'project_resources',
	PROJECT_ITEMS = 'project_items',
	SORTING_PRESETS = 'sorting_presets'
}

export interface IIncomingMessageMap {
	[IncomingMessageType.LANGUAGE_SYNC]: IIncomingMessageLanguageSyncData;
	[IncomingMessageType.EVENTS_SCHEMA_JSON]: ICgEventsSchema;
	[IncomingMessageType.EVENTS_JSON]: ICgEventsParseResult;
	[IncomingMessageType.CGAPP]: ICgAppInfo | undefined;
	[IncomingMessageType.PROJECT_SOURCES]: string[];
	[IncomingMessageType.PROJECT_RESOURCES]: string[];
	[IncomingMessageType.PROJECT_ITEMS]: ICgItemInfoList | undefined;
	[IncomingMessageType.SORTING_PRESETS]: ISortingPreset[];
}

export interface IIncomingMessage<T extends IncomingMessageType = IncomingMessageType> {
	type: T;
	data: IIncomingMessageMap[T];
}

export type IncomingMessage = {
	[T in IncomingMessageType]: IIncomingMessage<T>;
}[IncomingMessageType];

export enum OutgoingMessageType {
	READY = 'ready',
	LANGUAGE_SYNC = 'language_sync',
	SAVE = 'save',
	SORTING_PRESETS_SAVE = 'sorting_presets_save',
	SORTING_PRESETS_DELETE = 'sorting_presets_delete',
	OPEN_VSCODE_SETTINGS = 'open_vscode_settings',
	OPEN_EXTERNAL_URL = 'open_external_url'
}

export interface IOutgoingMessageMap {
	[OutgoingMessageType.READY]: undefined;
	[OutgoingMessageType.LANGUAGE_SYNC]: IOutgoingMessageLanguageSyncData;
	[OutgoingMessageType.SAVE]: ICgEventsParseSuccess;
	[OutgoingMessageType.SORTING_PRESETS_SAVE]: ISortingPreset;
	[OutgoingMessageType.SORTING_PRESETS_DELETE]: string;
	[OutgoingMessageType.OPEN_VSCODE_SETTINGS]: undefined;
	[OutgoingMessageType.OPEN_EXTERNAL_URL]: ExternalUrlCode;
}

export interface IOutgoingMessage<T extends OutgoingMessageType = OutgoingMessageType> {
	type: T;
	data: IOutgoingMessageMap[T];
}

export type OutgoingMessage = {
	[T in OutgoingMessageType]: IOutgoingMessage<T>;
}[OutgoingMessageType];

export const editorLangs = [LANG.EN_US, LANG.ZH_HANT, LANG.ZH_HANS, LANG.JA, LANG.KO] as const;
export type IEditorLanguage = typeof editorLangs[number];
export type IEditorLanguageCode = IEditorLanguage['code'];
export type IEditorLanguageSetting = 'auto' | IEditorLanguageCode;

export type ISyncLanguageOptions = 'auto' | 'ask' | 'none';

export interface IIncomingMessageLanguageSyncData {
	language?: IEditorLanguageSetting;
	languageCode?: IEditorLanguageCode;
	syncLanguage?: ISyncLanguageOptions;
}

export interface IOutgoingMessageLanguageSyncData {
	language?: IEditorLanguageSetting;
	syncLanguage?: ISyncLanguageOptions | 'once';
}

export type ISortingRuleOrder = 'asc' | 'desc';
export type ISortingRuleTarget = 'id' | 'disabled' | 'folder' | 'startTime' | 'checkInterval' | 'repeats' | 'repeatInterval' | 'devOnly' | 'referenceOnly' | 'color' | 'actions' | 'checks' | 'triggers' | 'index';

export interface ISortingRule {
	order: ISortingRuleOrder;
	target: ISortingRuleTarget;
}

export type ISortingPresetsRecord = Record<string, ISortingRule[]>;

export interface ISortingPreset {
	name: string;
	rules: ISortingRule[];
}

export enum ExternalUrlCode {
	OLD_EDITOR_BASIC_TUTORIAL = 'old_editor_basic_tutorial',
	OLD_EDITOR_TUTORIAL_SECTION = 'old_editor_tutorial_section',
	OLD_EDITOR_DISCUSSION = 'old_editor_discussion',
	OLD_EDITOR_SAMPLE_DOWNLOAD = 'old_editor_sample_download',
	ORIGINAL_EDITOR_BASIC_TUTORIAL = 'original_editor_basic_tutorial',
	ORIGINAL_EDITOR_TUTORIAL_SECTION = 'original_editor_tutorial_section',
	ORIGINAL_EDITOR_DISCUSSION = 'original_editor_discussion',
	ORIGINAL_EDITOR_SAMPLE_DOWNLOAD = 'original_editor_sample_download',
	ONLINE_EDITOR = 'online_editor'
}

const editorLanguageCodes = new Set<string>(editorLangs.map((language) => language.code));
const syncLanguageOptions = new Set<string>(['auto', 'ask', 'none']);
const outgoingSyncLanguageOptions = new Set<string>(['auto', 'ask', 'none', 'once']);
const sortingRuleOrders = new Set<string>(['asc', 'desc']);
const sortingRuleTargets = new Set<string>([
	'id', 'disabled', 'folder', 'startTime', 'checkInterval', 'repeats', 'repeatInterval',
	'devOnly', 'referenceOnly', 'color', 'actions', 'checks', 'triggers', 'index'
]);
const externalUrlCodes = new Set<string>(Object.values(ExternalUrlCode));

function isRecord(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isEditorLanguageSetting(value: unknown): value is IEditorLanguageSetting {
	return value === 'auto' || (typeof value === 'string' && editorLanguageCodes.has(value));
}

function isLanguageSyncData(value: unknown, outgoing = false): boolean {
	if (!isRecord(value)) return false;
	if (value.language !== undefined && !isEditorLanguageSetting(value.language)) return false;
	if (value.languageCode !== undefined && (typeof value.languageCode !== 'string' || !editorLanguageCodes.has(value.languageCode))) return false;
	if (value.syncLanguage !== undefined) {
		if (typeof value.syncLanguage !== 'string') return false;
		if (!(outgoing ? outgoingSyncLanguageOptions : syncLanguageOptions).has(value.syncLanguage)) return false;
	}
	return true;
}

function hasValidDocumentVersion(value: Record<string, any>): boolean {
	return value.documentVersion === undefined ||
		(typeof value.documentVersion === 'number' && Number.isInteger(value.documentVersion) && value.documentVersion >= 0);
}

function isEventsParseResult(value: unknown): value is ICgEventsParseResult {
	if (!isRecord(value)) return false;
	if (value.format === 'error') return 'error' in value && hasValidDocumentVersion(value);
	return isEventsParseSuccess(value);
}

function isEventsParseSuccess(value: unknown): value is ICgEventsParseSuccess {
	return isRecord(value) && (value.format === 'json' || value.format === 'lz') &&
		hasValidDocumentVersion(value) && isCgEventsDocument(value.json);
}

function isSortingRule(value: unknown): value is ISortingRule {
	return isRecord(value) && typeof value.order === 'string' && sortingRuleOrders.has(value.order) &&
		typeof value.target === 'string' && sortingRuleTargets.has(value.target);
}

function isSafeSortingPresetName(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim() && value !== '__proto__';
}

export function isSortingPreset(value: unknown): value is ISortingPreset {
	return isRecord(value) && isSafeSortingPresetName(value.name) && Array.isArray(value.rules) && value.rules.every(isSortingRule);
}

export function isIncomingMessage(value: unknown): value is IncomingMessage {
	if (!isRecord(value)) return false;
	switch (value.type) {
		case IncomingMessageType.LANGUAGE_SYNC:
			return isLanguageSyncData(value.data);
		case IncomingMessageType.EVENTS_SCHEMA_JSON:
			return isCgEventsSchema(value.data);
		case IncomingMessageType.EVENTS_JSON:
			return isEventsParseResult(value.data);
		case IncomingMessageType.CGAPP:
			return value.data === undefined || isCgAppInfo(value.data);
		case IncomingMessageType.PROJECT_SOURCES:
		case IncomingMessageType.PROJECT_RESOURCES:
			return isStringArray(value.data);
		case IncomingMessageType.PROJECT_ITEMS:
			return value.data === undefined || isCgItemInfoList(value.data);
		case IncomingMessageType.SORTING_PRESETS:
			return Array.isArray(value.data) && value.data.every(isSortingPreset);
		default:
			return false;
	}
}

export function isOutgoingMessage(value: unknown): value is OutgoingMessage {
	if (!isRecord(value)) return false;
	switch (value.type) {
		case OutgoingMessageType.READY:
		case OutgoingMessageType.OPEN_VSCODE_SETTINGS:
			return value.data === undefined;
		case OutgoingMessageType.LANGUAGE_SYNC:
			return isRecord(value.data) && isLanguageSyncData(value.data, true) && !('languageCode' in value.data);
		case OutgoingMessageType.SAVE:
			return isEventsParseSuccess(value.data);
		case OutgoingMessageType.SORTING_PRESETS_SAVE:
			return isSortingPreset(value.data);
		case OutgoingMessageType.SORTING_PRESETS_DELETE:
			return isSafeSortingPresetName(value.data);
		case OutgoingMessageType.OPEN_EXTERNAL_URL:
			return typeof value.data === 'string' && externalUrlCodes.has(value.data);
		default:
			return false;
	}
}

import { ICgEventsParseResult, ICgEventsParseSuccess } from './events';
import { LANG } from './locales/language';
import { ICgAppInfo, ICgItemInfoList } from './resources';
import { ICgEventsSchema } from './schema';

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

import { ICgAppInfo, ICgEvent, ICgEventsSchema, ICgItemInfoList, LANG, translateSchema } from '@shared';
import { Key } from '../../../shared/keyboard/Key';
import { getOwnPropertyValue } from '../../utils/ownPath';
import { createSafeRecord } from './safeRecord';

const DYNAMIC_QUERY_RE = /^(\w+)<([^>]*)>$/;
const SUPPORTED_DYNAMIC_SCOPES = new Set(['actions', 'checks', 'triggers', 'events', 'resources', 'sources', 'server', 'locale', 'keyboard']);

interface DynamicSuggestionQuery {
	scope: string;
	args: string[];
}

function parseDynamicQuery(query: string): DynamicSuggestionQuery | null {
	const match = DYNAMIC_QUERY_RE.exec(query);
	if (!match) {
		return null;
	}
	const [, scope, rawArgs] = match;
	const args = rawArgs
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return { scope, args };
}

function parseSupportedDynamicQuery(value: unknown): DynamicSuggestionQuery | null {
	if (typeof value !== 'string') return null;
	const parsed = parseDynamicQuery(value);
	return parsed && SUPPORTED_DYNAMIC_SCOPES.has(parsed.scope) ? parsed : null;
}

export function normalizeSuggestionTitles(value: unknown): Record<string, string[]> {
	const result = createSafeRecord<string[]>();
	if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
	for (const [key, entry] of Object.entries(value)) {
		if (Array.isArray(entry) && entry.every((item) => typeof item === 'string')) {
			result[key] = entry;
		}
	}
	return result;
}

function resolveSuggestionTitles(value: unknown): string[] {
	const titlesByLang = normalizeSuggestionTitles(value);
	if (Object.keys(titlesByLang).length === 0) return [];
	const translated = translateSchema(titlesByLang);
	return Array.isArray(translated) ? translated : [];
}

function addSuggestionValue(values: Set<string>, raw: unknown): void {
	if (raw === undefined || raw === null) return;
	if (Array.isArray(raw)) {
		raw.forEach((value) => addSuggestionValue(values, value));
		return;
	}
	if (typeof raw === 'object') return;
	values.add(String(raw));
}

function joinResourcePath(resourceName: string, filename: string): string {
	const base = String(resourceName ?? '').replace(/\\/g, '/').replace(/\/+$/g, '');
	const file = String(filename ?? '').replace(/\\/g, '/').replace(/^\.?\//g, '').replace(/\/+$/g, '');
	if (!base) return file;
	if (!file) return base;
	if (file.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return file;
	return `${base}/${file}`.replace(/\/{2,}/g, '/');
}

function resolveLocaleSuggestions(args: string[]): Array<{ value: string; label: string }> {
	const wantsAll = args.length === 0 || args.some((arg) => arg.trim() === '*');
	const wantedCodes = new Set(args.map((arg) => arg.trim().toLowerCase()).filter(Boolean));
	const byCode = new Map<string, string>();

	Object.values(LANG).forEach((entry) => {
		if (!entry || typeof entry !== 'object') return;
		const code = typeof entry.code === 'string' ? entry.code : '';
		if (!code || (!wantsAll && !wantedCodes.has(code.toLowerCase()))) return;
		const nativeName = typeof entry.nativeName === 'string' && entry.nativeName.trim() ? entry.nativeName : code;
		if (!byCode.has(code)) byCode.set(code, nativeName);
	});

	return Array.from(byCode.entries())
		.map(([value, label]) => ({ value, label }))
		.sort((a, b) => a.value.localeCompare(b.value));
}

function resolveKeyboardSuggestions(args: string[]): Array<{ value: string; label: string }> {
	const wantsAll = args.length === 0 || args.some((arg) => arg.trim() === '*');
	const wantedKeys = wantsAll ? undefined : new Set(args.map((arg) => arg.trim().toUpperCase()).filter(Boolean));
	const suggestions: Array<{ value: string; label: string }> = [];
	const seenValues = new Set<string>();

	for (const [rawName, rawCode] of Object.entries(Key)) {
		const name = String(rawName ?? '').trim();
		if (!name || (wantedKeys && !wantedKeys.has(name.toUpperCase()))) continue;
		const value = String(rawCode ?? '').trim();
		if (!value || seenValues.has(value)) continue;
		seenValues.add(value);
		suggestions.push({ value, label: name.startsWith('_') ? name.slice(1) : name });
	}

	suggestions.sort((a, b) => a.label.localeCompare(b.label));
	return suggestions;
}

function resolveDynamicQuery(
	query: DynamicSuggestionQuery,
	events: ICgEvent[] | undefined,
	items: ICgItemInfoList | undefined,
	cgapp: ICgAppInfo | undefined,
	resources: string[] | undefined,
	sources: string[] | undefined
): string[] {
	const { scope, args } = query;
	const values = new Set<string>();
	const eventList = Array.isArray(events) ? events : [];

	if (eventList.length > 0 && (scope === 'actions' || scope === 'checks' || scope === 'triggers')) {
		if (args.length === 0) return [];
		for (const event of eventList) {
			const blocks = event[scope];
			if (!Array.isArray(blocks)) continue;
			for (const block of blocks) {
				if (!block.data || typeof block.data !== 'object' || Array.isArray(block.data)) continue;
				for (const key of args) addSuggestionValue(values, getOwnPropertyValue(block.data, key));
			}
		}
	} else if (eventList.length > 0 && scope === 'events') {
		if (args.length === 0) return [];
		for (const event of eventList) {
			for (const key of args) addSuggestionValue(values, getOwnPropertyValue(event, key));
		}
	} else if (scope === 'server') {
		if (args.some((key) => key.toLowerCase() === 'itemcode') && items?.list) {
			for (const item of items.list) addSuggestionValue(values, item.code);
		}
	} else if (scope === 'resources') {
		if (!resources) return [];
		const wantsAll = args.length === 0 || args.some((key) => key.toLowerCase() === 'key');
		if (wantsAll || !cgapp?.appResourcePack) {
			resources.forEach((resource) => values.add(resource));
		} else {
			const allowedTypes = new Set(args.map((type) => type.toLowerCase()));
			const { aliasMap, resourceMap } = cgapp.appResourcePack;
			for (const alias of resources) {
				const resourceId = aliasMap[alias]?.resourceId;
				const resource = resourceId === undefined ? undefined : resourceMap[resourceId];
				const type = resource?.type?.toLowerCase();
				if (type === 'soundpack' && allowedTypes.has('sound')) {
					const sounds = resource.meta?.sounds;
					if (Array.isArray(sounds)) {
						for (const entry of sounds) {
							if (typeof entry === 'string') {
								values.add(joinResourcePath(alias, entry));
							} else if (entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.filename === 'string') {
								values.add(joinResourcePath(alias, entry.filename));
							}
						}
					}
					continue;
				}
				if (type && allowedTypes.has(type)) values.add(alias);
			}
		}
	} else if (scope === 'sources') {
		if (!sources) return [];
		const wantsAll = args.length === 0 || args.some((key) => key.toLowerCase() === 'key');
		if (wantsAll) {
			sources.forEach((source) => values.add(source));
		} else {
			const exts = args
				.map((type) => type.trim().toLowerCase())
				.filter(Boolean)
				.map((type) => type.startsWith('.') ? type.slice(1) : type);
			for (const source of sources) {
				const lower = source.toLowerCase();
				if (exts.some((ext) => lower.endsWith(`.${ext}`))) values.add(source);
			}
		}
	}

	const result = Array.from(values);
	if (scope !== 'resources' && scope !== 'sources') result.sort();
	return result;
}

export function resolveSuggestions(
	suggest: any[] | undefined,
	suggestTitles: Record<string, unknown> | undefined,
	schema: ICgEventsSchema | undefined,
	events: ICgEvent[] | undefined,
	items: ICgItemInfoList | undefined,
	cgapp: ICgAppInfo | undefined,
	resources: string[] | undefined,
	sources: string[] | undefined
): Array<{ value: string; label: string }> {
	void schema;
	if (!suggest?.length) return [];

	const titles = resolveSuggestionTitles(suggestTitles);

	const parsedDynamicQueries = suggest.map((entry) => parseSupportedDynamicQuery(entry));
	const staticCount = parsedDynamicQueries.reduce(
		(count, parsed) => count + (parsed ? 0 : 1),
		0,
	);
	const titlesUseIndex = titles.length >= suggest.length || titles.length > staticCount;
	const staticSuggestions: Array<{ value: string; label: string }> = [];
	const dynamicQueries: DynamicSuggestionQuery[] = [];
	let staticTitleIndex = 0;

	suggest.forEach((entry, index) => {
		const parsed = parsedDynamicQueries[index];
		if (parsed) {
			dynamicQueries.push(parsed);
			return;
		}
		const value = String(entry);
		const label = titlesUseIndex ? (titles[index] ?? value) : (titles[staticTitleIndex] ?? value);
		staticTitleIndex += 1;
		staticSuggestions.push({ value, label });
	});

	if (dynamicQueries.length === 0) return staticSuggestions;

	const existing = new Set(staticSuggestions.map((suggestion) => suggestion.value));
	const dynamicSuggestions: Array<{ value: string; label: string }> = [];
	const dynamicSeen = new Set<string>();
	const pushUnique = (value: string, label = value) => {
		if (!value || existing.has(value) || dynamicSeen.has(value)) return;
		dynamicSeen.add(value);
		dynamicSuggestions.push({ value, label });
	};

	for (const parsed of dynamicQueries) {
		if (parsed.scope === 'locale') {
			resolveLocaleSuggestions(parsed.args).forEach((suggestion) => pushUnique(suggestion.value, suggestion.label));
			continue;
		}
		if (parsed.scope === 'server') {
			if (parsed.args.some((key) => key.toLowerCase() === 'itemcode') && items?.list) {
				for (const item of items.list) {
					const value = String(item?.code ?? '');
					const label = typeof item?.name === 'string' && item.name.trim() ? item.name : value;
					pushUnique(value, label);
				}
			}
			continue;
		}
		if (parsed.scope === 'keyboard') {
			resolveKeyboardSuggestions(parsed.args).forEach((suggestion) => pushUnique(suggestion.value, suggestion.label));
			continue;
		}
		resolveDynamicQuery(parsed, events, items, cgapp, resources, sources).forEach((value) => pushUnique(value));
	}

	dynamicSuggestions.sort((a, b) => a.value.localeCompare(b.value));
	return staticSuggestions.concat(dynamicSuggestions);
}

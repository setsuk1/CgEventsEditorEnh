import { ICgAppInfo, ICgEvent, ICgEventsSchema, ICgItemInfoList, LANG, translateSchema } from '@shared';
import { Key } from '../../../shared/keyboard/Key';

function parseDynamicQuery(query: string): { scope: string; args: string[] } | null {
	const match = query.match(/^(\w+)<([^>]*)>$/);
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

function addSuggestionValue(values: Set<string>, raw: unknown): void {
	if (raw === undefined || raw === null) { return; }
	if (Array.isArray(raw)) {
		raw.forEach((v) => addSuggestionValue(values, v));
		return;
	}
	if (typeof raw === 'object') { return; }
	values.add(String(raw));
}

function joinResourcePath(resourceName: string, filename: string): string {
	const base = String(resourceName ?? '')
		.replace(/\\/g, '/')
		.replace(/\/+$/g, '');
	const file = String(filename ?? '')
		.replace(/\\/g, '/')
		.replace(/^\.?\//g, '')
		.replace(/\/+$/g, '');

	if (!base) { return file; }
	if (!file) { return base; }
	if (file.toLowerCase().startsWith(`${base.toLowerCase()}/`)) { return file; }
	return `${base}/${file}`.replace(/\/{2,}/g, '/');
}

function resolveLocaleSuggestions(args: string[]): Array<{ value: string; label: string }> {
	const wantsAll = args.length === 0 || args.some((a) => a.trim() === '*');
	const wantedCodes = new Set(args.map((a) => a.trim().toLowerCase()).filter(Boolean));
	const byCode = new Map<string, string>();

	Object.values(LANG).forEach((entry) => {
		if (!entry || typeof entry !== 'object') {return;}
		const code = typeof entry.code === 'string' ? entry.code : '';
		if (!code) {return;}
		if (!wantsAll && !wantedCodes.has(code.toLowerCase())) {return;}
		const nativeName = typeof entry.nativeName === 'string' && entry.nativeName.trim() ? entry.nativeName : code;
		if (!byCode.has(code)) {
			byCode.set(code, nativeName);
		}
	});

	return Array.from(byCode.entries())
		.map(([value, label]) => ({ value, label }))
		.sort((a, b) => a.value.localeCompare(b.value));
}

function resolveKeyboardSuggestions(args: string[]): Array<{ value: string; label: string }> {
	const wantsAll = args.length === 0 || args.some((a) => a.trim() === '*');
	const wantedKeys = wantsAll
		? undefined
		: new Set(args.map((a) => a.trim().toUpperCase()).filter(Boolean));

	const suggestions: Array<{ value: string; label: string }> = [];
	const seenValues = new Set<string>();

	for (const [rawName, rawCode] of Object.entries(Key)) {
		const name = String(rawName ?? '').trim();
		if (!name) {
			continue;
		}
		if (wantedKeys && !wantedKeys.has(name.toUpperCase())) {
			continue;
		}

		const value = String(rawCode ?? '').trim();
		if (!value || seenValues.has(value)) {
			continue;
		}
		seenValues.add(value);

		const label = name.startsWith('_') ? name.slice(1) : name;
		suggestions.push({ value, label });
	}

	suggestions.sort((a, b) => a.label.localeCompare(b.label));
	return suggestions;
}

/**
 * Resolves a dynamic suggestion query by finding all unique values for a given key
 * within the specified scope (e.g., all 'actions') in the current event document.
 * @param query The suggestion query string, e.g., 'actions<actorCode>'.
 * @param document The entire event document currently being edited.
 * @param items The server items list.
 * @param cgapp The server app info (includes resources types).
 * @param resources A list of all available resource names.
 * @param sources A list of all available source names.
 * @returns An array of unique string values.
 */
function resolveDynamicQuery(
	query: string,
	events: ICgEvent[] | undefined,
	items: ICgItemInfoList | undefined,
	cgapp: ICgAppInfo | undefined,
	resources: string[] | undefined,
	sources: string[] | undefined
): string[] {
	const parsed = parseDynamicQuery(query);
	if (!parsed) {
		return [];
	}

	const { scope, args } = parsed;
	const values = new Set<string>();
	const eventList = Array.isArray(events) ? events : [];

	if (eventList.length > 0 && (scope === 'actions' || scope === 'checks' || scope === 'triggers')) {
		if (args.length === 0) {
			return [];
		}
		eventList.forEach((event) => {
			const blocks = event[scope];
			if (blocks && Array.isArray(blocks)) {
				blocks.forEach((block) => {
					if (block.data && typeof block.data === 'object' && !Array.isArray(block.data)) {
						args.forEach((key) => addSuggestionValue(values, block.data[key]));
					}
				});
			}
		});
	} else if (eventList.length > 0 && scope === 'events') {
		if (args.length === 0) {
			return [];
		}
		eventList.forEach((event) => {
			args.forEach((key) => addSuggestionValue(values, event[key]));
		});
	} else if (scope === 'server') {
		const wantsItemCode = args.some((k) => k.toLowerCase() === 'itemcode');
		if (wantsItemCode && items?.list) {
			items.list.forEach((item) => addSuggestionValue(values, item.code));
		}
	} else if (scope === 'resources') {
		if (!resources) {
			return [];
		}

		const wantsAll = args.length === 0 || args.some((k) => k.toLowerCase() === 'key');
		if (wantsAll || !cgapp?.appResourcePack) {
			resources.forEach((r) => values.add(r));
		} else {
			const allowedTypes = new Set(args.map((t) => t.toLowerCase()));
			const { aliasMap, resourceMap } = cgapp.appResourcePack;
			resources.forEach((alias) => {
				const id = aliasMap?.[alias]?.resourceId;
				const type = resourceMap?.[id]?.type;
				if (type.toLowerCase() === 'soundpack' && allowedTypes.has('sound')) {
					const sounds = resourceMap?.[id]?.meta?.sounds;
					if (Array.isArray(sounds)) {
						sounds.forEach((entry) => {
							if (typeof entry === 'string') {
								values.add(joinResourcePath(alias, entry));
								return;
							}
							if (entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.filename === 'string') {
								values.add(joinResourcePath(alias, entry.filename));
							}
						});
					}
					return;
				}

				if (!type || !allowedTypes.has(type.toLowerCase())) {
					return;
				}

				values.add(alias);
			});
		}
	} else if (scope === 'sources') {
		if (!sources) {
			return [];
		}

		const wantsAll = args.length === 0 || args.some((k) => k.toLowerCase() === 'key');
		if (wantsAll) {
			sources.forEach((s) => values.add(s));
		} else {
			const exts = args
				.map((t) => t.trim().toLowerCase())
				.filter(Boolean)
				.map((t) => (t.startsWith('.') ? t.slice(1) : t));
			sources.forEach((s) => {
				const lower = s.toLowerCase();
				if (exts.some((ext) => lower.endsWith(`.${ext}`))) {
					values.add(s);
				}
			});
		}
	}

	let result = Array.from(values);

	// Only sort if the scope is not resources or sources
	if (scope !== 'resources' && scope !== 'sources') {
		result.sort();
	}

	return result;
}

/**
 * Resolves static or dynamic suggestions into a unified format.
 * @param suggest The `suggest` array from the schema property.
 * @param suggestTitles The `suggestTitles` object from the schema property.
 * @param schema The cgenh-full events schema.
 * @param events The events list, required for data-dependent dynamic queries.
 * @param items The server items list.
 * @param cgapp The server app info (includes resources types).
 * @param resources A list of all available resource names.
 * @param sources A list of all available source names.
 * @returns An array of suggestion objects with `value` and `label`.
 */
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
	if (!suggest || suggest.length === 0) {
		return [];
	}

	let titles: string[] = [];
	if (suggestTitles && typeof suggestTitles === 'object' && !Array.isArray(suggestTitles)) {
		const titlesByLang: Record<string, string[]> = {};
		for (const [key, value] of Object.entries(suggestTitles)) {
			if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
				titlesByLang[key] = value;
			}
		}
		if (Object.keys(titlesByLang).length > 0) {
			const rawTitles = translateSchema(titlesByLang);
			if (Array.isArray(rawTitles)) {
				titles = rawTitles;
			}
		}
	}
	const supportedDynamicScopes = new Set(['actions', 'checks', 'triggers', 'events', 'resources', 'sources', 'server', 'locale', 'keyboard']);

	const staticCount = suggest.reduce((count, entry) => {
		if (typeof entry !== 'string') { return count + 1; }
		const parsed = parseDynamicQuery(entry);
		if (parsed && supportedDynamicScopes.has(parsed.scope)) {
			return count;
		}
		return count + 1;
	}, 0);

	const titlesUseIndex = titles.length >= suggest.length || titles.length > staticCount;

	const staticSuggestions: Array<{ value: string; label: string }> = [];
	const dynamicQueries: string[] = [];
	let staticTitleIndex = 0;

	suggest.forEach((entry, index) => {
		if (typeof entry === 'string') {
			const parsed = parseDynamicQuery(entry);
			if (parsed && supportedDynamicScopes.has(parsed.scope)) {
				dynamicQueries.push(entry);
				return;
			}
		}

		const strValue = String(entry);
		const label = titlesUseIndex ? (titles[index] ?? strValue) : (titles[staticTitleIndex] ?? strValue);
		staticTitleIndex += 1;
		staticSuggestions.push({ value: strValue, label });
	});

	if (dynamicQueries.length === 0) {
		return staticSuggestions;
	}

	const existing = new Set(staticSuggestions.map((s) => s.value));
	const dynamicSuggestions: Array<{ value: string; label: string }> = [];
	const dynamicSeen = new Set<string>();
	dynamicQueries.forEach((query) => {
		const parsed = parseDynamicQuery(query);
		if (parsed?.scope === 'locale') {
			resolveLocaleSuggestions(parsed.args).forEach((s) => {
				if (existing.has(s.value) || dynamicSeen.has(s.value)) {return;}
				dynamicSeen.add(s.value);
				dynamicSuggestions.push(s);
			});
			return;
		}

		if (parsed?.scope === 'server') {
			const wantsItemCode = parsed.args.some((k) => k.toLowerCase() === 'itemcode');
			if (wantsItemCode && items?.list) {
				items.list.forEach((item) => {
					const value = String(item?.code ?? '');
					if (!value) {return;}
					if (existing.has(value) || dynamicSeen.has(value)) {return;}
					dynamicSeen.add(value);
					const label = typeof item?.name === 'string' ? item.name : '';
					dynamicSuggestions.push({ value, label });
				});
			}
			return;
		}

		if (parsed?.scope === 'keyboard') {
			resolveKeyboardSuggestions(parsed.args).forEach((s) => {
				if (existing.has(s.value) || dynamicSeen.has(s.value)) {return;}
				dynamicSeen.add(s.value);
				dynamicSuggestions.push(s);
			});
			return;
		}

		const results = resolveDynamicQuery(query, events, items, cgapp, resources, sources);
		results.forEach((r) => {
			if (existing.has(r) || dynamicSeen.has(r)) {return;}
			dynamicSeen.add(r);
			dynamicSuggestions.push({ value: r, label: r });
		});
	});

	dynamicSuggestions.sort((a, b) => a.value.localeCompare(b.value));
	return staticSuggestions.concat(dynamicSuggestions);
}

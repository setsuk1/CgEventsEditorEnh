/**
 * Modified from https://code.gamelet.com/view/Base/1.11.17
 */

import { LANG, Language } from '../locales/language';

let translationMap: { [key: string]: Translation } = Object.create(null);
let paramOpen: string = '{{';
let paramClose: string = '}}';
let selectedTranslation: Translation;
let fallbackTranslation: Translation;

export class Translation {

	private items: { [key: string]: string } = Object.create(null);

	constructor(private _lang: Language) {

	}

	get language(): Language {
		return this._lang;
	}

	addItem(key: string, value: string): Translation {
		this.items[key] = value;
		return this;
	}

	getItem(key: string): string {
		return this.items[key];
	}

	trans(key: string, params?: { [key: string]: any }): string {
		let item = this.getItem(key);
		if (item !== undefined) {
			if (params) {
				item = replaceStringWithParams(item, params);
			}
		} else {
			item = key;
		}
		return item;
	}

	importJson(json: any, prefix: string = ''): void {
		if (!json || typeof json !== 'object') return;
		for (const key of Object.keys(json)) {
			const value = json[key];
			if (typeof value === 'string') {
				this.addItem(prefix + key, value);
			} else if (value && typeof value === 'object') {
				this.importJson(value, prefix + key + '.');
			}
		}
	}
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceStringWithParams(str: string, params: { [key: string]: any }, prefix: string = ''): string {
	for (const search of Object.keys(params)) {
		const value = params[search];
		if (value === null) {
			continue;
		}
		if (typeof value === 'object') {
			str = replaceStringWithParams(str, value, prefix + search + '.');
		} else {
			const pattern = escapeRegExp(paramOpen) + "\\s*" + escapeRegExp(prefix + search) + "\\s*" + escapeRegExp(paramClose);
			str = str.replace(new RegExp(pattern, "g"), () => String(value));
		}
	}
	return str;
}


const languageListeners: Array<(lang: Language) => any> = [];

export function onLanguageChange(listener: (lang: Language) => any) {
	if (languageListeners.indexOf(listener) !== -1) {
		return false;
	}
	languageListeners.push(listener);
	return true;
}
export function offLanguageChange(listener: (lang: Language) => any) {
	const index = languageListeners.indexOf(listener);
	if (index === -1) {
		return false;
	}
	languageListeners.splice(index, 1);
	return true;
}

export function getTranslation(lang: Language): Translation {
	let translation = translationMap[lang.code];
	if (!translation) {
		translation = new Translation(lang);
		translationMap[lang.code] = translation;
	}
	return translation;
}

export function setLanguage(lang: Language, fallback?: Language): Translation {
	selectedTranslation = getTranslation(lang);
	if (fallback) {
		fallbackTranslation = getTranslation(fallback);
	}
	for (const listener of [...languageListeners]) {
		listener(selectedTranslation.language);
	}
	return selectedTranslation;
}

export function getSelectedLanguage(): Language {
	return selectedTranslation.language;
}

export function setTranslateParamWrapper(open: string = '{{', close: string = '}}'): void {
	paramOpen = open;
	paramClose = close;
}

export function translate(key: string, params?: { [key: string]: any }): string {
	let item = selectedTranslation.getItem(key);
	if (item === undefined && selectedTranslation.language.fallbacks) {
		for (let lang of selectedTranslation.language.fallbacks) {
			let fallback = translationMap[lang.code];
			item = fallback && fallback.getItem(key);
			if (item !== undefined) {
				break;
			}
		}
	}
	if (item !== undefined) {
		if (params) {
			item = replaceStringWithParams(item, params);
		}
		return item;
	}

	if (fallbackTranslation) {
		return fallbackTranslation.trans(key, params);
	}
	return key;
}

export function translateSchema<T extends string | string[] = string>(schema: Record<string, T> | null | undefined): T | undefined {
	if (!schema) {
		return undefined;
	}
	const lang = selectedTranslation.language;
	let trans = schema[lang.code];
	if (trans === undefined && lang.fallbacks) {
		for (const fb of lang.fallbacks) {
			trans = schema[fb.code];
			if (trans !== undefined) {
				return trans;
			}
		}
	}
	if (trans === undefined) {
		if (fallbackTranslation) {
			trans = schema[fallbackTranslation.language.code];
			if (trans !== undefined) {
				return trans;
			}
		}
		return schema.en;
	}
	return trans;
}

setLanguage(LANG.EN, LANG.EN);

export type ILanguageJson<T extends object = object> = {
	[P in keyof T]: T[P] extends object ? ILanguageJson<T[P]> : string;
}

export interface TranslationPath<T extends string, K extends string> {
	getPrefix(): T;
	getName(): K;
	getFullName(): `${T}${K}`;
	toString(): `${T}${K}`;
}

export interface TranslationItem<T extends string, K extends string> {
	getPrefix(): T;
	getName(): K;
	getFullName(): `${T}${K}`;
	getTrans(params?: Record<string, any>): string;
	toString(params?: Record<string, any>): string;
}

export type ITranslationStructureValue<T extends object, P extends keyof T, K extends string> = P extends string ? T[P] extends object ? ITranslationStructure<T[P], `${K}${P}.`> & TranslationPath<K, P> : TranslationItem<K, P> : never;

export type ITranslationStructure<T extends object, K extends string> = {
	[P in keyof T]: ITranslationStructureValue<T, P, K>;
};

export function generateTranslation<T extends object, K extends string>(json: T, prefix: K = '' as K): ITranslationStructure<T, K> {
	const result = Object.create(null) as ITranslationStructure<T, K>;

	for (const key of Object.keys(json) as Array<keyof T & string>) {
		const value = json[key];
		const obj = Object.create(null) as ITranslationStructureValue<T, typeof key, K>;
		const props = {
			getPrefix() {
				return prefix;
			},
			getName() {
				return key;
			},
			getFullName() {
				return `${prefix}${key}`;
			},
			toString() {
				return this.getFullName();
			}
		};

		if (value && typeof value === 'object') {
			Object.assign(obj, generateTranslation(value, `${prefix}${key}.`), props);
		} else {
			Object.assign(obj, props, {
				getTrans(params?: Record<string, any>) {
					return translate(this.getFullName(), params);
				},
				toString(params?: Record<string, any>) {
					return this.getTrans(params);
				}
			} as TranslationItem<`${K}${typeof key}`, K>);
		}

		result[key] = obj;
	}

	return result;
}

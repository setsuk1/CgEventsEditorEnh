import assert from 'node:assert/strict';
import test from 'node:test';
import { extractCgCfgPayload, parseCgAppFromScriptsText } from '../src/utils/cgAppScripts';

function encode(value: unknown): string {
	return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function validApp(projectName: string) {
	return {
		projectCode: 'demo',
		projectName,
		appResourcePack: {
			aliasMap: {},
			resourceMap: {},
		},
	};
}

test('CgCfg extraction returns the last embedded payload', () => {
	const first = encode(validApp('first'));
	const second = encode(validApp('second'));
	const text = `window.a = {"CgCfg":"${first}"}; window.b = {"CgCfg" : "${second}"};`;

	assert.equal(extractCgCfgPayload(text), second);
	assert.equal(parseCgAppFromScriptsText(text)?.projectName, 'second');
});

test('CgCfg parser decodes UTF-8 metadata without mojibake', () => {
	const app = validApp('繁體中文專案');
	const text = `window.config = {"CgCfg":"${encode(app)}"};`;

	assert.equal(parseCgAppFromScriptsText(text)?.projectName, '繁體中文專案');
});

test('CgCfg parser returns undefined for missing or invalid app metadata', () => {
	assert.equal(parseCgAppFromScriptsText('window.config = {};'), undefined);
	assert.equal(
		parseCgAppFromScriptsText(`window.config = {"CgCfg":"${encode({ appResourcePack: { aliasMap: { bad: {} }, resourceMap: {} } })}"};`),
		undefined,
	);
});

test('CgCfg extraction rejects incomplete quoted payloads', () => {
	assert.equal(extractCgCfgPayload('window.config = {"CgCfg": value};'), undefined);
	assert.equal(extractCgCfgPayload('window.config = {"CgCfg":"unterminated};'), undefined);
});

test('CgCfg parser preserves malformed-payload exceptions for the caller to handle', () => {
	const malformed = Buffer.from('{bad json', 'utf8').toString('base64');
	assert.throws(() => parseCgAppFromScriptsText(`{"CgCfg":"${malformed}"}`));
});

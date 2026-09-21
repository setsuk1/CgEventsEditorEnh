import { ICgAppInfo, isCgAppInfo } from '@shared';

const CG_CFG_KEY = '"CgCfg"';

export function extractCgCfgPayload(text: string | undefined): string | undefined {
	if (!text) {
		return undefined;
	}

	const keyIndex = text.lastIndexOf(CG_CFG_KEY);
	if (keyIndex === -1) {
		return undefined;
	}

	const quoteIndex = text.indexOf('"', keyIndex + CG_CFG_KEY.length);
	if (quoteIndex === -1) {
		return undefined;
	}

	const startIndex = quoteIndex + 1;
	const endIndex = text.indexOf('"', startIndex);
	if (endIndex === -1) {
		return undefined;
	}

	return text.slice(startIndex, endIndex);
}

export function parseCgAppFromScriptsText(text: string | undefined): ICgAppInfo | undefined {
	const payload = extractCgCfgPayload(text);
	if (payload === undefined) {
		return undefined;
	}

	const jsonText = Buffer.from(payload, 'base64').toString('utf8');
	const parsed = JSON.parse(jsonText);
	return isCgAppInfo(parsed) ? parsed : undefined;
}

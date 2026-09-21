import { ICgEventsParseResult, ICgEventsSerializeResult } from '../../shared';
import LZString from 'lz-string';

const LZ_PREFIX = '/*lz*/';

export function parseEventsText(input: string): ICgEventsParseResult {
	try {
		input = input.trim();
		if (input.startsWith('{')) {
			return { format: 'json', json: JSON.parse(input) };
		}

		let decoded = input;
		try {
			decoded = atob(input);
		} catch { }

		if (decoded.startsWith('{')) {
			return { format: 'lz', json: JSON.parse(decoded) };
		}
		if (!decoded.startsWith(LZ_PREFIX)) {
			throw new Error('Unsupported events format');
		}

		let compressed = decoded.substring(LZ_PREFIX.length);
		if (compressed.length < 3) {
			throw new Error('Invalid LZ events payload');
		}
		const index = Math.floor((compressed.length - 3) / 2);
		compressed = compressed.substring(0, index) + compressed.substring(index + 3);
		const decompressed = LZString.decompressFromBase64(compressed);
		if (!decompressed) {
			throw new Error('Unable to decompress events payload');
		}
		return { format: 'lz', json: JSON.parse(decompressed) };
	} catch (error) {
		console.error('Error in parse events:', error);
		return { format: 'error', error };
	}
}

export function serializeEventsText(input: ICgEventsParseResult): ICgEventsSerializeResult {
	try {
		switch (input.format) {
			case 'json':
				return { format: 'json', text: JSON.stringify(input.json, null, '\t') };
			case 'lz': {
				let output = LZString.compressToBase64(JSON.stringify(input.json));
				const index = Math.floor(output.length / 2);
				let marker = (17 * output.length).toString(36);
				if (marker.length > 3) {
					marker = marker.substring(0, 3);
				} else {
					while (marker.length < 3) marker += '0';
				}
				output = output.substring(0, index) + marker + output.substring(index);
				return { format: 'lz', text: btoa(LZ_PREFIX + output) };
			}
		}
		throw new Error('Invalid format');
	} catch (error) {
		console.error('Error in serialize events:', error);
		return { format: 'error', error };
	}
}

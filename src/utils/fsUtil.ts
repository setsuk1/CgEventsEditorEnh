import { Uri, workspace } from 'vscode';

export const fsUtil = {
	async readFile(uri: Uri, encoding: BufferEncoding = 'utf8'): Promise<string | undefined> {
		try {
			const buffer = await workspace.fs.readFile(uri);
			return Buffer.from(buffer).toString(encoding);
		} catch (e) {
			console.error(`Error in read file at ${uri.toString()}:`, e);
		}
		return undefined;
	},
	async readJson(uri: Uri, encoding: BufferEncoding = 'utf8'): Promise<any | undefined> {
		try {
			const text = await this.readFile(uri, encoding);
			if (text) {
				return JSON.parse(text);
			}
		} catch (e) {
			console.error(`Error in read json at ${uri.toString()}:`, e);
		}
		return undefined;
	}
} as const;

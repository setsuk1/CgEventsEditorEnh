import { FileSystemError, Uri, workspace } from 'vscode';

function isFileNotFound(error: unknown): boolean {
	return error instanceof FileSystemError && error.code === 'FileNotFound';
}

export const fsUtil = {
	async readFile(uri: Uri, encoding: BufferEncoding = 'utf8'): Promise<string | undefined> {
		try {
			const buffer = await workspace.fs.readFile(uri);
			return Buffer.from(buffer).toString(encoding);
		} catch (error) {
			if (!isFileNotFound(error)) {
				console.error(`Error in read file at ${uri.toString()}:`, error);
			}
			return undefined;
		}
	},
	async readJson(uri: Uri, encoding: BufferEncoding = 'utf8'): Promise<unknown> {
		const text = await this.readFile(uri, encoding);
		if (!text) return undefined;
		try {
			return JSON.parse(text);
		} catch (error) {
			console.error(`Error in parse json at ${uri.toString()}:`, error);
			return undefined;
		}
	}
} as const;

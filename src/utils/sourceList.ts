import path from 'path';

const EXCLUDED_PRELOAD_SOURCE_EXTS = new Set([
	'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'md',
]);
const TEST_FOLDER_NAME = 'test';

export const PRELOAD_SOURCE_EXCLUDE_GLOB = `**/*.{${Array.from(EXCLUDED_PRELOAD_SOURCE_EXTS).join(',')}}`;

export function isTestSource(relativePath: string): boolean {
	return relativePath === TEST_FOLDER_NAME || relativePath.startsWith(`${TEST_FOLDER_NAME}/`);
}

export function isPreloadSource(relativePath: string): boolean {
	const ext = path.posix.extname(relativePath).slice(1).toLowerCase();
	return !EXCLUDED_PRELOAD_SOURCE_EXTS.has(ext);
}


export function getSourceRelativePath(
	sourceRootFsPath: string,
	targetFsPath: string,
): string | undefined {
	const relative = path.relative(sourceRootFsPath, targetFsPath);
	if (
		!relative
		|| relative === '..'
		|| relative.startsWith(`..${path.sep}`)
		|| path.isAbsolute(relative)
	) {
		return undefined;
	}
	return relative.split(path.sep).join('/');
}

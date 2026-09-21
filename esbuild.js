const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

const webviewLoader = {
	'.css': 'css',
	'.svg': 'dataurl',
	'.png': 'dataurl',
	'.jpg': 'dataurl',
	'.jpeg': 'dataurl',
	'.woff': 'dataurl',
	'.woff2': 'dataurl',
	'.ttf': 'dataurl',
	'.eot': 'dataurl',
	'.gif': 'dataurl',
	'.mp3': 'dataurl',
};

async function createExtensionContext() {
	return esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/src/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});
}

async function createWebviewContext() {
	return esbuild.context({
		entryPoints: { index: 'webview/index.ts' },
		bundle: true,
		format: 'esm',
		splitting: true,
		minify: production,
		sourcemap: !production,
		platform: 'browser',
		target: ['chrome100', 'edge100'],
		outdir: 'dist/webview',
		entryNames: '[name]',
		chunkNames: 'chunks/[name]-[hash]',
		logLevel: 'silent',
		loader: webviewLoader,
		plugins: [esbuildProblemMatcherPlugin],
	});
}

async function createMonacoWorkersContext() {
	return esbuild.context({
		entryPoints: {
			'monaco-workers/editor.worker': 'node_modules/monaco-editor/esm/vs/editor/editor.worker.js',
			'monaco-workers/json.worker': 'node_modules/monaco-editor/esm/vs/language/json/json.worker.js',
		},
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		platform: 'browser',
		target: ['chrome100', 'edge100'],
		outdir: 'dist/webview',
		entryNames: '[name]',
		logLevel: 'silent',
		loader: webviewLoader,
		plugins: [esbuildProblemMatcherPlugin],
	});
}

async function main() {
	const contexts = await Promise.all([
		createExtensionContext(),
		createWebviewContext(),
		createMonacoWorkersContext(),
	]);
	if (watch) {
		await Promise.all(contexts.map((ctx) => ctx.watch()));
		return;
	}
	await Promise.all(contexts.map((ctx) => ctx.rebuild()));
	await Promise.all(contexts.map((ctx) => ctx.dispose()));
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
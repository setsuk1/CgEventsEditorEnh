const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

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
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
}

/**
 * Plugin to copy Monaco Editor worker files from esm build
 */
const monacoEditorPlugin = {
	name: 'monaco-editor',
	setup(build) {
		build.onEnd(() => {
			// Copy Monaco Editor workers from esm to dist
			const monacoSrc = path.join(__dirname, 'node_modules', 'monaco-editor', 'esm', 'vs');
			const monacoDest = path.join(__dirname, 'dist', 'webview', 'monaco-workers');

			if (!fs.existsSync(monacoDest)) {
				fs.mkdirSync(monacoDest, { recursive: true });
			}

			// Copy worker files
			const workerFiles = [
				'editor/editor.worker.js',
				'language/json/json.worker.js',
			];

			workerFiles.forEach(file => {
				const src = path.join(monacoSrc, file);
				const dest = path.join(monacoDest, path.basename(file));

				if (fs.existsSync(src)) {
					fs.copyFileSync(src, dest);
					console.log(`[monaco] Copied ${path.basename(file)}`);
				} else {
					console.warn(`[monaco] Warning: ${file} not found`);
				}
			});
		});
	},
};

async function createWebviewContext() {
	return esbuild.context({
		entryPoints: ['webview/index.ts'],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		platform: 'browser',
		target: ['chrome100', 'edge100'],
		outfile: 'dist/webview/index.js',
		logLevel: 'silent',
		loader: {
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
		},
		plugins: [
			monacoEditorPlugin,
			esbuildProblemMatcherPlugin,
		],
	});
}

async function main() {
	const contexts = await Promise.all([
		createExtensionContext(),
		createWebviewContext(),
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

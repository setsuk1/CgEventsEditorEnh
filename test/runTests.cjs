const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const compiledRoot = path.join(repoRoot, 'out', 'test');
const runtimeAliasRoot = path.join(compiledRoot, 'test');
const sharedAliasDir = path.join(runtimeAliasRoot, '@shared');

fs.mkdirSync(sharedAliasDir, { recursive: true });
fs.writeFileSync(
	path.join(sharedAliasDir, 'index.js'),
	"module.exports = require('../../shared');\n",
	'utf8',
);

const testGlob = path.join(compiledRoot, 'test', '*.test.js').replace(/\\/g, '/');
const nodePath = [runtimeAliasRoot, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
const result = spawnSync(process.execPath, ['--test', testGlob], {
	stdio: 'inherit',
	env: { ...process.env, NODE_PATH: nodePath },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

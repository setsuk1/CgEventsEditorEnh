# Development, Testing And CI

## Toolchain

- Node.js 22 in CI.
- TypeScript 5.9.
- React 19.
- esbuild for extension/webview/workers.
- VS Code engine `^1.106.0`.

## Install

```bash
npm install
```

Use `npm ci --no-audit --no-fund` for CI/reproducible dependency installs.

## Main Commands

```bash
npm run check-types
npm run lint
npm run compile
npm test
npm run watch
npm run package
npm run build
```

`npm test` is the canonical quality command. Its pretest step:
1. removes the previous `out/test` tree so deleted or renamed tests cannot leave stale compiled `*.test.js` files behind;
2. compiles the Node test tree;
3. runs the normal compile pipeline (typecheck + lint + esbuild);
4. runs compiled `*.test.js` files with Node's test runner.

## Typecheck Boundaries

`npm run check-types` checks:
- `shared/tsconfig.json`;
- `src/tsconfig.json`;
- `webview/tsconfig.json`.

This helps enforce the three runtime boundaries.

## Build Outputs

esbuild produces:
- `dist/src/extension.js`;
- `dist/webview/index.js` and chunks/CSS;
- Monaco editor/json workers.

## CI

`.github/workflows/ci.yml` runs on a GitHub-hosted Ubuntu runner.

For PRs it:
1. checks out full history;
2. installs Node 22;
3. runs `npm ci`;
4. runs `git diff --check`;
5. runs `npm test`.

Do not merge a behavior/refactor PR with a known failing CI run. A cancelled runner job is not a code failure, but it still needs a successful rerun before acceptance.

## Testing Policy

Add or preserve focused tests for:
- parsers/codecs;
- validation and prototype-safety boundaries;
- merge/ordering logic;
- save/concurrency semantics;
- geometry/layout algorithms;
- editor mutation/history invariants;
- regressions for confirmed bugs.

Do not keep a production micro-abstraction solely because a micro-test imports
it. Move the test to the owning domain when consolidating.

## PR Structure

Use one subsystem or one large category per PR.

Prefer multiple clear commits inside the PR, for example:
- `refactor: consolidate ...`
- `fix: preserve ... semantics`
- `test: cover ... regression`
- `docs: update ... boundary`

Avoid one PR per tiny helper.

## Review Before Merge

- Does the change reduce or increase cross-file navigation?
- Did it preserve user-visible and concurrency semantics?
- Did it accidentally move environment-specific code into `shared/`?
- Are user-facing strings translated?
- Did it add unnecessary context binding, `call/apply`, or prototype-chain
  invocation?
- Is nesting clearer inline, or did extraction actually create a meaningful
  semantic unit?
- Is a deleted utility truly obsolete rather than simply unused?

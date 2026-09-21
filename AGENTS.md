# Engineering Contract

This file records stable maintenance rules for CgEventsEditorEnh. It is the
first repository document to read before refactoring or changing architecture.

## Priorities

In order:

1. Readability and maintainability.
2. Correct behavior and regression safety.
3. Simpler ownership and fewer unnecessary indirection layers.
4. Performance where measurement or product behavior justifies it.

A refactor is not successful merely because files or methods became smaller.
The important question is whether a reader can understand the feature with less
navigation, fewer hidden state transitions, and clearer ownership.

## Refactoring Rules

- Prefer cohesive domain owners over one-helper-per-file decomposition.
- Do not extract a function only to remove one or two levels of nesting.
  Short, local nesting is acceptable when it keeps the complete flow visible.
- Prefer guard clauses when they genuinely improve the main path.
- Extract when the code has independent semantic value: real reuse, a stable
  domain concept, an algorithm/invariant that deserves focused tests, or a
  lifecycle/side-effect boundary.
- A single consumer is not proof that an abstraction is wrong. A focused
  utility or component may still be the clearest owner.
- An unused utility is not automatically dead code. Utilities may intentionally
  be retained for future use. Do not delete one solely because current source
  has no consumer.
- Be especially skeptical of abstractions introduced during refactoring:
  tiny Policy/Data/Resolver/Transition files, forwarding methods, pass-through
  React components, and generic wrappers with little behavior.
- Do not replace a useful abstraction with a giant owner file merely to reduce
  file count.
- Remove dead code only when it is actually obsolete, not merely unused today.

## Shared Boundary

`shared/` is the dependency-neutral contract layer used by both the VS Code
extension host (`src/`) and browser webview (`webview/`).

Move code into `shared/` when it is genuinely needed by both sides, or when it
defines their wire/data contract. Do not use `shared/` as a generic dumping
ground.

When adding a new shared capability:

1. identify the `src/` and `webview/` consumers;
2. keep the implementation free of VS Code, DOM, React, Node-only, and
   browser-only dependencies unless the shared contract explicitly permits it;
3. export it through `shared/index.ts` when it is public;
4. update `docs/architecture/shared-boundary.md`;
5. add focused tests for non-trivial validation or data semantics.

Existing `shared/` behavior is considered stable and should not be casually
deleted or rewritten during cleanup.

## Translation

User-facing webview text should use the existing translation infrastructure,
normally `translation.<key>.getTrans()`.

Do not:
- hardcode an English/Chinese branch in UI code;
- inspect the language code merely to choose UI copy;
- build a second translation wrapper when the existing system is sufficient.

Language-to-protocol mapping is different from translation. For example, mapping
the selected editor language into an external viewer's `'en' | 'zh'` locale is
allowed when that is the external protocol.

## Invocation Style

Do not introduce `Function.prototype.call`, `Function.prototype.apply`, or
equivalent `fn.call(...)` / `fn.apply(...)` binding patterns in project code
when an ordinary callback or stable arrow function is sufficient.

Prefer:
- direct invocation: `listener(event)`;
- stable arrow handlers for event subscriptions;
- `Object.hasOwn(object, key)` for own-property checks.

Do not add new `Object.prototype.hasOwnProperty.call(...)` usage outside
protected shared code.

When touching an existing call/apply-based API, migrate it only when listener
identity and unsubscribe semantics can be preserved.

## PR And Commit Scope

One subsystem or one large functional category per PR.

Within that PR, keep separate meaningful commits for:
- refactoring;
- bug fixes;
- tests;
- documentation corrections.

Do not create one PR per tiny helper or tiny fix. Do not mix unrelated
subsystems merely to reduce PR count.

## Bug Fixes During Refactoring

Fix clear bugs encountered while refactoring and add regression coverage where
it protects a real invariant. Do not invent behavior changes simply to make a
refactor look substantial.

Passing tests prove regression coverage, not the absence of all unknown bugs.

## Documentation

Start at `docs/README.md`.

Stable architecture belongs under `docs/architecture/`. Current branch and
work-queue state belongs in `docs/current-status.md`. Feature ownership belongs
under `docs/subsystems/`. Do not rely on chat history as the only record of an
architecture decision.

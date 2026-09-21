# Codebase Quality Constraints

These are stable maintainability rules for active project code.

## Q1. Optimize For Reading The Feature

The preferred structure is the one that minimizes cognitive jumps while keeping
clear ownership.

Do not equate:
- smaller files with simpler architecture;
- more pure helpers with better maintainability;
- fewer lines with lower complexity.

A reader should be able to follow a feature without opening a chain of tiny
Policy/Resolver/Data/Transition files that each contain one short branch.

## Q2. Abstraction Must Pay For Itself

Good reasons to extract:
- multiple real consumers;
- a stable domain concept;
- a non-trivial algorithm or invariant with focused tests;
- lifecycle/side-effect ownership;
- a platform/runtime boundary;
- a meaningful reusable UI block.

Weak reasons to extract:
- reducing indentation by one level;
- making a function shorter in isolation;
- enabling a micro-test for otherwise obvious local code;
- hiding a one-line forwarding call;
- hypothetical future reuse.

A single consumer does not automatically make an abstraction bad. Conversely,
a generic name does not make a thin wrapper valuable.

Do not remove an existing utility merely because it has no current consumer.

## Q3. Nesting And Local Flow

Prefer guard clauses when they make the main path obvious.

Do not extract a new function solely to eliminate nesting. A short nested block
can be easier to read than forcing the reader to jump to another method/file.

Extract a nested block when it has its own semantic name, significant size,
reuse, side effects/lifecycle, or an independently testable invariant.

## Q4. Avoid Pass-Through Layers

Review critically:
- methods that only call another method;
- React components that only rename/forward props;
- modules that only re-export one implementation for one consumer;
- manager/adapter classes that only relay an event to one owner.

Keep a pass-through only when it establishes a real public/runtime boundary.

## Q5. Use Existing Shared Capabilities

If `src/` and `webview/` need the same semantics, consider `shared/`.
Follow [shared-boundary.md](shared-boundary.md).

Do not duplicate:
- document/message validation;
- common language identity;
- shared object semantics;
- cross-runtime data contracts.

Do not move frontend-only or backend-only helpers into shared just to make them
look reusable.

## Q6. Translation

Normal user-facing webview strings use the existing translation system.

Do not select UI copy with ad-hoc checks such as `language.startsWith('zh')`.

Add translation keys instead.

## Q7. Direct Invocation

New project code should not use `Function.call/apply` to simulate receiver
binding when direct callbacks are sufficient.

Prefer stable arrow handlers and direct invocation.

Use `Object.hasOwn` for own-property checks in ES2022 project code rather than
`Object.prototype.hasOwnProperty.call`.

Existing shared code is not rewritten solely to satisfy this style rule.

## Q8. Tests Protect Invariants, Not Abstractions

Keep tests that protect bugs, data safety, ordering, parsing, geometry,
concurrency, or other meaningful behavior.

Do not preserve a production abstraction merely because a test imports it.
Tests may be moved to the owning domain module when an abstraction is
consolidated.

A deleted micro-wrapper does not require a replacement micro-test if higher
level coverage already protects the meaningful behavior.

## Q9. Bug Fixes During Refactoring

When a clear defect is found in the subsystem being refactored:
- fix it in a separate commit in the same subsystem PR;
- preserve existing semantics elsewhere;
- add regression coverage when useful.

Do not broaden the PR into unrelated cleanup.

## Q10. PR Granularity

Use one subsystem or one large functional category per PR.

A PR may contain multiple commits:
- structural consolidation;
- individual bug fixes;
- tests;
- documentation.

Do not treat a PR as a commit.

## Review Questions

Before keeping a new abstraction:
1. What semantic boundary does it represent?
2. Who are its real consumers?
3. Does reading the caller become easier?
4. Would putting the code back in the owner make the full flow clearer?
5. Is the abstraction hiding state/lifecycle that should be visible?
6. Is it duplicating something in `shared/`?

Before deleting an existing utility:
1. Is it actually obsolete, or merely unused now?
2. Was it intentionally retained for a coherent future/general use?
3. Is deletion required for readability, or just for a smaller file count?

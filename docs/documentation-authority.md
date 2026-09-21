# Documentation Authority

Last reconciled: **2026-09-21**

Use this order when two descriptions disagree about what the repository does
now:

1. the user's current instruction;
2. `AGENTS.md` for stable project rules;
3. current source on the accepted `main` branch;
4. `docs/current-status.md` for the live handoff and pending integration queue;
5. the focused architecture/subsystem document;
6. older commits, PR descriptions, and historical discussion for provenance.

A lower-level source can add detail but should not silently override a newer
user instruction or current source.

## Stable Rules vs Current Status

`AGENTS.md` and `docs/architecture/` should change only when project rules or
ownership actually change.

`docs/current-status.md` is intentionally short-lived. It may mention current
PRs, the accepted main commit, known defects, and the active refactor direction.

Subsystem docs describe the feature ownership expected to remain useful after
individual PRs are merged.

## Source Is Required For Final Verification

Documentation is a map, not a substitute for reading the current implementation.
Before changing behavior, verify the owner in source and check the relevant
tests.

If a document says a feature is complete but source/tests disagree, source and
fresh verification win and the document should be corrected in the same PR.

## Shared Boundary Changes

Any move into or out of `shared/` changes architecture and must update
[architecture/shared-boundary.md](architecture/shared-boundary.md).

The change should record the actual consumers and why the contract is shared.
"May be useful later" is not enough reason to move a new abstraction into
`shared/`.

## Status Language

Claims such as "current", "complete", "fixed", "unused", "dead", and "no bugs"
require fresh verification.

In particular:
- no open issues does not prove no unknown bugs;
- no current consumer does not prove a utility should be deleted;
- a passing CI run proves the tested contracts, not every runtime path.

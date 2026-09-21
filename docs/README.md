# CgEventsEditorEnh Documentation

This folder is the maintainer-facing map of the repository. It separates stable
architecture from short-lived project status so future refactors do not have to
reconstruct intent from Git history or old conversations.

## Read Order

For normal development:

1. [../AGENTS.md](../AGENTS.md) — stable engineering and refactoring contract.
2. [current-status.md](current-status.md) — current accepted branch state and
   active cleanup queue.
3. [architecture/README.md](architecture/README.md) — code ownership and
   dependency boundaries.
4. [functionality/README.md](functionality/README.md) — user-visible feature map.
5. The focused [subsystem](subsystems/README.md) document for the code being
   changed.
6. [development/testing-and-ci.md](development/testing-and-ci.md) before opening
   or merging a PR.

[documentation-authority.md](documentation-authority.md) defines how to resolve
conflicts between current source, current status, and older documentation.

## Architecture

- [architecture/README.md](architecture/README.md)
- [architecture/runtime-boundaries.md](architecture/runtime-boundaries.md)
- [architecture/shared-boundary.md](architecture/shared-boundary.md)
- [architecture/codebase-quality-constraints.md](architecture/codebase-quality-constraints.md)

These documents answer where code should live and what kind of abstraction is
appropriate.

## Subsystems

- [subsystems/README.md](subsystems/README.md)
- [subsystems/document-and-save-flow.md](subsystems/document-and-save-flow.md)
- [subsystems/project-data-and-schema.md](subsystems/project-data-and-schema.md)
- [subsystems/webview-editor.md](subsystems/webview-editor.md)

Use subsystem docs for feature ownership and the main data flow.

## Functionality

- [functionality/README.md](functionality/README.md)

This is the compact feature inventory for the current editor.

## Development

- [development/testing-and-ci.md](development/testing-and-ci.md)

## Updating Documentation

Update documentation as part of the owning subsystem PR when an architectural
boundary, public message contract, shared responsibility, or major feature flow
changes.

Do not turn `current-status.md` into a permanent history log. Keep it compact
and current; Git history already preserves older snapshots.

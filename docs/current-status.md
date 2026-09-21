# Current Project Status

Last reconciled: **2026-09-22**

This is the short maintainer handoff for the accepted codebase and the current
quality direction.

## Accepted Baseline

The extension currently has focused regression coverage for its editor,
validation, schema, history, interaction, and data-boundary behavior. The
canonical quality command is `npm test`; compiled test output is cleaned before
rebuild so deleted or renamed tests cannot survive as stale JavaScript.

Recent maintainability work has:
- reduced refactor-created forwarding layers and pass-through components where
  direct ownership is clearer;
- consolidated related RJSF, Logic Library, responsive-layout, virtual-list,
  context-menu, and interaction logic into cohesive domain owners;
- preserved useful utilities and explicit lifecycle/message boundaries even
  when they are small or currently have few consumers;
- removed listener context binding and ordinary `call/apply` invocation in
  production flows in favor of stable direct callbacks;
- aligned lint rules with the accepted concise single-line guard style while
  retaining warnings for ambiguous multi-line unbraced control flow;
- kept parsed JSON and validator inputs typed as untrusted values until runtime
  validation establishes their shape.

## Maintenance Direction

Priorities remain:
1. readability and maintainability;
2. behavior and regression safety;
3. simpler ownership and fewer unnecessary indirection layers;
4. performance where measurement or product behavior justifies it.

A small module or method is not a cleanup target merely because it is small.
Keep abstractions that own a real algorithm, invariant, lifecycle, platform
boundary, message contract, or reusable domain concept. Consolidate only when a
layer mainly forwards arguments or forces readers to jump files without adding
meaning.

`shared/` remains the dependency-neutral contract layer for both the extension
host and webview. New shared capabilities must have consumers on both sides or
define their wire/data contract, and the shared-boundary documentation must be
updated with the rationale.

## Main Functional Boundary

The extension supports:
- opening and editing Code.Gamelet `.events` documents;
- JSON and compressed LZ document formats;
- visual and raw JSON editing;
- schema-driven configuration and logic editing;
- event add/update/delete/move/duplicate/disable operations;
- trigger/check/action editing, multi-selection and movement;
- event folders, filtering and sorting presets;
- Logic Library search/navigation;
- RJSF configuration forms with custom widgets and visibility/default logic;
- project-derived schema, source, resource, item and CgApp metadata;
- editor/form undo-redo;
- language selection/synchronization and translated webview UI;
- helper viewer/selector integration;
- Monaco JSON editing;
- save conflict protection using document versions.

See [functionality/README.md](functionality/README.md) for the feature map and
[subsystems/README.md](subsystems/README.md) for ownership.

## Current Quality Risks

The main maintainability risk is still excessive indirection around local
flows, not a lack of abstractions. Large owners such as `CgEventsEditor.ts`,
`RJSFConfigsPanel.tsx`, `EventsEditorComponent.tsx`, and
`LogicItemsList.tsx` should be improved by responsibility rather than by
mechanically extracting every branch into a new file.

When changing these areas, distinguish real domain/lifecycle/platform
boundaries from refactor-created forwarding layers, and prefer explicit
validation at external data boundaries over type assertions that hide trust
assumptions.

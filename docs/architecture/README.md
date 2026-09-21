# Architecture

CgEventsEditorEnh has three primary runtime layers:

- `src/` — VS Code extension-host backend;
- `shared/` — dependency-neutral contracts and common data semantics;
- `webview/` — browser/React editor frontend.

Read:
1. [runtime-boundaries.md](runtime-boundaries.md)
2. [shared-boundary.md](shared-boundary.md)
3. [codebase-quality-constraints.md](codebase-quality-constraints.md)

## Dependency Direction

The intended high-level dependency direction is:

```text
src/ ---------+
              +--> shared/
webview/ -----+
```

`shared/` must not depend back on extension-host or webview implementation.

The backend and frontend communicate through the message contracts in
`shared/messages.ts`.

## Main Owners

- Extension activation/provider: `src/extension.ts`,
  `src/CgEventsEditorProvider.ts`
- Panel/document synchronization: `src/CgEventsEditorWebViewPanel.ts`
- Workspace project metadata: `src/CgProjectParser.ts`
- Shared message/data validation: `shared/`
- Frontend editor state: `webview/editor/CgEventsEditor.ts`
- Application shell: `webview/ui/App.tsx`
- Event editor UI: `webview/ui/components/events/`
- Schema/RJSF UI: `webview/ui/rjsf/`
- Translation data: `webview/trans/`

The goal is clear ownership, not maximal decomposition.

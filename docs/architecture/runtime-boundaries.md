# Runtime Boundaries

## Extension Host: `src/`

The extension host owns VS Code and filesystem concerns.

Primary responsibilities:
- register the custom text editor and commands;
- watch `.events` files and workspace project inputs;
- parse/serialize the document format;
- collect project schema, items, sources, resources and CgApp metadata;
- manage VS Code configuration and sorting presets;
- host the webview with CSP/resource URLs;
- validate messages received from the webview;
- serialize document writes and prevent stale visual-editor saves;
- open VS Code settings and approved external URLs.

The main owners are `CgEventsEditorWebViewPanel` and `CgProjectParser`.

Browser UI concerns do not belong in `src/`.

## Shared Contract: `shared/`

`shared/` owns data definitions and behavior that must mean the same thing on
both sides of the webview boundary.

It currently includes:
- events document types and validation;
- schema types and validation;
- project resource/item/CgApp types and validation;
- incoming/outgoing webview message contracts;
- language definitions;
- translation engine primitives;
- common object/data semantics.

See [shared-boundary.md](shared-boundary.md) for the registry and change rules.

## Browser Frontend: `webview/`

The webview owns browser state and presentation:
- React rendering;
- visual event editing;
- frontend history/undo/redo;
- event/logic selection, drag/drop and context menus;
- RJSF schema conversion/forms/widgets;
- virtualized event list;
- Monaco JSON editor;
- translated UI;
- helper selector/viewer;
- webview-side message dispatch.

`webview/editor/CgEventsEditor.ts` is the central in-memory editor model.
React components should manipulate editor state through that model rather than
creating parallel document owners.

## Message Boundary

`shared/messages.ts` is the contract.

Backend-to-webview messages include:
- language settings;
- parsed events document;
- merged events schema;
- CgApp metadata;
- sources/resources/items;
- sorting presets.

Webview-to-backend messages include:
- ready;
- language updates;
- save;
- sorting preset save/delete;
- open settings;
- open approved external URL.

Both sides validate the payload shape. The panel and webview also require the
per-panel message token before accepting messages.

When a new message is needed, update the shared message type and validator first,
then update both endpoints.

## Document Authority

The VS Code `TextDocument` remains the persisted document authority.

The webview keeps an editable in-memory copy and carries
`documentVersion` with successful parsed entries.

On save, the backend compares:
- the webview base version;
- current VS Code document version;
- last accepted/applied webview versions;
- serialized/current text;
- dirty state.

The save planner may apply an edit, save the current document, send the current
document back, or reject a stale edit. See
[../subsystems/document-and-save-flow.md](../subsystems/document-and-save-flow.md).

## Project Metadata Authority

`CgProjectParser` owns workspace-derived metadata:
- `static/js/scripts.js` CgCfg/CgApp data;
- `static/json/items.json`;
- files under `src/` used as source suggestions;
- resource aliases from CgApp data;
- `events.schema.json` discovery and merge;
- `default.events.json` discovery and deterministic merge.

The webview consumes snapshots sent by the panel. It does not independently
scan the VS Code workspace.

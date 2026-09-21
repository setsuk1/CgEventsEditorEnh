# Document And Save Flow

## Open

1. VS Code resolves the `.events` document through
   `CgEventsEditorProvider`.
2. `CgEventsEditorWebViewPanel` creates the webview and per-panel message token.
3. The webview sends `READY`.
4. The panel sends language, document, schema, project metadata and sorting
   presets.
5. `webview/index.ts` feeds the document/project messages into the singleton
   frontend editor.

## Parse

`CgProjectParser.parseEvents` delegates to `src/utils/eventsCodec.ts`.

Supported forms:
- direct JSON text;
- base64 JSON compatibility input;
- LZ payload marked with `/*lz*/`.

Boundary validation uses `shared/events.ts`.

## Frontend Ownership

`CgEventsEditor` owns the editable parsed document and frontend mutation
history.

React event/config components should call editor operations instead of mutating a
second document copy.

The editor emits typed change-event names for UI synchronization.

## JSON Mode

`App` switches between the visual editor and Monaco JSON view.

When returning to visual mode, the current JSON text is parsed/applied through
the frontend editor. Invalid JSON stays in JSON mode with an error.

## Save

The frontend sends the current successful parsed entry through
`OutgoingMessageType.SAVE`.

The backend:
1. serializes to the selected JSON/LZ format;
2. compares the webview base version against the current VS Code document;
3. uses `resolveDocumentSaveAction` to avoid stale overwrites;
4. applies a `WorkspaceEdit` when appropriate;
5. saves the VS Code document;
6. sends the current parsed document/version back to the webview.

Save requests are serialized in the panel with a Promise tail so overlapping
saves do not race. Language-setting and sorting-preset writes use independent
tails.

## External Document Changes

VS Code text-document changes outside an active webview edit invalidate the last
accepted webview version pair.

The panel debounces the change and sends the latest document to the frontend.

## Invariants

- VS Code `TextDocument` is the persistence authority.
- Webview state is editable state, not independent persistence.
- Stale visual-editor data must not overwrite a newer external document.
- Message payloads are validated before use.
- Save serialization is required behavior even though it no longer uses a
  generic queue abstraction.

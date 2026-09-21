# Webview Editor

## Bootstrap

`webview/index.ts`:
- configures Monaco workers;
- synchronizes Bootstrap theme with VS Code theme classes;
- wires incoming messages into the editor;
- reconciles global selection state with document changes;
- renders `App`.

## Editor Model

`webview/editor/CgEventsEditor.ts` is the primary frontend document owner.

It manages:
- parsed document/format/version;
- schema and project metadata;
- event mutation;
- logic-block mutation;
- sorting presets;
- undo/redo history;
- change events consumed by React UI.

Mutation helpers under `webview/editor/` should represent real editor-domain
algorithms/invariants, not arbitrary extra layers.

## App Shell

`webview/ui/App.tsx` owns:
- visual vs JSON mode;
- application-level save/undo/redo shortcuts;
- language synchronization UI;
- navbar visibility during scrolling;
- loading state;
- audio volume/mute;
- Monaco top-level JSON editor.

## Event UI

`webview/ui/components/events/` owns:
- event filtering/sorting/folders;
- virtualized event list;
- event cards;
- trigger/check/action sections;
- logic selection and drag/drop;
- context menus;
- Logic Library;
- event/logic JSON panels;
- responsive layout behavior.

The intended direction is cohesive feature modules. Avoid creating one file for
each tiny decision.

## RJSF

`webview/ui/rjsf/` converts the Code.Gamelet schema into RJSF schema/UI schema
and provides custom templates/widgets.

Major concerns:
- schema conversion and lookup;
- defaults/coercion;
- conditional visibility;
- array/object layout;
- custom select/checkbox/helper/JSON/datalist/color widgets;
- validation-message transformation;
- form history and immediate commits.

Prefer adding behavior to the existing owning RJSF domain module instead of
creating a new one-purpose Data/Policy file unless it has independent value.

## Translation

The webview translation map lives under `webview/trans/`.

Normal user-facing text should be a translation key. Do not branch on language
codes to choose ordinary UI copy.

## Event Infrastructure

`EventEmitter` and `WindowEventEmitter` provide shared frontend event
infrastructure.

New code should prefer stable arrow handlers and direct invocation. Avoid adding
new context-binding APIs that require `call/apply`.

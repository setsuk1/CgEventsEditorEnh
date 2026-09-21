# Project Data And Schema

`CgProjectParser` is the extension-host owner for workspace metadata used by
the editor.

## CgApp / Resources

The parser reads `static/js/scripts.js`, extracts the last embedded `CgCfg`
payload, base64-decodes it and validates the resulting CgApp structure.

Resource suggestions are derived from the CgApp resource alias/map data.

## Items

`static/json/items.json` is parsed and validated as the shared item-list
contract.

Relative item icon paths are converted into webview-safe URIs by the panel.

## Sources

The parser scans the workspace `src/` tree and maintains source lists.

Code/markdown extensions excluded by source policy are not treated as preload
sources. Test-subtree sources can be filtered from normal project views.

## Event Schema

All matching `events.schema.json` files are discovered.

The parser keeps a per-file schema map/version and merges it when invalidated.
The webview receives one merged `ICgEventsSchema`.

Schema types and validation live in `shared/schema.ts`.

## Default Events

Matching `default.events.json` files are loaded with deterministic ordering.

Default config entries are filtered using schema definitions and then merged
with stage/preload/config/event precedence rules. Duplicate event IDs keep the
earlier accepted event.

## Watchers

Project watchers refresh only the affected category:
- scripts → CgApp/resources;
- items → items;
- source tree → sources;
- schema files → schema.

The webview does not scan the filesystem itself.

## Async Loading

`LazyAsyncLoad` coordinates lazy/reloadable parser data. It is a real parser
lifecycle abstraction and should not be removed merely because it is small.

Its public surface should remain limited to behavior actually required by the
parser.

## Shared Boundary

Data sent to the webview should use shared contracts when both runtimes must
agree on shape/validation. New shared types must be registered in
`docs/architecture/shared-boundary.md`.

# Shared Boundary Registry

`shared/` exists for contracts and semantics genuinely shared between
`src/` and `webview/`.

It is a protected architecture layer: do not delete or rewrite its existing
capabilities as part of an unrelated cleanup.

## Current Registry

| Owner | Responsibility |
| --- | --- |
| `shared/events.ts` | Events document/format types and boundary validation |
| `shared/schema.ts` | Event-schema types and boundary validation |
| `shared/resources.ts` | CgApp, item and project-resource data contracts |
| `shared/messages.ts` | Typed/validated backend ↔ webview protocol, sorting and external-URL codes |
| `shared/locales/language.ts` | Supported language identity and lookup semantics |
| `shared/translation/Translation.ts` | Translation engine primitive used by webview translation maps |
| `shared/utils/ObjectUtil.ts` | Common clone/equality/safe-assign data semantics |
| `shared/keyboard/Key.ts` | Common keyboard key definitions intentionally owned by the shared contract layer |
| `shared/index.ts` | Public shared export surface |

## When Code Belongs Here

For **new moves into shared**, a capability belongs in `shared/` when at least one of these is true:

1. both `src/` and `webview/` need the same implementation;
2. it defines the data/wire contract between them;
3. duplicated implementations would risk different validation or data
   semantics on each side.

A capability does **not** belong here merely because it looks generic.

This admission rule is not a cleanup rule for existing shared code. Existing
shared owners may be intentionally retained even when only one current runtime
happens to consume them. Do not move or delete existing shared code solely from
reference counts.

## Change Record Requirement

When adding a new shared capability, the owning PR should record:

- backend consumer(s);
- webview consumer(s);
- why one shared implementation is preferable;
- whether it changes a message/data compatibility contract;
- tests that protect non-trivial behavior.

Update the registry table above in the same PR.

## Dependency Restrictions

Shared code should stay environment-neutral. Avoid imports from:
- `vscode`;
- React;
- DOM-only APIs;
- Node-only filesystem/process APIs;
- webview implementation modules;
- extension-host implementation modules.

A shared data structure may contain plain serializable values used by either
runtime.

## Translation Boundary

The generic translation engine is shared. The actual webview UI translation
map is owned by `webview/trans/`.

User-facing React copy should use `translation.<key>.getTrans()`. Do not add
manual language-code branches for normal UI text.

## Existing Shared Code

Do not use style cleanup as a reason to rewrite stable shared implementations.
If a shared implementation has a confirmed bug, fix it with focused regression
coverage and document the compatibility impact when relevant.

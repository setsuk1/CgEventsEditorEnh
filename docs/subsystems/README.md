# Subsystem Map

Use this map to find the owner before changing behavior.

## Document And Save

See [document-and-save-flow.md](document-and-save-flow.md).

Owners:
- `src/CgEventsEditorWebViewPanel.ts`
- `src/utils/eventsCodec.ts`
- `src/utils/documentSavePlan.ts`
- `shared/events.ts`
- `shared/messages.ts`
- `webview/editor/CgEventsEditor.ts`

## Workspace Project Data And Schema

See [project-data-and-schema.md](project-data-and-schema.md).

Owners:
- `src/CgProjectParser.ts`
- `src/utils/eventsSchemaMerge.ts`
- `src/utils/defaultEventsMerge.ts`
- `src/utils/cgAppScripts.ts`
- `src/utils/sourceList.ts`
- `src/utils/resourceList.ts`
- `shared/schema.ts`
- `shared/resources.ts`

## Webview Editor

See [webview-editor.md](webview-editor.md).

Owners:
- `webview/editor/`
- `webview/ui/App.tsx`
- `webview/ui/components/events/`
- `webview/ui/rjsf/`

## Messaging

Owners:
- `shared/messages.ts`
- `src/CgEventsEditorWebViewPanel.ts`
- `webview/msg/MessageHandler.ts`

## Translation

Owners:
- `shared/translation/Translation.ts` — engine
- `shared/locales/language.ts` — language identity
- `webview/trans/Trans.ts`, `en.ts`, `zh.ts` — webview UI map

## Common Webview Infrastructure

- `webview/utils/EventEmitter.ts`
- `webview/msg/WindowEventEmitter.ts`
- `webview/ui/utils/`
- `webview/ui/components/common/`

These should remain small infrastructure boundaries only when they have real
reuse/lifecycle value. Avoid adding generic wrappers without a concrete need.

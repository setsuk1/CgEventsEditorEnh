# Functionality Map

This is the compact map of currently implemented product features.

## Document Editing

- Custom VS Code editor for `.events` files.
- JSON document format.
- Compressed/base64 LZ events format.
- Visual ↔ JSON mode switching.
- Monaco-based JSON editing and validation feedback.
- Save conflict protection when the underlying VS Code document changes.

## Events

- Add, duplicate, edit, remove and reorder events.
- Enable/disable events.
- Rename event IDs with collision/format validation.
- Edit event folders.
- Filter events by folder.
- Event header summaries and status chips.
- Event UI collapse state.
- Virtualized event rendering for large documents.

## Logic Blocks

- Trigger, check and action sections.
- Add/edit/remove/reorder blocks.
- Move blocks within and across events.
- Multi-selection operations.
- Drag/drop and context-menu operations.
- Keyboard shortcuts for list interactions.
- JSON editing for logic data.
- UI identity preservation across mutations where required.

## Logic Library And Suggestions

- Schema-driven logic library.
- Search.
- Folder/path navigation.
- Back/forward/up navigation.
- Responsive breadcrumbs.
- Text suggestions sourced from schema/project data.

## Base Settings And RJSF

- Schema-driven base/config forms.
- Visual/JSON editing.
- Custom field/widget templates.
- Array/object layout handling.
- Conditional visibility expressions.
- Default-value generation.
- Custom helper widgets.
- Select/checkbox/datalist/color/JSON widgets.
- Form undo/redo and validation.

## Project Integration

The extension host derives and pushes:
- merged `events.schema.json`;
- CgApp metadata from `static/js/scripts.js`;
- item metadata from `static/json/items.json`;
- workspace source suggestions;
- project resource aliases;
- default events from `default.events.json`.

## Sorting

- Multiple sorting rules.
- Sorting by event metadata and list characteristics.
- Save/load/delete named sorting presets in VS Code settings.
- Default sorting preset.

## Language And Translation

- `auto`, English, Traditional Chinese, Simplified Chinese, Japanese and
  Korean language settings.
- VS Code language synchronization modes.
- Webview strings routed through the translation map where implemented.

## Helper Integration

- Helper selector/viewer.
- External helper frame integration.
- Helper-driven values for schema fields.

## Audio

- UI hover/click sound effects.
- User volume and mute control.

## External Navigation

- Open extension settings.
- Open approved tutorial/discussion/sample links.
- Open the Code.Gamelet online editor when project code is available.

## Commands

- Open Events File as JSON (Enh).
- Create Events File With Template (Enh).

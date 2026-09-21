import 'bootstrap/dist/css/bootstrap.min.css';

import '@media/css/components.actions.css';
import '@media/css/components.base-settings.css';
import '@media/css/components.breadcrumb.css';
import '@media/css/components.cards.css';
import '@media/css/components.config-field.css';
import '@media/css/components.events-explorer.css';
import '@media/css/components.events-frame.css';
import '@media/css/components.headers.css';
import '@media/css/components.helper-field.css';
import '@media/css/components.loading.css';
import '@media/css/components.logic-items.css';
import '@media/css/components.logic-library.css';
import '@media/css/components.menus.css';
import '@media/css/components.modal.css';
import '@media/css/components.navbar.css';
import '@media/css/components.toolbar.css';
import '@media/css/components.virtual-list.css';
import '@media/css/core.base.css';
import '@media/css/core.forms.css';
import '@media/css/core.monaco.css';
import '@media/css/core.motion.css';
import '@media/css/core.settings.css';
import '@media/css/core.utilities.css';

import { IIncomingMessageLanguageSyncData, IncomingMessageType } from '@shared';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { editor, EditorChangeEvents } from './editor/CgEventsEditor';
import { msgHandler } from './msg/MessageHandler';
import { winEE } from './msg/WindowEventEmitter';
import { App } from './ui/App';
import { logicItemsListGlobalManager } from './ui/components/events/LogicItemsListGlobalManager';
import { selectionStateManager } from './ui/components/events/SelectionState';

const container = document.getElementById('cgevents-root') as HTMLDivElement;
const editorWorkerUrl = container.dataset.monacoEditorWorker as string;
const jsonWorkerUrl = container.dataset.monacoJsonWorker as string;

self.MonacoEnvironment = {
    getWorkerUrl: function (_moduleId: string, label: string) {
        return label === 'json' ? jsonWorkerUrl : editorWorkerUrl;
    }
};

function syncBootstrapThemeFromVscode() {
    const body = document.body;
    const isLight =
        body.classList.contains('vscode-light') ||
        body.classList.contains('vscode-high-contrast-light');
    document.documentElement.dataset.bsTheme = isLight ? 'light' : 'dark';
}

syncBootstrapThemeFromVscode();
new MutationObserver(() => syncBootstrapThemeFromVscode()).observe(document.body, {
	attributes: true,
	attributeFilter: ['class'],
});

function syncDocumentLanguage(data: IIncomingMessageLanguageSyncData) {
    if (data.languageCode) document.documentElement.lang = data.languageCode;
}

msgHandler.onIncoming(IncomingMessageType.LANGUAGE_SYNC, syncDocumentLanguage);
msgHandler.onIncoming(IncomingMessageType.EVENTS_JSON, (data) => editor.setCgEventsJson(data));
msgHandler.onIncoming(IncomingMessageType.EVENTS_SCHEMA_JSON, (data) => editor.setCgEventsSchema(data));
msgHandler.onIncoming(IncomingMessageType.CGAPP, (data) => editor.setCgApp(data));
msgHandler.onIncoming(IncomingMessageType.PROJECT_ITEMS, (data) => editor.setItems(data));
msgHandler.onIncoming(IncomingMessageType.PROJECT_SOURCES, (data) => editor.setSources(data));
msgHandler.onIncoming(IncomingMessageType.PROJECT_RESOURCES, (data) => editor.setResources(data));
msgHandler.onIncoming(IncomingMessageType.SORTING_PRESETS, (data) => editor.setSortingPresets(data));

function reconcileSelectionToCurrentEvents(payload?: { eventId?: string; previousEventId?: string }) {
    selectionStateManager.reconcileEvents(
        payload,
        editor.getEvents().map((event) => event.id),
    );
}

function clearSelectionAfterLogicStructureChange() {
    selectionStateManager.clearSelection();
}

editor.on(EditorChangeEvents.EVENT_UPDATED, reconcileSelectionToCurrentEvents);
editor.on(EditorChangeEvents.EVENT_REMOVED, reconcileSelectionToCurrentEvents);
editor.on(EditorChangeEvents.EVENTS_REPLACED, reconcileSelectionToCurrentEvents);
editor.on(EditorChangeEvents.DOCUMENT_UPDATED, clearSelectionAfterLogicStructureChange);
[
    EditorChangeEvents.TRIGGER_ADDED,
    EditorChangeEvents.TRIGGER_REMOVED,
    EditorChangeEvents.TRIGGER_MOVED,
    EditorChangeEvents.CHECK_ADDED,
    EditorChangeEvents.CHECK_REMOVED,
    EditorChangeEvents.CHECK_MOVED,
    EditorChangeEvents.ACTION_ADDED,
    EditorChangeEvents.ACTION_REMOVED,
    EditorChangeEvents.ACTION_MOVED,
].forEach((eventType) => editor.on(eventType, clearSelectionAfterLogicStructureChange));

const root = createRoot(container);
root.render(React.createElement(App, { editor }));

function handleLogicItemsListMouseDown(event: MouseEvent) {
    logicItemsListGlobalManager.handleWindowMouseDown(event);
}

function handleLogicItemsListKeyDown(event: KeyboardEvent) {
    logicItemsListGlobalManager.handleWindowKeyDown(event);
}


winEE.on('mousedown', handleLogicItemsListMouseDown);
winEE.on('keydown', handleLogicItemsListKeyDown);

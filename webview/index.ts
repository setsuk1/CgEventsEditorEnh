import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

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

import { IncomingMessageType, OutgoingMessageType } from '@shared';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { editor } from './editor/CgEventsEditor';
import { msgHandler } from './msg/MessageHandler';
import { winEE } from './msg/WindowEventEmitter';
import { App } from './ui/App';
import { eventCardHeaderGlobalManager } from './ui/components/events/EventCardHeaderGlobalManager';
import { logicItemsListGlobalManager } from './ui/components/events/LogicItemsListGlobalManager';

self.MonacoEnvironment = {
    getWorkerUrl: function (_moduleId: string, label: string) {
        if (label === 'json') {
            return './monaco-workers/json.worker.js';
        }
        return './monaco-workers/editor.worker.js';
    }
};

export const vscode = acquireVsCodeApi();

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

msgHandler.on(IncomingMessageType.EVENTS_JSON, editor.setCgEventsJson, editor);
msgHandler.on(IncomingMessageType.EVENTS_SCHEMA_JSON, editor.setCgEventsSchema, editor);
msgHandler.on(IncomingMessageType.CGAPP, editor.setCgApp, editor);
msgHandler.on(IncomingMessageType.PROJECT_ITEMS, editor.setItems, editor);
msgHandler.on(IncomingMessageType.PROJECT_SOURCES, editor.setSources, editor);
msgHandler.on(IncomingMessageType.PROJECT_RESOURCES, editor.setResources, editor);
msgHandler.on(IncomingMessageType.SORTING_PRESETS, editor.setSortingPresets, editor);

const existing = document.getElementById('cgevents-root');
const container = existing ?? (() => {
    const el = document.createElement('div');
    el.id = 'cgevents-root';
    document.body.appendChild(el);
    return el;
})();

const root = createRoot(container);
root.render(React.createElement(App, { editor }));

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    if (target.isContentEditable) {
        return true;
    }
    return Boolean(target.closest('input, textarea, select, option, [contenteditable], .monaco-editor'));
}

function isPanelOpen(): boolean {
    if (document.body.classList.contains('cgenh-has-modal-open')) {
        return true;
    }
    return document.querySelector('.modal.show, .modal-backdrop.show') !== null;
}

function handleGlobalKeyDown(event: KeyboardEvent) {
    // if (event.defaultPrevented) {
    //     return;
    // }
    const hasCtrl = event.ctrlKey || event.metaKey;
    if (!hasCtrl) {
        return;
    }
    const key = event.key.toLowerCase();
    const isSave = key === 's';
    const isUndo = key === 'z';
    const isRedo = key === 'y';
    if (!isSave && !isUndo && !isRedo) {
        return;
    }
    if (isPanelOpen()) {
        return;
    }
    if (!isSave && isEditableTarget(event.target)) {
        return;
    }
    event.preventDefault();

    if (isSave) {
        const entry = editor.getCurrentEntry();
        if (entry) {
            msgHandler.send(OutgoingMessageType.SAVE, entry);
        }
        return;
    }
    if (isUndo) {
        editor.undo();
        return;
    }
    editor.redo();
}

function handleLogicItemsListMouseDown(event: MouseEvent) {
    logicItemsListGlobalManager.handleWindowMouseDown(event);
}

function handleLogicItemsListMouseMove(event: MouseEvent) {
    logicItemsListGlobalManager.handleWindowMouseMove(event);
}

function handleLogicItemsListKeyDown(event: KeyboardEvent) {
    logicItemsListGlobalManager.handleWindowKeyDown(event);
}

function handleEventCardHeaderKeyDown(event: KeyboardEvent) {
	eventCardHeaderGlobalManager.handleWindowKeyDown(event);
}

winEE.on('mousedown', handleLogicItemsListMouseDown);
winEE.on('mousemove', handleLogicItemsListMouseMove);
winEE.on('keydown', handleLogicItemsListKeyDown);
winEE.on('keydown', handleEventCardHeaderKeyDown);
winEE.on('keydown', handleGlobalKeyDown);

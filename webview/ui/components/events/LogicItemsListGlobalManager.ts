import { type EventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { contextMenuStateManager } from './ContextMenuState';
import { dragStateManager } from './DragState';
import { computeLogicRowInsertIndex, resolveLogicDropSection, resolveLogicSectionMetadata } from './LogicItemsListInteraction';
import { selectionStateManager } from './SelectionState';

export interface LogicItemsListGlobalClient {
	handleGlobalKeyDown(event: KeyboardEvent): void;
	setExternalDragInsertIndex(index: number | null): void;
}

const KEY_SEPARATOR = '\u0001';

export function createLogicItemsListKey(eventId: string, blockType: EventBlockType): string {
	return `${eventId}${KEY_SEPARATOR}${blockType}`;
}

export class LogicItemsListGlobalManager {
	private clientsByKey = new Map<string, LogicItemsListGlobalClient>();
	private activeKey: string | null = null;
	private contextMenuOwnerKey: string | null = null;
	private externalDragTargetKey: string | null = null;
	private dragHitTestFrame: number | null = null;
	private dragPointerX = 0;
	private dragPointerY = 0;
	private mouseMoveAttached = false;

	constructor() {
		dragStateManager.on('change', this.handleDragStateChange);
	}

	register(eventId: string, blockType: EventBlockType, client: LogicItemsListGlobalClient): void {
		this.clientsByKey.set(createLogicItemsListKey(eventId, blockType), client);
	}

	unregister(eventId: string, blockType: EventBlockType, client: LogicItemsListGlobalClient): void {
		const key = createLogicItemsListKey(eventId, blockType);
		if (this.clientsByKey.get(key) !== client) return;
		const dragState = dragStateManager.getState();
		if (dragState.isDragging && dragState.eventId === eventId && dragState.blockType === blockType) {
			dragStateManager.endDrag();
		}
		this.clientsByKey.delete(key);
		if (this.activeKey === key) this.activeKey = null;
		if (this.contextMenuOwnerKey === key) this.contextMenuOwnerKey = null;
		if (this.externalDragTargetKey === key) this.externalDragTargetKey = null;
	}

	setContextMenuOwner(eventId: string, blockType: EventBlockType): void {
		this.contextMenuOwnerKey = createLogicItemsListKey(eventId, blockType);
	}

	clearContextMenuOwner(eventId: string, blockType: EventBlockType): void {
		const key = createLogicItemsListKey(eventId, blockType);
		if (this.contextMenuOwnerKey === key) this.contextMenuOwnerKey = null;
	}

	handleWindowMouseDown(event: MouseEvent): void {
		const target = event.target;
		if (typeof Element === 'undefined' || !(target instanceof Element)) {
			contextMenuStateManager.closeAllContextMenus();
			this.contextMenuOwnerKey = null;
			this.activeKey = null;
			selectionStateManager.clearSelection();
			return;
		}

		if (target.closest('.cgenh-logic-context-menu')) return;

		contextMenuStateManager.closeAllContextMenus();
		this.contextMenuOwnerKey = null;

		const row = target.closest('.cgenh-logic-row');
		if (row) {
			this.activeKey = null;
			const section = row.closest('.cgenh-event-section');
			const metadata = section ? resolveLogicSectionMetadata(section) : undefined;
			if (metadata) {
				const key = createLogicItemsListKey(metadata.eventId, metadata.blockType);
				if (this.clientsByKey.has(key)) this.activeKey = key;
			}
			return;
		}

		this.activeKey = null;
		if (selectionStateManager.hasSelection()) selectionStateManager.clearSelection();
	}

	handleWindowKeyDown(event: KeyboardEvent): void {
		const key = this.contextMenuOwnerKey ?? this.activeKey;
		if (!key || event.isComposing) return;
		const shortcut = event.key.toLowerCase();
		const isClipboardShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && ['c', 'x', 'v'].includes(shortcut);
		if ((event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) && !isClipboardShortcut) return;
		this.clientsByKey.get(key)?.handleGlobalKeyDown(event);
	}

	private handleDragStateChange = (): void => {
		if (dragStateManager.getState().isDragging) {
			if (!this.mouseMoveAttached) {
				this.mouseMoveAttached = true;
				winEE.on('mousemove', this.handleWindowMouseMove);
			}
			return;
		}

		if (this.mouseMoveAttached) {
			this.mouseMoveAttached = false;
			winEE.off('mousemove', this.handleWindowMouseMove);
		}
		if (this.dragHitTestFrame !== null) {
			window.cancelAnimationFrame(this.dragHitTestFrame);
			this.dragHitTestFrame = null;
		}
		this.clearExternalDragTarget();
	};

	private handleWindowMouseMove = (event: MouseEvent): void => {
		this.dragPointerX = event.clientX;
		this.dragPointerY = event.clientY;
		if (this.dragHitTestFrame !== null) return;
		this.dragHitTestFrame = window.requestAnimationFrame(() => {
			this.dragHitTestFrame = null;
			this.updateDragTarget(this.dragPointerX, this.dragPointerY);
		});
	};

	private updateDragTarget(clientX: number, clientY: number): void {
		const dragState = dragStateManager.getState();
		const sourceEventId = dragState.eventId;
		const sourceBlockType = dragState.blockType;
		if (!dragState.isDragging || !sourceEventId || !sourceBlockType) {
			this.clearExternalDragTarget();
			return;
		}

		const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
		const dropSection = resolveLogicDropSection(elementsAtPoint);
		if (!dropSection || dropSection.blockType !== sourceBlockType || dropSection.eventId === sourceEventId) {
			this.clearExternalDragTarget();
			return;
		}

		const key = createLogicItemsListKey(dropSection.eventId, dropSection.blockType);
		const client = this.clientsByKey.get(key);
		if (!client) {
			this.clearExternalDragTarget();
			return;
		}

		const insertIndex = computeLogicRowInsertIndex(dropSection.itemsElement, elementsAtPoint, clientY);
		if (this.externalDragTargetKey && this.externalDragTargetKey !== key) this.clearExternalDragTarget();
		this.externalDragTargetKey = key;
		client.setExternalDragInsertIndex(insertIndex);
	}

	private clearExternalDragTarget(): void {
		const key = this.externalDragTargetKey;
		if (!key) return;
		this.externalDragTargetKey = null;
		this.clientsByKey.get(key)?.setExternalDragInsertIndex(null);
	}
}

export const logicItemsListGlobalManager = new LogicItemsListGlobalManager();

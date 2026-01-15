import { isEventBlockType, type EventBlockType } from '../../../editor/eventBlockTypes';
import { contextMenuStateManager } from './ContextMenuState';
import { dragStateManager } from './DragState';
import { computeLogicRowInsertIndex } from './LogicRowInsertIndex';
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

	register(eventId: string, blockType: EventBlockType, client: LogicItemsListGlobalClient): void {
		const key = createLogicItemsListKey(eventId, blockType);
		this.clientsByKey.set(key, client);
	}

	unregister(eventId: string, blockType: EventBlockType, client: LogicItemsListGlobalClient): void {
		const key = createLogicItemsListKey(eventId, blockType);
		const existing = this.clientsByKey.get(key);
		if (existing !== client) {
			return;
		}
		this.clientsByKey.delete(key);
		if (this.activeKey === key) {
			this.activeKey = null;
		}
		if (this.contextMenuOwnerKey === key) {
			this.contextMenuOwnerKey = null;
		}
		if (this.externalDragTargetKey === key) {
			this.externalDragTargetKey = null;
		}
	}

	setContextMenuOwner(eventId: string, blockType: EventBlockType): void {
		this.contextMenuOwnerKey = createLogicItemsListKey(eventId, blockType);
	}

	clearContextMenuOwner(eventId: string, blockType: EventBlockType): void {
		const key = createLogicItemsListKey(eventId, blockType);
		if (this.contextMenuOwnerKey === key) {
			this.contextMenuOwnerKey = null;
		}
	}

	handleWindowMouseDown(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			contextMenuStateManager.closeAllContextMenus();
			this.contextMenuOwnerKey = null;
			selectionStateManager.clearSelection();
			return;
		}

		if (target.closest('.cgenh-logic-context-menu')) {
			return;
		}

		contextMenuStateManager.closeAllContextMenus();
		this.contextMenuOwnerKey = null;

		const row = target.closest('.cgenh-logic-row');
		if (row) {
			const section = row.closest('.cgenh-event-section');
			const eventId = section?.getAttribute('data-event-id');
			const rawBlockType = section?.getAttribute('data-block-type');
			if (eventId && isEventBlockType(rawBlockType)) {
				const key = createLogicItemsListKey(eventId, rawBlockType);
				if (this.clientsByKey.has(key)) {
					this.activeKey = key;
				}
			}
			return;
		}

		if (selectionStateManager.hasSelection()) {
			selectionStateManager.clearSelection();
		}
	}

	handleWindowKeyDown(event: KeyboardEvent): void {
		const key = this.contextMenuOwnerKey ?? this.activeKey;
		if (!key) {
			return;
		}
		const client = this.clientsByKey.get(key);
		if (!client) {
			return;
		}
		client.handleGlobalKeyDown(event);
	}

	handleWindowMouseMove(event: MouseEvent): void {
		const dragState = dragStateManager.getState();
		const sourceEventId = dragState.eventId;
		const sourceBlockType = dragState.blockType;
		if (!dragState.isDragging || !sourceEventId || !sourceBlockType) {
			this.clearExternalDragTarget();
			return;
		}

		const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
		for (const elem of elementsAtPoint) {
			const itemsElem = elem.classList.contains('cgenh-event-section__items')
				? elem
				: elem.closest?.('.cgenh-event-section__items');
			if (!itemsElem) {
				continue;
			}

			const sectionElem = itemsElem.closest('.cgenh-event-section');
			const eventId = sectionElem?.getAttribute('data-event-id');
			const rawBlockType = sectionElem?.getAttribute('data-block-type');
			if (!eventId || !isEventBlockType(rawBlockType)) {
				break;
			}
			if (rawBlockType !== sourceBlockType) {
				break;
			}
			if (eventId === sourceEventId) {
				this.clearExternalDragTarget();
				return;
			}

			const key = createLogicItemsListKey(eventId, rawBlockType);
			const client = this.clientsByKey.get(key);
			if (!client) {
				this.clearExternalDragTarget();
				return;
			}

			const insertIndex = computeLogicRowInsertIndex(itemsElem, elementsAtPoint, event.clientY);

			if (this.externalDragTargetKey && this.externalDragTargetKey !== key) {
				this.clearExternalDragTarget();
			}
			this.externalDragTargetKey = key;
			client.setExternalDragInsertIndex(insertIndex);
			return;
		}

		this.clearExternalDragTarget();
	}

	private clearExternalDragTarget(): void {
		const key = this.externalDragTargetKey;
		if (!key) {
			return;
		}
		this.externalDragTargetKey = null;
		const client = this.clientsByKey.get(key);
		if (client) {
			client.setExternalDragInsertIndex(null);
		}
	}
}

export const logicItemsListGlobalManager = new LogicItemsListGlobalManager();


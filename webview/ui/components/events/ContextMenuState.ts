import type { EventBlockType } from '../../../editor/eventBlockTypes';
import { EventEmitter } from '../../../utils/EventEmitter';

export type LogicContextMenuOwner = 'list-item' | 'list-section' | 'section-header';

export function createLogicContextMenuId(
	owner: LogicContextMenuOwner,
	eventId: string,
	blockType: EventBlockType,
	index?: number,
): string {
	return JSON.stringify([owner, eventId, blockType, index ?? null]);
}

/**
 * Context menu state manager
 * Manages the global context menu state to ensure only one context menu is open at a time
 */
class ContextMenuStateManager extends EventEmitter {
	private currentMenuId: string | null = null;

	/**
	 * Opens a context menu and closes all others
	 * @param menuId Unique identifier for the context menu (e.g., `${eventId}-${blockType}-${index}`)
	 */
	openContextMenu(menuId: string) {
		if (this.currentMenuId !== menuId) {
			this.currentMenuId = menuId;
			this.emit('change');
		}
	}

	/**
	 * Closes the specified context menu if it's currently open
	 */
	closeContextMenu(menuId: string) {
		if (this.currentMenuId === menuId) {
			this.currentMenuId = null;
			this.emit('change');
		}
	}

	/**
	 * Closes all context menus
	 */
	closeAllContextMenus() {
		if (this.currentMenuId !== null) {
			this.currentMenuId = null;
			this.emit('change');
		}
	}

	/**
	 * Check if a specific context menu is currently open
	 */
	isOpen(menuId: string): boolean {
		return this.currentMenuId === menuId;
	}

	/**
	 * Check if the current menu is NOT the specified one (or none is open)
	 */
	shouldClose(menuId: string): boolean {
		return this.currentMenuId !== menuId;
	}
}

export const contextMenuStateManager = new ContextMenuStateManager();

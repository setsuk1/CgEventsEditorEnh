import { ICgEventLogicBlock } from '@shared';
import React from 'react';
import { createPortal } from 'react-dom';
import { editor } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { DynamicStyle } from '../../utils/dynamicStyles';
import { contextMenuStateManager, createLogicContextMenuId } from './ContextMenuState';
import { dragStateManager, type DraggedItem } from './DragState';
import { eventsNavigation } from './EventsNavigation';
import { logicItemsListGlobalManager } from './LogicItemsListGlobalManager';
import {
	areLogicSelectionSetsEqual,
	computeLogicDragAutoScrollDelta,
	computeLogicRowInsertIndex,
	isLogicInteractiveTarget,
	resolveLogicActiveIndex,
	resolveLogicDragSelection,
	resolveLogicDropSection,
	resolveLogicSelectionEntries,
} from './LogicItemsListInteraction';
import { SelectedItem, selectionStateManager } from './SelectionState';
import type { CheckSectionMeta } from './LogicItemsListCheckMeta';
import {
	computeCheckSectionMeta,
	computeLoopBreakUpdates,
	getLoopBreaks,
	normalizeLoopBreaks,
} from './LogicItemsListCheckMeta';
import { LogicItemsListContextMenu, type ContextMenuState } from './LogicItemsListContextMenu';
import {
	copyEntriesToClipboard,
	extractAllowedBlocks as extractClipboardBlocks,
	getLogicMenuEntriesForSection,
	getLogicSelectionEntriesWithBlocks,
	getLogicSelectionTargets,
	getToggleDisableLabel,
	pasteAt as pasteLogicEntriesAt,
	removeLogicEntries,
	sortLogicEntriesByEventOrder,
	toggleDisabledForEntries as toggleLogicEntriesDisabled,
} from './LogicItemsListMenuActions';
import { LogicItemsListEntry } from './LogicItemsListEntry';
import { LogicItemsListRow } from './LogicItemsListRow';
import { planLogicSelectionMove } from './LogicSelectionMove';
import { resolveLogicListShortcut } from './LogicItemsListShortcuts';

interface LogicItemsListProps {
	eventId: string;
	blockType: EventBlockType;
	schemaVersion?: number;
	sectionCollapsed: boolean;
	onToggleSectionCollapsed(): void;
	onRequestAddAt(targetIndex: number): void;
}

interface LogicItemsListState {
	contextMenu?: ContextMenuState;
	openDetailIndex?: number;
	openDetailNonce?: number;
	canPaste: boolean;
}

export class LogicItemsList extends React.Component<LogicItemsListProps, LogicItemsListState> {
	private itemRefs: Array<React.RefObject<HTMLDivElement>> = [];
	private dragActive = false;
	private dragPreviewStyle = new DynamicStyle('cgenh-drag-preview-pos');
	private dragPreviewCss = '';
	private checkRailStyles: Map<number, DynamicStyle> = new Map();
	private andLineStyles: Map<number, DynamicStyle> = new Map();
	private scrollContainer: HTMLElement | null = null;
	private autoScrollFrame: number | null = null;
	private autoScrollDelta = 0;
	private dragPreviewEntry: DraggedItem | null = null;
	private longPressTimeout: number | null = null;
	private longPressTriggered = false;
	private customDragStartX = 0;
	private customDragStartY = 0;
	private customDragThreshold = 5;
	private customDragSelection: DraggedItem[] = [];
	private dragHappened = false;
	private dragInsertIndex: number | null = null;
	private isDragging = false;
	private selectedIndices: Set<number> = new Set();
	private clearSelectionOnDragStart = false;
	// Dynamic drag listeners (added/removed during drag operations)
	private customDragMoveAttached = false;
	private customDragUpAttached = false;
	private dragOverAttached = false;
	private dragMouseUpCaptureAttached = false;
	private cachedCheckMeta: { items: ICgEventLogicBlock[]; meta: CheckSectionMeta } | null = null;
	private mounted = false;

	constructor(props: LogicItemsListProps) {
		super(props);
		this.state = {
			openDetailIndex: undefined,
			openDetailNonce: 0,
			canPaste: false,
			contextMenu: undefined as ContextMenuState | undefined,
		};
	}

	private handleSelectionChange = () => {
		const indexes = selectionStateManager.getSelectedIndicesForList(this.props.eventId, this.props.blockType);
		if (!areLogicSelectionSetsEqual(this.selectedIndices, indexes)) {
			this.selectedIndices = indexes;
			this.forceUpdate();
		}
	};

	private getItems(): Array<ICgEventLogicBlock> {
		return editor.getLogicBlocks(this.props.eventId, this.props.blockType);
	}

	private updateLoopBreaks(index: number, nextBreaks: number) {
		const items = this.getItems();
		const item = items[index];
		if (!item || !item.data) return;
		const breaks = normalizeLoopBreaks(nextBreaks);
		if (getLoopBreaks(item.data) === breaks) return;
		editor.updateLogicField(this.props.eventId, this.props.blockType, index, ['_loopBreaks'], breaks);
	}

	private updateLoopBreaksCascade(startIndex: number, delta: number) {
		const updates = computeLoopBreakUpdates(this.getItems(), startIndex, delta);
		for (const update of updates) {
			editor.updateLogicField(
				this.props.eventId,
				this.props.blockType,
				update.index,
				['_loopBreaks'],
				update.breaks,
			);
		}
	}

	private jumpToEvent(targetEventId: string) {
		const trimmed = targetEventId.trim();
		if (!trimmed) return;
		eventsNavigation.scrollToEvent(trimmed);
	}

	private handleWindowDragOver = (event: DragEvent) => {
		if (!this.dragActive) return;
		event.preventDefault();

		this.maybeAutoScroll(event.clientY);
	};

	private handleWindowMouseUp = () => {
		if (this.dragActive) {
			this.dragActive = false;
			this.resetAutoScrollState();
		}
	};

	private handleDragStateChange = () => {
		const dragState = dragStateManager.getState();

		if (!dragState.isDragging && this.dragInsertIndex !== null) {
			this.dragInsertIndex = null;
			this.forceUpdate();
		}
	};

	private shouldBlockRowInteraction(event: MouseEvent | React.MouseEvent): boolean {
		if (document.body.classList.contains('cgenh-has-modal-open')) return true;
		return isLogicInteractiveTarget(event.target);
	}

	private onCustomDragMouseDown = (event: React.MouseEvent, index: number) => {
		if (event.button !== 0) return;
		if (this.shouldBlockRowInteraction(event)) return;
		if (this.state.contextMenu) {
			this.closeContextMenu();
		}

		this.dragHappened = false;
		this.customDragStartX = event.clientX;
		this.customDragStartY = event.clientY;

		const { eventId, blockType } = this.props;
		const items = this.getItems();
		const clickedBlock = items[index];
		this.dragPreviewEntry = clickedBlock ? { eventId, blockType, index, block: clickedBlock } : null;
		const dragSelection = resolveLogicDragSelection(
			getLogicSelectionEntriesWithBlocks(blockType),
			this.dragPreviewEntry,
		);
		if (!dragSelection.entries.length) return;

		this.customDragSelection = dragSelection.entries;
		this.clearSelectionOnDragStart = dragSelection.clearExistingSelectionOnStart;

		if (!this.customDragMoveAttached) {
			winEE.on('mousemove', this.onCustomDragMouseMove);
			this.customDragMoveAttached = true;
		}
		if (!this.customDragUpAttached) {
			winEE.on('mouseup', this.onCustomDragMouseUp);
			this.customDragUpAttached = true;
		}
	};

	private resolveDropTarget(clientX: number, clientY: number): {
		eventId: string;
		blockType: EventBlockType;
		insertIndex: number;
	} | undefined {
		const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
		const dropSection = resolveLogicDropSection(elementsAtPoint);
		if (!dropSection) return undefined;
		return {
			eventId: dropSection.eventId,
			blockType: dropSection.blockType,
			insertIndex: computeLogicRowInsertIndex(dropSection.itemsElement, elementsAtPoint, clientY),
		};
	}

	private onCustomDragMouseMove = (event: MouseEvent) => {
		if (event.buttons === 0) {
			this.onCustomDragMouseUp(event);
			return;
		}
		const deltaX = event.clientX - this.customDragStartX;
		const deltaY = event.clientY - this.customDragStartY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		if (!this.isDragging && distance > this.customDragThreshold) {
			this.cancelLongPress();
			this.dragHappened = true;
			this.isDragging = true;
			this.closeContextMenu();
			this.dragActive = true;
			if (this.clearSelectionOnDragStart) {
				this.clearSelectionOnDragStart = false;
				selectionStateManager.clearSelection();
			}

			// Add drag-related listeners only when drag starts
			if (!this.dragOverAttached) {
				winEE.on('dragover', this.handleWindowDragOver);
				this.dragOverAttached = true;
			}
			if (!this.dragMouseUpCaptureAttached) {
				winEE.on('mouseup', this.handleWindowMouseUp);
				this.dragMouseUpCaptureAttached = true;
			}

			// Notify drag state manager
			dragStateManager.startDrag(this.props.eventId, this.props.blockType, this.customDragSelection);
		}

		if (this.isDragging) {
			event.preventDefault();

			// Update drag preview position via dynamic stylesheet to avoid re-render
			const nextCss = `left: ${event.clientX + 10}px; top: ${event.clientY + 10}px;`;
			if (this.dragPreviewCss !== nextCss) {
				this.dragPreviewCss = nextCss;
				this.dragPreviewStyle.update(nextCss);
			}

			let appliedInsert = false;
			const dropTarget = this.resolveDropTarget(event.clientX, event.clientY);
			if (
				dropTarget
				&& dropTarget.blockType === this.customDragSelection[0]?.blockType
				&& dropTarget.eventId === this.props.eventId
				&& dropTarget.blockType === this.props.blockType
			) {
				this.setInsertIndex(dropTarget.insertIndex);
				appliedInsert = true;
			}

			if (!appliedInsert && this.dragInsertIndex !== null) {
				this.dragInsertIndex = null;
				this.forceUpdate();
			}

			this.maybeAutoScroll(event.clientY);
		}
	};

	private detachCustomDragListeners(): void {
		if (this.customDragMoveAttached) {
			winEE.off('mousemove', this.onCustomDragMouseMove);
			this.customDragMoveAttached = false;
		}
		if (this.customDragUpAttached) {
			winEE.off('mouseup', this.onCustomDragMouseUp);
			this.customDragUpAttached = false;
		}
		if (this.dragOverAttached) {
			winEE.off('dragover', this.handleWindowDragOver);
			this.dragOverAttached = false;
		}
		if (this.dragMouseUpCaptureAttached) {
			winEE.off('mouseup', this.handleWindowMouseUp);
			this.dragMouseUpCaptureAttached = false;
		}
	}

	private resetCustomDragInteraction(): void {
		this.cancelLongPress();
		this.detachCustomDragListeners();
		this.isDragging = false;
		this.dragInsertIndex = null;
		this.dragActive = false;
		this.dragHappened = false;
		this.resetAutoScrollState();
		this.dragPreviewEntry = null;
		this.customDragSelection = [];
		this.clearSelectionOnDragStart = false;
	}

	private onCustomDragMouseUp = (event: MouseEvent) => {
		this.detachCustomDragListeners();

		if (this.dragHappened) {
			const dropTarget = this.resolveDropTarget(event.clientX, event.clientY);
			if (
				dropTarget
				&& this.customDragSelection.length > 0
				&& dropTarget.blockType === this.customDragSelection[0].blockType
			) {
				this.moveGlobalSelection(dropTarget.eventId, dropTarget.insertIndex);
			}
		}

		this.resetCustomDragInteraction();
		this.forceUpdate();

		// Notify drag state manager
		dragStateManager.endDrag();
	};

	private moveGlobalSelection(targetEventId: string, targetIndex: number) {
		const sourceSelection = sortLogicEntriesByEventOrder(this.customDragSelection);

		if (!sourceSelection.length) return;

		const blockType = sourceSelection[0].blockType;
		const moveEntries: Array<{ eventId: string; index: number; block: ICgEventLogicBlock }> = [];
		for (let i = 0; i < sourceSelection.length; i++) {
			const entry = sourceSelection[i];
			if (entry?.block) {
				moveEntries.push({ eventId: entry.eventId, index: entry.index, block: entry.block });
			}
		}
		if (!moveEntries.length) return;

		const movePlan = planLogicSelectionMove(sourceSelection, targetEventId, targetIndex);
		if (!movePlan) {
			selectionStateManager.clearSelection();
			return;
		}

		editor.moveLogicSelectionToEvent(blockType, moveEntries, targetEventId, movePlan.targetIndex);

		selectionStateManager.clearSelection();
	}

	private duplicateAt(index: number) {
		const items = this.getItems();
		const currentItem = items[index];
		if (!currentItem) return;

		const insertAt = index + 1;
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false }, () => {
			editor.insertLogic(this.props.eventId, this.props.blockType, currentItem, insertAt);
		});

		selectionStateManager.clearSelection();
	}

	private getActiveIndex(): number | undefined {
		const ctx = this.state.contextMenu;
		const contextIndex = ctx?.mode === 'item' ? ctx.index : undefined;
		const matchingSelection = this.selectedIndices.size > 0
			? []
			: getLogicSelectionEntriesWithBlocks(this.props.blockType)
				.filter((item) => item.eventId === this.props.eventId)
				.map((item) => item.index);
		return resolveLogicActiveIndex(contextIndex, this.selectedIndices, matchingSelection);
	}

	private collectSelectionEntries(fallbackIndex?: number): SelectedItem[] {
		const entries = getLogicSelectionEntriesWithBlocks(this.props.blockType);
		const fallbackBlock = fallbackIndex === undefined ? undefined : this.getItems()[fallbackIndex];
		const fallbackEntry = fallbackIndex !== undefined && fallbackBlock
			? {
				eventId: this.props.eventId,
				blockType: this.props.blockType,
				index: fallbackIndex,
				block: fallbackBlock,
			}
			: undefined;
		return resolveLogicSelectionEntries(entries, fallbackEntry);
	}

	private getContextMenuEntries(ctx: ContextMenuState): SelectedItem[] {
		if (ctx.mode === 'item') {
			return this.collectSelectionEntries(ctx.index);
		}
		return getLogicMenuEntriesForSection(this.props.eventId, this.props.blockType);
	}

	private async copyEntries(selectionEntries: SelectedItem[], options?: { removeAfterCopy?: boolean }) {
		const { eventId, blockType } = this.props;
		const ctx = this.state.contextMenu;
		await copyEntriesToClipboard(blockType, selectionEntries, options);
		if (!this.mounted || this.props.eventId !== eventId || this.props.blockType !== blockType) return;
		this.setState((state) => {
			if (state.contextMenu !== ctx) return null;
			return { contextMenu: undefined as ContextMenuState | undefined, canPaste: false };
		});
	}

	private removeSelection(fallbackIndex?: number) {
		const selectionEntries = this.collectSelectionEntries(fallbackIndex);
		if (!selectionEntries.length) return;
		this.removeEntries(selectionEntries);
	}

	private toggleDisableSelection(fallbackIndex?: number) {
		const selectionEntries = this.collectSelectionEntries(fallbackIndex);
		if (!selectionEntries.length) return;
		this.toggleDisabledForEntries(selectionEntries);
	}

	private removeEntries(selectionEntries: SelectedItem[]) {
		if (!selectionEntries.length) return;
		removeLogicEntries(this.props.blockType, selectionEntries);
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false });
	}

	private toggleDisabledForEntries(selectionEntries: SelectedItem[]) {
		if (!selectionEntries.length) return;
		toggleLogicEntriesDisabled(this.props.blockType, selectionEntries);
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false });
	}

	private async copySelection(fallbackIndex?: number, options?: { removeAfterCopy?: boolean }) {
		const selectionEntries = this.collectSelectionEntries(fallbackIndex);
		await this.copyEntries(selectionEntries, options);
	}

	public copyFromListMenu() {
		const entries = getLogicMenuEntriesForSection(this.props.eventId, this.props.blockType);
		void this.copyEntries(entries);
	}

	public cutFromListMenu() {
		const entries = getLogicMenuEntriesForSection(this.props.eventId, this.props.blockType);
		void this.copyEntries(entries, { removeAfterCopy: true });
	}

	public pasteFromListMenu() {
		const items = this.getItems();
		void this.pasteAt(items.length);
	}

	public toggleDisableFromListMenu() {
		const entries = getLogicMenuEntriesForSection(this.props.eventId, this.props.blockType);
		this.toggleDisabledForEntries(entries);
	}

	public getToggleDisableListLabel() {
		const entries = getLogicMenuEntriesForSection(this.props.eventId, this.props.blockType);
		return getToggleDisableLabel(entries, true);
	}

	public removeFromListMenu() {
		const entries = getLogicMenuEntriesForSection(this.props.eventId, this.props.blockType);
		this.removeEntries(entries);
	}

	public selectAllListItems() {
		const { eventId, blockType } = this.props;
		const items = this.getItems();
		if (!items.length) return;
		selectionStateManager.selectAllForList(eventId, blockType, items.length);
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false });
	}

	private moveSelectionToTop(fallbackIndex?: number) {
		const blockType = this.props.blockType;
		const entries = getLogicSelectionTargets(blockType, this.collectSelectionEntries(fallbackIndex));
		if (!entries.length) return;
		editor.moveLogicSelectionToTop(blockType, entries);
		selectionStateManager.clearSelection();
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false });
	}

	private moveSelectionToBottom(fallbackIndex?: number) {
		const blockType = this.props.blockType;
		const entries = getLogicSelectionTargets(blockType, this.collectSelectionEntries(fallbackIndex));
		if (!entries.length) return;
		editor.moveLogicSelectionToBottom(blockType, entries);
		selectionStateManager.clearSelection();
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false });
	}

	private async pasteAt(targetIndex: number) {
		const { eventId, blockType } = this.props;
		const ctx = this.state.contextMenu;
		const inserted = await pasteLogicEntriesAt(
			eventId,
			blockType,
			targetIndex,
			() =>
				this.mounted &&
				this.props.eventId === eventId &&
				this.props.blockType === blockType &&
				this.state.contextMenu === ctx,
		);
		if (!inserted) return;
		this.setState((state) => state.contextMenu === ctx ? { contextMenu: undefined as ContextMenuState | undefined, canPaste: false } : null);
	}

	private extractAllowedBlocks(text: string): ICgEventLogicBlock[] {
		return extractClipboardBlocks(text, this.props.blockType);
	}

	private async refreshPasteAvailability() {
		const ctx = this.state.contextMenu;
		if (!ctx) {
			if (this.state.canPaste) {
				this.setState({ canPaste: false });
			}
			return;
		}
		let text = '';
		if (navigator?.clipboard?.readText) {
			try {
				text = await navigator.clipboard.readText();
			} catch {
				// ignore
			}
		}
		const canPaste = text ? this.extractAllowedBlocks(text).length > 0 : false;
		if (!this.mounted) return;
		this.setState((state) => {
			if (state.contextMenu !== ctx || state.canPaste === canPaste) return null;
			return { canPaste };
		});
	}

	private setup(): void {
		// State managers
		dragStateManager.on('change', this.handleDragStateChange);
		selectionStateManager.on('change', this.handleSelectionChange);
		contextMenuStateManager.on('change', this.handleContextMenuStateChange);
	}

	private dispose(): void {
		// State managers
		dragStateManager.off('change', this.handleDragStateChange);
		selectionStateManager.off('change', this.handleSelectionChange);
		contextMenuStateManager.off('change', this.handleContextMenuStateChange);
	}

	componentDidMount(): void {
		this.mounted = true;
		this.setup();
		logicItemsListGlobalManager.register(this.props.eventId, this.props.blockType, this);
		this.handleSelectionChange();
	}

	componentDidUpdate(prevProps: LogicItemsListProps, prevState: LogicItemsListState): void {
		if (prevProps.eventId !== this.props.eventId || prevProps.blockType !== this.props.blockType) {
			this.resetCustomDragInteraction();
			logicItemsListGlobalManager.clearContextMenuOwner(prevProps.eventId, prevProps.blockType);
			logicItemsListGlobalManager.unregister(prevProps.eventId, prevProps.blockType, this);
			logicItemsListGlobalManager.register(this.props.eventId, this.props.blockType, this);
			this.setState({
				openDetailIndex: undefined,
				contextMenu: undefined as ContextMenuState | undefined,
				canPaste: false,
			});
			this.cachedCheckMeta = null;
			this.selectedIndices = new Set();
			this.handleSelectionChange();
		}
		if (prevState.contextMenu !== this.state.contextMenu) {
			if (this.state.contextMenu) {
				logicItemsListGlobalManager.setContextMenuOwner(this.props.eventId, this.props.blockType);
			} else {
				logicItemsListGlobalManager.clearContextMenuOwner(this.props.eventId, this.props.blockType);
			}
		}
		if (this.state.contextMenu && this.state.contextMenu !== prevState.contextMenu) {
			this.refreshPasteAvailability();
		}
	}

	componentWillUnmount(): void {
		this.mounted = false;
		this.resetCustomDragInteraction();
		logicItemsListGlobalManager.clearContextMenuOwner(this.props.eventId, this.props.blockType);
		logicItemsListGlobalManager.unregister(this.props.eventId, this.props.blockType, this);
		this.dispose();
		this.dragPreviewStyle.dispose();
		this.disposeStyleMap(this.checkRailStyles);
		this.disposeStyleMap(this.andLineStyles);
	}

	private handleContextMenuStateChange = () => {
		// Close our context menu if another one opened
		if (this.state.contextMenu) {
			const menuId =
				this.state.contextMenu.mode === 'item'
					? this.getItemContextMenuId(this.state.contextMenu.index)
					: this.getSectionContextMenuId();
			if (contextMenuStateManager.shouldClose(menuId)) {
				this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false });
			}
		}
	};

	private closeContextMenu = () => {
		if (!this.state.contextMenu) return;
		const menuId =
			this.state.contextMenu.mode === 'item'
				? this.getItemContextMenuId(this.state.contextMenu.index)
				: this.getSectionContextMenuId();
		contextMenuStateManager.closeContextMenu(menuId);
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false });
	};

	private getItemContextMenuId(index: number): string {
		return createLogicContextMenuId('list-item', this.props.eventId, this.props.blockType, index);
	}

	private getSectionContextMenuId(): string {
		return createLogicContextMenuId('list-section', this.props.eventId, this.props.blockType);
	}

	public handleGlobalKeyDown = (event: KeyboardEvent) => {
		const ctx = this.state.contextMenu;
		const activeIndex = this.getActiveIndex();
		const shortcut = resolveLogicListShortcut({
			key: event.key,
			repeat: event.repeat,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
			shiftKey: event.shiftKey,
			modalOpen: document.body.classList.contains('cgenh-has-modal-open'),
			interactiveTarget: isLogicInteractiveTarget(event.target),
			contextMode: ctx?.mode,
			hasActiveIndex: activeIndex !== undefined,
		});
		if (!shortcut) return;
		if (shortcut.consume) {
			event.preventDefault();
			event.stopPropagation();
		}

		const items = this.getItems();
		switch (shortcut.action) {
			case 'escape':
				selectionStateManager.clearSelection();
				this.closeContextMenu();
				return;
			case 'section-copy':
			case 'section-cut': {
				if (!ctx || ctx.mode !== 'section') return;
				const menuSelection = this.getContextMenuEntries(ctx);
				if (!menuSelection.length) return;
				void this.copyEntries(menuSelection, {
					removeAfterCopy: shortcut.action === 'section-cut',
				});
				return;
			}
			case 'section-paste':
				if (this.state.canPaste) void this.pasteAt(items.length);
				return;
			case 'selection-copy':
			case 'selection-cut':
				if (activeIndex !== undefined) {
					void this.copySelection(activeIndex, {
						removeAfterCopy: shortcut.action === 'selection-cut',
					});
				}
				return;
			case 'selection-paste':
				if (activeIndex !== undefined) void this.pasteAt(activeIndex + 1);
				return;
			case 'section-toggle':
				this.toggleSectionCollapsed();
				return;
			case 'section-add':
				this.requestAddAt(items.length);
				return;
			case 'section-toggle-disabled':
			case 'section-remove': {
				if (!ctx || ctx.mode !== 'section') return;
				const menuSelection = this.getContextMenuEntries(ctx);
				if (shortcut.action === 'section-toggle-disabled') {
					this.toggleDisabledForEntries(menuSelection);
				} else {
					this.removeEntries(menuSelection);
				}
				return;
			}
		}

		if (!ctx || ctx.mode !== 'item') return;
		switch (shortcut.action) {
			case 'item-edit':
				this.triggerEdit(ctx.index);
				break;
			case 'item-remove':
				this.removeSelection(ctx.index);
				break;
			case 'item-top':
				this.moveSelectionToTop(ctx.index);
				break;
			case 'item-bottom':
				this.moveSelectionToBottom(ctx.index);
				break;
			case 'item-toggle-disabled':
				this.toggleDisableSelection(ctx.index);
				break;
			case 'item-toggle-section':
				this.toggleSectionCollapsed();
				break;
			case 'item-add':
				this.requestAddAt(ctx.index);
				break;
			case 'item-duplicate':
				this.duplicateAt(ctx.index);
				break;
		}
	};

	private requestAddAt(targetIndex: number) {
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false }, () => {
			this.props.onRequestAddAt(targetIndex);
		});
	}

	private toggleSectionCollapsed() {
		this.setState({ contextMenu: undefined as ContextMenuState | undefined, canPaste: false }, () => {
			this.props.onToggleSectionCollapsed();
		});
	}

	private shouldSuppressContextMenu(event: React.MouseEvent): boolean {
		return document.body.classList.contains('cgenh-has-modal-open') || isLogicInteractiveTarget(event.target);
	}

	private openContextMenu = (event: React.MouseEvent, index: number) => {
		if (this.shouldSuppressContextMenu(event)) {
			return;
		}
		event.preventDefault();

		event.stopPropagation();
		this.showItemContextMenu(index, event.clientX, event.clientY);
	};

	private openSectionContextMenu = (event: React.MouseEvent) => {
		if (this.shouldSuppressContextMenu(event)) {
			return;
		}
		event.preventDefault();

		event.stopPropagation();
		this.showSectionContextMenu(event.clientX, event.clientY);
	};

	private showItemContextMenu(index: number, clientX: number, clientY: number) {
		const menuId = this.getItemContextMenuId(index);
		contextMenuStateManager.openContextMenu(menuId);
		this.setState({
			contextMenu: {
				mode: 'item',
				x: clientX,
				y: clientY,
				index,
				targetEventId: this.props.eventId,
				targetIndex: String(index),
				blockType: this.props.blockType,
			},
			canPaste: false,
		});
	}

	private showSectionContextMenu(clientX: number, clientY: number) {
		const menuId = this.getSectionContextMenuId();
		contextMenuStateManager.openContextMenu(menuId);
		this.setState({
			contextMenu: {
				mode: 'section',
				x: clientX,
				y: clientY,
				targetEventId: this.props.eventId,
				blockType: this.props.blockType,
			},
			canPaste: false,
		});
	}

	private openContextMenuFromButton = (index: number) => {
		const el = this.itemRefs[index]?.current;
		if (!el) return;

		// Toggle if already open on the same item
		if (
			this.state.contextMenu &&
			this.state.contextMenu.mode === 'item' &&
			this.state.contextMenu.index === index &&
			this.state.contextMenu.targetEventId === this.props.eventId &&
			this.state.contextMenu.blockType === this.props.blockType
		) {
			this.closeContextMenu();
			return;
		}
		const rect = el.getBoundingClientRect();
		const x = rect.right + 12;
		const y = rect.bottom + 6;
		this.showItemContextMenu(index, x, y);
	};

	private openDetailFromButton(index: number) {
		this.setState((prev) => ({
			contextMenu: undefined as ContextMenuState | undefined,
			openDetailIndex: index,
			openDetailNonce: (prev.openDetailNonce ?? 0) + 1,
			canPaste: false,
		}));
	}

	private triggerEdit(index: number) {
		this.setState((prev) => ({
			contextMenu: undefined as ContextMenuState | undefined,
			openDetailIndex: index,
			openDetailNonce: (prev.openDetailNonce ?? 0) + 1,
			canPaste: false,
		}));
		selectionStateManager.clearSelection();

	}

	private toggleSelection(index: number) {
		const { eventId, blockType } = this.props;
		const items = this.getItems();
		if (!items[index]) return;

		const activeSection = selectionStateManager.getActiveSection();
		if (activeSection && activeSection !== blockType) {
			selectionStateManager.clearSelection();
		}
		selectionStateManager.toggleIndex(eventId, blockType, index);
	}

	private stopAutoScroll() {
		if (this.autoScrollFrame !== null) {
			cancelAnimationFrame(this.autoScrollFrame);
			this.autoScrollFrame = null;
		}
		this.autoScrollDelta = 0;
	}

	private resetAutoScrollState() {
		this.stopAutoScroll();
		this.scrollContainer = null;
	}

	private startLongPress(index: number) {
		this.cancelLongPress();
		this.longPressTriggered = false;
		this.longPressTimeout = window.setTimeout(() => {
			this.longPressTriggered = true;
			this.toggleSelection(index);
		}, 450);
	}

	private cancelLongPress() {
		if (this.longPressTimeout !== null) {
			window.clearTimeout(this.longPressTimeout);
			this.longPressTimeout = null;
		}
	}

	private getScrollContainer(): HTMLElement | null {
		if (this.scrollContainer && this.scrollContainer.isConnected) {
			return this.scrollContainer;
		}
		const main = document.querySelector('.cgenh-app-main');
		if (main instanceof HTMLElement) {
			const overflowY = getComputedStyle(main).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') {
				this.scrollContainer = main;
				return main;
			}
		}
		const scrollingElement = document.scrollingElement;
		if (scrollingElement instanceof HTMLElement) {
			this.scrollContainer = scrollingElement;
			return scrollingElement;
		}
		const documentElement = document.documentElement;
		if (documentElement instanceof HTMLElement) {
			this.scrollContainer = documentElement;
			return documentElement;
		}
		const body = document.body;
		this.scrollContainer = body instanceof HTMLElement ? body : null;
		return this.scrollContainer;
	}

	private maybeAutoScroll(clientY: number) {
		const scrollContainer = this.getScrollContainer();
		if (!scrollContainer) {
			this.stopAutoScroll();
			return;
		}

		const doc = scrollContainer.ownerDocument;
		const scrollingElement = doc ? doc.scrollingElement : null;
		const view = doc?.defaultView ?? window;
		const isDocumentScroll = scrollContainer === scrollingElement || scrollContainer === document.documentElement || scrollContainer === document.body;
		const containerRect = isDocumentScroll
			? { top: 0, bottom: view.innerHeight }
			: scrollContainer.getBoundingClientRect();
		const delta = computeLogicDragAutoScrollDelta(clientY, containerRect);

		this.autoScrollDelta = delta;
		if (!this.dragActive || delta === 0) {
			this.stopAutoScroll();
			return;
		}
		if (this.autoScrollFrame === null) {
			const step = () => {
				if (!this.dragActive || this.autoScrollDelta === 0) {
					this.stopAutoScroll();
					return;
				}
				const container = this.getScrollContainer();
				if (container) {
					const doc = container.ownerDocument;
					const scrollingElement = doc ? doc.scrollingElement : null;
					const isDocumentScroll = container === scrollingElement || container === document.documentElement || container === document.body;
					if (isDocumentScroll) {
						const view = doc?.defaultView ?? window;
						view.scrollBy(0, this.autoScrollDelta);
					} else {
						container.scrollTop += this.autoScrollDelta;
					}
				}
				this.autoScrollFrame = requestAnimationFrame(step);
			};
			this.autoScrollFrame = requestAnimationFrame(step);
		}
	}

	private setInsertIndex(index: number) {
		if (this.dragInsertIndex !== index) {
			this.dragInsertIndex = index;
			this.forceUpdate();
		}
	}

	public setExternalDragInsertIndex(index: number | null): void {
		if (index === null) {
			if (this.dragInsertIndex !== null) {
				this.dragInsertIndex = null;
				this.forceUpdate();
			}
			return;
		}
		this.setInsertIndex(index);
	}

	private syncItemRefs(itemsLength: number) {
		if (this.itemRefs.length === itemsLength) {
			return;
		}
		if (this.itemRefs.length < itemsLength) {
			for (let i = this.itemRefs.length; i < itemsLength; i++) {
				this.itemRefs[i] = React.createRef<HTMLDivElement>();
			}
			return;
		}
		this.itemRefs = this.itemRefs.slice(0, itemsLength);
	}

	private getCheckSectionMeta(items: ICgEventLogicBlock[]): CheckSectionMeta {
		if (this.cachedCheckMeta && this.cachedCheckMeta.items === items) {
			return this.cachedCheckMeta.meta;
		}
		const meta = computeCheckSectionMeta(items);
		this.cachedCheckMeta = { items, meta };
		return meta;
	}

	private handleContainerContextMenu = (event: React.MouseEvent) => {
		if (event.target instanceof HTMLElement && event.target.closest('.cgenh-logic-row')) return;
		this.openSectionContextMenu(event);
	};

	private handleRowContextMenu = (index: number, event: React.MouseEvent) => {
		this.openContextMenu(event, index);
	};

	private handleRowMouseDown = (index: number, event: React.MouseEvent) => {
		if (event.button !== 0) return;
		if (this.shouldBlockRowInteraction(event)) return;
		if (event.detail > 1) {
			this.cancelLongPress();
			return;
		}
		const isCheckSection = this.props.blockType === 'check';
		const isCheckBodyTarget = isCheckSection && event.target instanceof HTMLElement
			? Boolean(event.target.closest('.cgenh-check-body'))
			: false;
		if (!isCheckSection || isCheckBodyTarget) {
			this.startLongPress(index);
		}
		this.onCustomDragMouseDown(event, index);
	};

	private handleRowMouseUp = (index: number, event: React.MouseEvent) => {
		if (event.button !== 0) return;
		if (this.shouldBlockRowInteraction(event)) {
			this.cancelLongPress();
			return;
		}
		const wasDrag = this.dragHappened;
		const wasClick = !this.longPressTriggered && !wasDrag;
		this.cancelLongPress();

		if (wasClick) {
			const isCheckSection = this.props.blockType === 'check';
			const isCheckBodyTarget = isCheckSection && event.target instanceof HTMLElement
				? Boolean(event.target.closest('.cgenh-check-body'))
				: false;
			if (selectionStateManager.hasSelection() && (!isCheckSection || isCheckBodyTarget)) {
				this.toggleSelection(index);
			}
		}

		this.longPressTriggered = false;
	};

	private handleRowMouseLeave = (_index: number) => {
		this.cancelLongPress();
	};

	private handleOpenDetailFromButton = (index: number) => {
		this.openDetailFromButton(index);
	};

	private handleIndentLeft = (index: number) => {
		this.updateLoopBreaksCascade(index, 1);
	};

	private handleIndentRight = (index: number, currentBreaks: number) => {
		this.updateLoopBreaks(index, Math.max(0, currentBreaks - 1));
	};

	private handleJumpToEvent = (eventId: string) => {
		this.jumpToEvent(eventId);
	};

	private getCheckRailClass = (width: number): string => {
		let style = this.checkRailStyles.get(width);
		if (!style) {
			style = new DynamicStyle('cgenh-check-rail');
			style.update(`width: ${width}px; min-width: ${width}px;`);
			this.checkRailStyles.set(width, style);
		}
		return style.className;
	};

	private getAndLineClass = (offset: number): string => {
		let style = this.andLineStyles.get(offset);
		if (!style) {
			style = new DynamicStyle('cgenh-check-rail-and');
			style.update(`right: calc(var(--cgenh-rail-and-offset) + ${offset}px);`);
			this.andLineStyles.set(offset, style);
		}
		return style.className;
	};

	private disposeStyleMap(map: Map<number, DynamicStyle>) {
		map.forEach((style) => style.dispose());
		map.clear();
	}

	render() {
		const { blockType, eventId } = this.props;
		const items = this.getItems();
		const isCheckSection = blockType === 'check';
		const checkMeta = isCheckSection ? this.getCheckSectionMeta(items) : null;

		this.syncItemRefs(items.length);

		const isEmpty = items.length === 0;
		const containerClass = [
			'cgenh-event-section__items',
			'd-flex',
			'flex-column',
			'cgenh-logic-items-gap',
			isEmpty ? 'text-body-secondary' : '',
			this.dragInsertIndex !== null ? 'user-select-none' : '',
		].filter(Boolean).join(' ');

		const indicatorBorderClass =
			blockType === 'trigger'
				? 'border-success'
				: blockType === 'check'
					? 'border-warning'
					: 'border-info';
		const dropIndicator = <div className={`border-top border-3 ${indicatorBorderClass} my-2`} />;

		let dragSelectionIndices: Set<number> | null = null;
		if (this.isDragging && this.customDragSelection.length > 0) {
			dragSelectionIndices = new Set<number>();
			for (const sel of this.customDragSelection) {
				if (sel.eventId === eventId && sel.blockType === blockType) {
					dragSelectionIndices.add(sel.index);
				}
			}
		}

		let contextMenu: React.ReactNode = null;
		const ctx = this.state.contextMenu;
		if (ctx) {
			const menuSelection = this.getContextMenuEntries(ctx);
			contextMenu = (
				<LogicItemsListContextMenu
					ctx={ctx}
					blockType={blockType}
					itemsLength={items.length}
					sectionCollapsed={this.props.sectionCollapsed}
					canPaste={this.state.canPaste}
					menuSelection={menuSelection}
					toggleDisableListLabel={getToggleDisableLabel(menuSelection, true)}
					toggleDisableItemLabel={getToggleDisableLabel(menuSelection, false)}
					onClose={this.closeContextMenu}
					onToggleSectionCollapsed={() => this.toggleSectionCollapsed()}
					onSelectAllListItems={() => this.selectAllListItems()}
					onRequestAddAt={(targetIndex) => this.requestAddAt(targetIndex)}
					onDuplicateAt={(index) => this.duplicateAt(index)}
					onCopyEntries={(entries, options) => this.copyEntries(entries, options)}
					onPasteAt={(targetIndex) => this.pasteAt(targetIndex)}
					onToggleDisabledForEntries={(entries) => this.toggleDisabledForEntries(entries)}
					onRemoveEntries={(entries) => this.removeEntries(entries)}
					onEdit={(index) => this.triggerEdit(index)}
					onMoveSelectionToTop={(index) => this.moveSelectionToTop(index)}
					onMoveSelectionToBottom={(index) => this.moveSelectionToBottom(index)}
				/>
			);
		}

		const dragPreviewEntry = this.dragPreviewEntry;
		const dragPreview = this.isDragging && dragPreviewEntry
			? createPortal(
				<div
						className={`shadow-lg cgenh-drag-preview ${this.dragPreviewStyle.className}`}
				>
					{this.customDragSelection.length > 1 ? (
						<div className="position-relative">
							<div className="badge text-bg-secondary position-absolute top-0 start-0 translate-middle">
								{this.customDragSelection.length}
							</div>
							<LogicItemsListEntry
								item={dragPreviewEntry.block}
								eventId={dragPreviewEntry.eventId}
								blockType={dragPreviewEntry.blockType}
								index={dragPreviewEntry.index}
								disabled={dragPreviewEntry.block.data?.disabled === true}
								onOpenMenu={this.openContextMenuFromButton}
								onEdit={this.handleOpenDetailFromButton}
							/>
						</div>
					) : (
						<LogicItemsListEntry
							item={dragPreviewEntry.block}
							eventId={dragPreviewEntry.eventId}
							blockType={dragPreviewEntry.blockType}
							index={dragPreviewEntry.index}
							disabled={dragPreviewEntry.block.data?.disabled === true}
							onOpenMenu={this.openContextMenuFromButton}
							onEdit={this.handleOpenDetailFromButton}
						/>
					)}
				</div>,
				document.body
			)
			: null;

		return (
			<div className={containerClass} onContextMenu={this.handleContainerContextMenu}>
				{this.dragInsertIndex === 0 && isEmpty && dropIndicator}
				{isEmpty && !this.isDragging && (
					<p className="mb-0 small text-body-secondary" onContextMenu={this.openSectionContextMenu}>
						{translation.logic.empty[blockType].getTrans()}
					</p>
				)}
				{items.map((item, idx) => {
					const openDetailNonce = this.state.openDetailIndex === idx ? this.state.openDetailNonce : undefined;
					const isSelected = this.selectedIndices.has(idx);
					const selectedPrev = isSelected && this.selectedIndices.has(idx - 1);
					const selectedNext = isSelected && this.selectedIndices.has(idx + 1);
					const isDraggedItem = this.isDragging && dragSelectionIndices ? dragSelectionIndices.has(idx) : false;
					let showDropIndicator = this.dragInsertIndex === idx;
					if (showDropIndicator && isDraggedItem && dragSelectionIndices && dragSelectionIndices.has(idx - 1)) {
						showDropIndicator = false;
					}
					const disabled = item.data?.disabled === true;
					const isFirst = idx === 0;
					const isLast = idx === items.length - 1;
					const key = editor.getLogicBlockUiKey(item);

					const commonRowProps = {
						eventId,
						blockType,
						index: idx,
						item,
						schemaVersion: this.props.schemaVersion,
						openDetailNonce,
						isFirst,
						isLast,
						disabled,
						isSelected,
						selectedPrev,
						selectedNext,
						isDraggedItem,
						showDropIndicator,
						indicatorBorderClass,
						rowRef: this.itemRefs[idx],
						onContextMenu: this.handleRowContextMenu,
						onMouseDown: this.handleRowMouseDown,
						onMouseUp: this.handleRowMouseUp,
						onMouseLeave: this.handleRowMouseLeave,
						onOpenMenu: this.openContextMenuFromButton,
						onEdit: this.handleOpenDetailFromButton,
					};

					if (!isCheckSection || !checkMeta) {
						return (
							<LogicItemsListRow
								key={key}
								{...commonRowProps}
								isCheckSection={false}
							/>
						);
					}

					const level = checkMeta.levels[idx];
					const breaks = checkMeta.breaks[idx];
					const currentElseEventId = checkMeta.elseEventIdByIndex[idx];
					const prevElseEventId = idx > 0 ? checkMeta.elseEventIdByIndex[idx - 1] : undefined;
					const prevHasElse = Boolean(prevElseEventId);
					const currentHasElse = Boolean(currentElseEventId);
					const prevLevel = idx > 0 ? checkMeta.levels[idx - 1] : level;
					const nextLevel = idx + 1 < items.length ? checkMeta.levels[idx + 1] : level;
					const joinTop = selectedPrev && !prevHasElse && prevLevel <= level;
					const joinBottom = selectedNext && !currentHasElse && nextLevel < level;

					return (
						<LogicItemsListRow
							key={key}
							{...commonRowProps}
							isCheckSection={true}
							hasHierarchy={checkMeta.hasHierarchy}
							level={level}
							breaks={breaks}
							loopDisabled={checkMeta.loopDisabledByIndex[idx]}
							loopIndicator={checkMeta.loopStates[idx]}
							joinTop={joinTop}
							joinBottom={joinBottom}
							currentElseEventId={currentElseEventId}
							andLineLevels={checkMeta.andLineLevelsByRow[idx]}
							andStart={checkMeta.andStartByIndex[idx]}
							andEnd={checkMeta.andEndByIndex[idx]}
							showOr={checkMeta.showOrByIndex[idx]}
							hasNot={checkMeta.hasNotByIndex[idx]}
							getCheckRailClass={this.getCheckRailClass}
							getAndLineClass={this.getAndLineClass}
							onIndentLeft={this.handleIndentLeft}
							onIndentRight={this.handleIndentRight}
							onJumpToEvent={this.handleJumpToEvent}
						/>
					);
				})}
				{this.dragInsertIndex === items.length && items.length > 0 && dropIndicator}
				{contextMenu}
				{dragPreview}
			</div>
		);
	}
}

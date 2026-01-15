import { ICgEventLogicBlock } from '@shared';
import React from 'react';
import { createPortal } from 'react-dom';
import { editor } from '../../../editor/CgEventsEditor';
import { EventBlockType, isEventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { DynamicStyle } from '../../utils/dynamicStyles';
import { contextMenuStateManager } from './ContextMenuState';
import { dragStateManager, type DraggedItem } from './DragState';
import { eventsNavigation } from './EventsNavigation';
import { logicItemsListGlobalManager } from './LogicItemsListGlobalManager';
import { computeLogicRowInsertIndex } from './LogicRowInsertIndex';
import { SelectedItem, selectionStateManager } from './SelectionState';
import type { CheckSectionMeta, LoopIndicatorState } from './LogicItemsListCheckMeta';
import { computeCheckSectionMeta } from './LogicItemsListCheckMeta';
import { LogicItemsListContextMenu, type ContextMenuState } from './LogicItemsListContextMenu';
import { LogicItemsListEntry } from './LogicItemsListEntry';
import { LogicItemsListRow } from './LogicItemsListRow';

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
	private dragPreviewRef: React.RefObject<HTMLDivElement> = React.createRef();
	private dragPreviewX = 0;
	private dragPreviewY = 0;
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
	private customDragBlocks: ICgEventLogicBlock[] = [];
	private customDragSelection: DraggedItem[] = [];
	private dragHappened = false;
	private dragInsertIndex: number | null = null;
	private isDragging = false;
	private selectionMode = false;
	private selectedIndices: Set<number> = new Set();
	private clearSelectionOnDragStart = false;
	// Dynamic drag listeners (added/removed during drag operations)
	private customDragMoveAttached = false;
	private customDragUpAttached = false;
	private dragOverAttached = false;
	private dragMouseUpCaptureAttached = false;
	private cachedCheckMeta: { items: ICgEventLogicBlock[]; meta: CheckSectionMeta } | null = null;

	constructor(props: LogicItemsListProps) {
		super(props);
		this.state = {
			openDetailIndex: undefined,
			openDetailNonce: 0,
			canPaste: false,
			contextMenu: undefined,
		};
	}

	private handleSelectionChange = () => {
		const indexes = selectionStateManager.getSelectedIndicesForList(this.props.eventId, this.props.blockType);
		const selectionIsActive = selectionStateManager.getActiveSection() === this.props.blockType && indexes.size > 0;
		if (
			this.selectionMode !== selectionIsActive ||
			!this.setsAreEqual(this.selectedIndices, indexes)
		) {
			this.selectionMode = selectionIsActive;
			this.selectedIndices = indexes;
			this.forceUpdate();
		}
	};

	private setsAreEqual<T>(a: Set<T>, b: Set<T>): boolean {
		if (a.size !== b.size) return false;
		for (const item of a) {
			if (!b.has(item)) return false;
		}
		return true;
	}

	private getItems(): Array<ICgEventLogicBlock> {
		return editor.getLogicBlocks(this.props.eventId, this.props.blockType);
	}

	private getSelectionEntriesWithBlocks(): DraggedItem[] {
		const activeSection = selectionStateManager.getActiveSection();
		if (activeSection !== this.props.blockType) return [];
		const selection = selectionStateManager.getSelection();
		const entries: DraggedItem[] = [];
		for (let i = 0; i < selection.length; i++) {
			const item = selection[i];
			if (item.blockType !== activeSection) continue;
			const block = editor.getLogicBlock(item.eventId, activeSection, item.index);
			if (!block) {
				continue;
			}
			entries.push({
				eventId: item.eventId,
				blockType: activeSection,
				index: item.index,
				block,
			});
		}
		return entries;
	}

	private getEventOrder(eventId: string): number {
		const index = editor.getEventIndex(eventId);
		return index === -1 ? Number.MAX_SAFE_INTEGER : index;
	}

	private getLoopBreaks(data?: Record<string, unknown>): number {
		if (!data) return 0;
		const raw = data['_loopBreaks'];
		if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
		return Math.max(0, Math.floor(raw));
	}

	private getLoopState(data?: Record<string, unknown>): LoopIndicatorState {
		if (!data) return { isLoop: false, showSigma: false };
		const raw = data['donotActOnEachPass'];
		if (typeof raw === 'boolean') {
			return { isLoop: true, showSigma: raw };
		}
		return { isLoop: false, showSigma: false };
	}

	private updateLoopBreaks(index: number, nextBreaks: number) {
		const items = this.getItems();
		const item = items[index];
		if (!item || !item.data) return;
		const breaks = Math.max(0, Math.floor(nextBreaks));
		if (this.getLoopBreaks(item.data) === breaks) return;
		editor.updateLogicField(this.props.eventId, this.props.blockType, index, ['_loopBreaks'], breaks);
	}

	private updateLoopBreaksCascade(startIndex: number, delta: number) {
		if (delta <= 0) return;
		const items = this.getItems();
		if (startIndex < 0 || startIndex >= items.length) return;
		let nextLevel = 0;
		for (let i = 0; i < startIndex; i++) {
			const item = items[i];
			const loopState = this.getLoopState(item?.data);
			const breaks = this.getLoopBreaks(item?.data);
			const level = Math.max(0, nextLevel - breaks);
			nextLevel = level + (loopState.isLoop ? 1 : 0);
		}
		for (let i = startIndex; i < items.length; i++) {
			const item = items[i];
			const data = item?.data;
			const loopState = this.getLoopState(data);
			const breaks = this.getLoopBreaks(data);
			const incomingLevel = nextLevel;
			const maxBreaks = Math.max(0, Math.floor(incomingLevel));
			let nextBreaks = breaks;
			if (i === startIndex) {
				nextBreaks = Math.min(breaks + delta, maxBreaks);
			} else if (breaks > maxBreaks) {
				nextBreaks = maxBreaks;
			}
			let appliedBreaks = breaks;
			if (data && nextBreaks !== breaks) {
				editor.updateLogicField(this.props.eventId, this.props.blockType, i, ['_loopBreaks'], nextBreaks);
				appliedBreaks = nextBreaks;
			}
			const level = Math.max(0, incomingLevel - appliedBreaks);
			nextLevel = level + (loopState.isLoop ? 1 : 0);
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

	private isInteractiveTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const el = target;
		if (el.isContentEditable) return true;
		return Boolean(
			el.closest(
				'input, textarea, select, option, button, [contenteditable], .monaco-editor, .cgenh-json-editor, .cgenh-config-field, .cgenh-configs-panel__panel, .cgenh-base-settings__panel, .selector-panel'
			)
		);
	}

	private shouldBlockRowInteraction(event: MouseEvent | React.MouseEvent): boolean {
		if (document.body.classList.contains('cgenh-has-modal-open')) return true;
		return this.isInteractiveTarget(event.target);
	}

	private onCustomDragMouseDown = (event: React.MouseEvent, index: number) => {
		if (event.button !== 0) return;
		if (this.shouldBlockRowInteraction(event)) return;
		if (event.target instanceof HTMLElement && event.target.closest('button')) {
			return;
		}
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
		const selectionEntries = this.getSelectionEntriesWithBlocks();
		let clickedIsSelected = false;
		for (let i = 0; i < selectionEntries.length; i++) {
			const entry = selectionEntries[i];
			if (entry.eventId === eventId && entry.index === index) {
				clickedIsSelected = true;
				break;
			}
		}

		const baseSelection = selectionEntries.length > 0 && clickedIsSelected
			? selectionEntries
			: (clickedBlock ? [{ eventId, blockType, index, block: clickedBlock }] : []);
		if (!baseSelection.length) return;

		this.customDragBlocks = baseSelection.map((item) => item.block);
		this.customDragSelection = baseSelection;
		this.clearSelectionOnDragStart = selectionEntries.length > 0 && !clickedIsSelected;

		if (!this.customDragMoveAttached) {
			winEE.on('mousemove', this.onCustomDragMouseMove, this);
			this.customDragMoveAttached = true;
		}
		if (!this.customDragUpAttached) {
			winEE.on('mouseup', this.onCustomDragMouseUp, this);
			this.customDragUpAttached = true;
		}
	};

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
				winEE.on('dragover', this.handleWindowDragOver, this);
				this.dragOverAttached = true;
			}
			if (!this.dragMouseUpCaptureAttached) {
				winEE.on('mouseup', this.handleWindowMouseUp, this);
				this.dragMouseUpCaptureAttached = true;
			}

			// Notify drag state manager
			dragStateManager.startDrag(this.props.eventId, this.props.blockType, this.customDragSelection);
		}

		if (this.isDragging) {
			event.preventDefault();

			// Update drag preview position via dynamic stylesheet to avoid re-render
			this.dragPreviewX = event.clientX;
			this.dragPreviewY = event.clientY;
			const nextCss = `left: ${event.clientX + 10}px; top: ${event.clientY + 10}px;`;
			if (this.dragPreviewCss !== nextCss) {
				this.dragPreviewCss = nextCss;
				this.dragPreviewStyle.update(nextCss);
			}

			let appliedInsert = false;
			const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
			for (const elem of elementsAtPoint) {
				const itemsElem = elem.classList.contains('cgenh-event-section__items')
					? elem
					: elem.closest?.('.cgenh-event-section__items');
				if (!itemsElem) continue;

				const sectionElem = itemsElem.closest('.cgenh-event-section');
				if (!sectionElem) continue;
				const dropTargetEventId = sectionElem.getAttribute('data-event-id');
				const rawEventBlockType = sectionElem.getAttribute('data-block-type');
				if (!isEventBlockType(rawEventBlockType)) {
					break;
				}
				const dropTargetSection = rawEventBlockType;

				if (dropTargetSection === this.customDragSelection[0]?.blockType) {
					const insertIdx = computeLogicRowInsertIndex(itemsElem, elementsAtPoint, event.clientY);

					if (dropTargetEventId === this.props.eventId && dropTargetSection === this.props.blockType) {
						this.setInsertIndex(insertIdx);
						appliedInsert = true;
					}
				}
				break;
			}

			if (!appliedInsert && this.dragInsertIndex !== null) {
				this.dragInsertIndex = null;
				this.forceUpdate();
			}

			this.maybeAutoScroll(event.clientY);
		}
	};

	private onCustomDragMouseUp = (event: MouseEvent) => {
		const items = this.getItems();
		if (this.customDragMoveAttached) {
			winEE.off('mousemove', this.onCustomDragMouseMove, this);
			this.customDragMoveAttached = false;
		}
		if (this.customDragUpAttached) {
			winEE.off('mouseup', this.onCustomDragMouseUp, this);
			this.customDragUpAttached = false;
		}

		// Remove drag-related listeners added when drag started
		if (this.isDragging) {
			if (this.dragOverAttached) {
				winEE.off('dragover', this.handleWindowDragOver, this);
				this.dragOverAttached = false;
			}
			if (this.dragMouseUpCaptureAttached) {
				winEE.off('mouseup', this.handleWindowMouseUp, this);
				this.dragMouseUpCaptureAttached = false;
			}
		}

		if (this.dragHappened) {
			let dropTargetEventId = this.props.eventId;
			let targetIndex = this.dragInsertIndex ?? items.length;
			let validDropTarget = false;

			const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
			for (const elem of elementsAtPoint) {
				const itemsElem = elem.classList.contains('cgenh-event-section__items')
					? elem
					: elem.closest?.('.cgenh-event-section__items');
				if (!itemsElem) continue;

				const sectionElem = itemsElem.closest('.cgenh-event-section');
				if (sectionElem) {
					const eventId = sectionElem.getAttribute('data-event-id');
					const rawEventBlockType = sectionElem.getAttribute('data-block-type');
					if (!isEventBlockType(rawEventBlockType)) {
						break;
					}
					const blockType = rawEventBlockType;

					if (eventId && this.customDragSelection.length > 0 && blockType === this.customDragSelection[0].blockType) {
						dropTargetEventId = eventId;
						validDropTarget = true;

						targetIndex = computeLogicRowInsertIndex(itemsElem, elementsAtPoint, event.clientY);
					}
				}
				break;
			}

			if (validDropTarget) {
				this.moveGlobalSelection(dropTargetEventId, targetIndex);
			}
		}

		this.isDragging = false;
		this.dragInsertIndex = null;
		this.forceUpdate();
		this.dragPreviewX = 0;
		this.dragPreviewY = 0;
		this.dragActive = false;
		this.dragHappened = false;
		this.resetAutoScrollState();
		this.dragPreviewEntry = null;
		this.customDragBlocks = [];
		this.customDragSelection = [];
		this.clearSelectionOnDragStart = false;

		// Notify drag state manager
		dragStateManager.endDrag();
	};

	private moveGlobalSelection(targetEventId: string, targetIndex: number) {
		const sourceSelection = this.sortSelectionEntries(this.customDragSelection);

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

		const targetSelection = sourceSelection.filter((item) => item.eventId === targetEventId);
		if (targetSelection.length) {
			const indices = targetSelection.map((item) => item.index).sort((a, b) => a - b);
			if (indices.length) {
				const selectionIsSingleEvent = sourceSelection.every((item) => item.eventId === targetEventId);
				if (selectionIsSingleEvent) {
					const first = indices[0];
					const last = indices[indices.length - 1];
					if (targetIndex >= first && targetIndex <= last + 1) {
						selectionStateManager.clearSelection();
						return;
					}
				}

				const removedBefore = targetSelection.reduce((count, item) => (item.index < targetIndex ? count + 1 : count), 0);
				targetIndex = Math.max(0, targetIndex - removedBefore);
			}
		}

		editor.moveLogicSelectionToEvent(blockType, moveEntries, targetEventId, targetIndex);

		selectionStateManager.clearSelection();
	}

	private duplicateAt(index: number) {
		const items = this.getItems();
		const currentItem = items[index];
		if (!currentItem) return;

		const insertAt = index + 1;
		this.setState({ contextMenu: undefined, canPaste: false }, () => {
			editor.insertLogic(this.props.eventId, this.props.blockType, currentItem, insertAt);
		});

		selectionStateManager.clearSelection();
	}

	private removeSelectionEntries(selectionEntries: SelectedItem[]) {
		const blockType = this.props.blockType;
		const entries: Array<{ eventId: string; index: number }> = [];
		for (const item of selectionEntries) {
			if (item.blockType !== blockType) continue;
			entries.push({ eventId: item.eventId, index: item.index });
		}
		if (!entries.length) return;
		editor.removeLogicSelection(blockType, entries);
	}

	private getActiveIndex(): number | undefined {
		const ctx = this.state.contextMenu;
		if (ctx && ctx.mode === 'item') {
			return ctx.index;
		}
		if (this.selectedIndices.size > 0) {
			let min = Number.MAX_SAFE_INTEGER;
			this.selectedIndices.forEach((val) => { if (val < min) min = val; });
			return min === Number.MAX_SAFE_INTEGER ? undefined : min;
		}
		const matchingSelection = this.getSelectionEntriesWithBlocks()
			.filter((item) => item.eventId === this.props.eventId)
			.map((item) => item.index);
		if (matchingSelection.length > 0) {
			let min = Number.MAX_SAFE_INTEGER;
			for (let i = 0; i < matchingSelection.length; i++) {
				if (matchingSelection[i] < min) {
					min = matchingSelection[i];
				}
			}
			return min === Number.MAX_SAFE_INTEGER ? undefined : min;
		}
		return undefined;
	}

	private collectSelectionEntries(fallbackIndex?: number): SelectedItem[] {
		const blockType = this.props.blockType;
		const entries = this.getSelectionEntriesWithBlocks();
		if (entries.length > 0) {
			return entries;
		}
		const items = this.getItems();
		if (fallbackIndex !== undefined && items[fallbackIndex]) {
			return [{
				eventId: this.props.eventId,
				blockType: blockType,
				index: fallbackIndex,
				block: items[fallbackIndex],
			}];
		}
		return [];
	}

	private getSectionEntries(): SelectedItem[] {
		const entries: SelectedItem[] = [];
		const { eventId, blockType } = this.props;
		const items = this.getItems();
		for (let i = 0; i < items.length; i++) {
			const block = items[i];
			if (!block) continue;
			entries.push({ eventId, blockType: blockType, index: i, block });
		}
		return entries;
	}

	private getMenuEntriesForSection(): SelectedItem[] {
		const selectionEntries = this.collectSelectionEntries();
		if (selectionEntries.length > 0) {
			return selectionEntries;
		}
		return this.getSectionEntries();
	}

	private getContextMenuEntries(ctx: ContextMenuState): SelectedItem[] {
		if (ctx.mode === 'item') {
			return this.collectSelectionEntries(ctx.index);
		}
		return this.getMenuEntriesForSection();
	}

	private getSelectionDisabledState(selectionEntries: SelectedItem[]): { hasEnabled: boolean; hasDisabled: boolean } {
		let hasEnabled = false;
		let hasDisabled = false;
		for (const entry of selectionEntries) {
			if (!entry.block) continue;
			const data = entry.block.data;
			const disabled = data ? data['disabled'] === true : false;
			if (disabled) {
				hasDisabled = true;
			} else {
				hasEnabled = true;
			}
			if (hasEnabled && hasDisabled) break;
		}
		return { hasEnabled, hasDisabled };
	}

	private getToggleDisableLabel(selectionEntries: SelectedItem[], isList: boolean): string {
		const { hasEnabled, hasDisabled } = this.getSelectionDisabledState(selectionEntries);
		if (hasEnabled && !hasDisabled) {
			return isList ? translation.state.disableList.getTrans() : translation.state.disable.getTrans();
		}
		if (!hasEnabled && hasDisabled) {
			return isList ? translation.state.enableList.getTrans() : translation.state.enable.getTrans();
		}
		return isList ? translation.state.enableDisableList.getTrans() : translation.state.enableDisable.getTrans();
	}

	private async copyEntries(selectionEntries: SelectedItem[], options?: { removeAfterCopy?: boolean }) {
		const sortedEntries = this.sortSelectionEntries(selectionEntries);
		const blocks = sortedEntries
			.map((sel) => sel.block)
			.filter((block): block is ICgEventLogicBlock => Boolean(block));
		if (!blocks.length) return;

		const payload = { type: this.props.blockType, blocks };
		const text = JSON.stringify(payload, null, 2);

		const writeClipboard = async () => {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
			return false;
		};

		let copied = false;
		try {
			copied = await writeClipboard();
		} catch {
			// fallback below
		}

		if (!copied) {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.className = 'cgenh-clipboard-sink';
			document.body.appendChild(ta);
			ta.select();
			try {
				document.execCommand('copy');
				copied = true;
			} finally {
				document.body.removeChild(ta);
			}
		}

		if (copied && options?.removeAfterCopy) {
			this.removeSelectionEntries(sortedEntries);
		}

		selectionStateManager.clearSelection();
		this.setState({ contextMenu: undefined });
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
		this.removeSelectionEntries(selectionEntries);
		selectionStateManager.clearSelection();

		this.setState({ contextMenu: undefined, canPaste: false });
	}

	private toggleDisabledForEntries(selectionEntries: SelectedItem[]) {
		if (!selectionEntries.length) return;
		const blockType = this.props.blockType;
		const entries: Array<{ eventId: string; index: number }> = [];
		for (const entry of selectionEntries) {
			if (entry.blockType !== blockType) continue;
			entries.push({ eventId: entry.eventId, index: entry.index });
		}
		if (!entries.length) return;
		editor.toggleLogicDisabledSelection(blockType, entries);
		selectionStateManager.clearSelection();

		this.setState({ contextMenu: undefined, canPaste: false });
	}

	private async copySelection(fallbackIndex?: number, options?: { removeAfterCopy?: boolean }) {
		const selectionEntries = this.collectSelectionEntries(fallbackIndex);
		await this.copyEntries(selectionEntries, options);
	}

	public copyFromListMenu() {
		const entries = this.getMenuEntriesForSection();
		void this.copyEntries(entries);
	}

	public cutFromListMenu() {
		const entries = this.getMenuEntriesForSection();
		void this.copyEntries(entries, { removeAfterCopy: true });
	}

	public pasteFromListMenu() {
		const items = this.getItems();
		void this.pasteAt(items.length);
	}

	public toggleDisableFromListMenu() {
		const entries = this.getMenuEntriesForSection();
		this.toggleDisabledForEntries(entries);
	}

	public getToggleDisableListLabel() {
		const entries = this.getMenuEntriesForSection();
		return this.getToggleDisableLabel(entries, true);
	}

	public removeFromListMenu() {
		const entries = this.getMenuEntriesForSection();
		this.removeEntries(entries);
	}

	public selectAllListItems() {
		const { eventId, blockType } = this.props;
		const items = this.getItems();
		if (!items.length) return;
		selectionStateManager.selectAllForList(eventId, blockType, items.length);
		this.setState({ contextMenu: undefined, canPaste: false });
	}

	private moveSelectionToTop(fallbackIndex?: number) {
		const selectionEntries = this.collectSelectionEntries(fallbackIndex);
		if (!selectionEntries.length) return;
		const blockType = this.props.blockType;
		const entries: Array<{ eventId: string; index: number }> = [];
		for (let i = 0; i < selectionEntries.length; i++) {
			const entry = selectionEntries[i];
			if (entry.blockType !== blockType) continue;
			entries.push({ eventId: entry.eventId, index: entry.index });
		}
		if (!entries.length) return;
		editor.moveLogicSelectionToTop(blockType, entries);
		selectionStateManager.clearSelection();

		this.setState({ contextMenu: undefined, canPaste: false });
	}

	private moveSelectionToBottom(fallbackIndex?: number) {
		const selectionEntries = this.collectSelectionEntries(fallbackIndex);
		if (!selectionEntries.length) return;
		const blockType = this.props.blockType;
		const entries: Array<{ eventId: string; index: number }> = [];
		for (let i = 0; i < selectionEntries.length; i++) {
			const entry = selectionEntries[i];
			if (entry.blockType !== blockType) continue;
			entries.push({ eventId: entry.eventId, index: entry.index });
		}
		if (!entries.length) return;
		editor.moveLogicSelectionToBottom(blockType, entries);
		selectionStateManager.clearSelection();

		this.setState({ contextMenu: undefined, canPaste: false });
	}

	private sortSelectionEntries(entries: SelectedItem[]): SelectedItem[] {
		return [...entries].sort((a, b) => {
			if (a.eventId === b.eventId) {
				return a.index - b.index;
			}
			const eventOrder = this.getEventOrder(a.eventId) - this.getEventOrder(b.eventId);
			if (eventOrder !== 0) return eventOrder;
			return a.eventId.localeCompare(b.eventId);
		});
	}

	private async pasteAt(targetIndex: number) {
		let text = '';
		if (navigator?.clipboard?.readText) {
			try {
				text = await navigator.clipboard.readText();
			} catch {
				// fall back to prompt
			}
		}
		if (!text) {
			text = window.prompt(translation.list.pastePrompt.getTrans()) ?? '';
		}
		if (!text.trim()) return;
		try {
			const allowed = this.extractAllowedBlocks(text);
			if (!allowed.length) return;
			editor.insertLogicBlocks(this.props.eventId, this.props.blockType, allowed, targetIndex);
			selectionStateManager.clearSelection();

			this.setState({ contextMenu: undefined, canPaste: false });
		} catch {
			// ignore cgenh-invalid JSON
		}
	}

	private extractAllowedBlocks(text: string): ICgEventLogicBlock[] {
		let parsed: any;
		try {
			parsed = JSON.parse(text);
		} catch {
			return [];
		}
		let blocks: any[] = [];
		if (parsed?.type === this.props.blockType && Array.isArray(parsed?.blocks)) {
			blocks = parsed.blocks;
		} else if (Array.isArray(parsed)) {
			blocks = parsed;
		}
		if (!blocks.length) return [];
		return blocks
			.map((block) => ({
				type: typeof block?.type === 'string' ? block.type : '',
				data: block?.data ?? {},
			}));
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
		if (!text) {
			if (this.state.canPaste) this.setState({ canPaste: false });
			return;
		}
		const allowed = this.extractAllowedBlocks(text);
		this.setState({ canPaste: allowed.length > 0 });
	}

	private setup(): void {
		// State managers
		dragStateManager.on('change', this.handleDragStateChange, this);
		selectionStateManager.on('change', this.handleSelectionChange, this);
		contextMenuStateManager.on('change', this.handleContextMenuStateChange, this);
	}

	private dispose(): void {
		// State managers
		dragStateManager.off('change', this.handleDragStateChange, this);
		selectionStateManager.off('change', this.handleSelectionChange, this);
		contextMenuStateManager.off('change', this.handleContextMenuStateChange, this);
	}

	componentDidMount(): void {
		this.setup();
		logicItemsListGlobalManager.register(this.props.eventId, this.props.blockType, this);
		this.handleSelectionChange();
	}

	componentDidUpdate(prevProps: LogicItemsListProps, prevState: LogicItemsListState): void {
		if (prevProps.eventId !== this.props.eventId || prevProps.blockType !== this.props.blockType) {
			logicItemsListGlobalManager.clearContextMenuOwner(prevProps.eventId, prevProps.blockType);
			logicItemsListGlobalManager.unregister(prevProps.eventId, prevProps.blockType, this);
			logicItemsListGlobalManager.register(this.props.eventId, this.props.blockType, this);
			this.setState({
				openDetailIndex: undefined,
				contextMenu: undefined,
				canPaste: false,
			});
			this.dragInsertIndex = null;
			this.isDragging = false;
			this.cachedCheckMeta = null;
			this.selectionMode = false;
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
		logicItemsListGlobalManager.clearContextMenuOwner(this.props.eventId, this.props.blockType);
		logicItemsListGlobalManager.unregister(this.props.eventId, this.props.blockType, this);
		this.dispose();
		// Remove dynamically added drag listeners if still active
		if (this.customDragMoveAttached) {
			winEE.off('mousemove', this.onCustomDragMouseMove, this);
			this.customDragMoveAttached = false;
		}
		if (this.customDragUpAttached) {
			winEE.off('mouseup', this.onCustomDragMouseUp, this);
			this.customDragUpAttached = false;
		}
		if (this.dragOverAttached) {
			winEE.off('dragover', this.handleWindowDragOver, this);
			this.dragOverAttached = false;
		}
		if (this.dragMouseUpCaptureAttached) {
			winEE.off('mouseup', this.handleWindowMouseUp, this);
			this.dragMouseUpCaptureAttached = false;
		}
		this.stopAutoScroll();
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
				this.setState({ contextMenu: undefined, canPaste: false });
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
		this.setState({ contextMenu: undefined, canPaste: false });
	};

	private getItemContextMenuId(index: number): string {
		return `${this.props.eventId}-${this.props.blockType}-${index}`;
	}

	private getSectionContextMenuId(): string {
		return `${this.props.eventId}-${this.props.blockType}-section`;
	}

	public handleGlobalKeyDown = (event: KeyboardEvent) => {
		if (document.body.classList.contains('cgenh-has-modal-open')) {
			return;
		}
		if (event.repeat) {
			return;
		}
		const key = event.key.toLowerCase();
		const ctx = this.state.contextMenu;
		const items = this.getItems();
		if (this.isInteractiveTarget(event.target)) {
			return;
		}
		if (event.key === 'Escape') {
			selectionStateManager.clearSelection();
			this.closeContextMenu();
		}
		if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x'].includes(key)) {
			if (ctx && ctx.mode === 'section') {
				event.preventDefault();

				event.stopPropagation();
				if (key === 'v') {
					if (this.state.canPaste) {
						this.pasteAt(items.length);
					}
					return;
				}
				const menuSelection = this.getContextMenuEntries(ctx);
				if (menuSelection.length === 0) return;
				if (key === 'c') {
					void this.copyEntries(menuSelection);
				} else {
					void this.copyEntries(menuSelection, { removeAfterCopy: true });
				}
				return;
			}
			const targetIndex = this.getActiveIndex();
			if (targetIndex !== undefined) {
				event.preventDefault();

				event.stopPropagation();
				if (key === 'v') {
					this.pasteAt(targetIndex + 1);
				} else {
					this.copySelection(targetIndex, { removeAfterCopy: key === 'x' });
				}
				return;
			}
		}
		if (event.ctrlKey || event.metaKey) {
			return;
		}
		if (!ctx) return;
		if (ctx.mode === 'section') {
			if (['c', 'n', 'a', 'r'].includes(key)) {
				event.preventDefault();

				event.stopPropagation();
			}
			if (key === 'c') {
				this.toggleSectionCollapsed();
			} else if (key === 'n') {
				this.requestAddAt(items.length);
			} else if (key === 'a' || key === 'r') {
				const menuSelection = this.getContextMenuEntries(ctx);
				if (key === 'a') {
					this.toggleDisabledForEntries(menuSelection);
				} else {
					this.removeEntries(menuSelection);
				}
			}
			return;
		}

		if (['r', 't', 'b', 'a', 'e', 'c', 'n', 'd'].includes(key)) {
			event.preventDefault();

			event.stopPropagation();
		}
		switch (key) {
			case 'e':
				this.triggerEdit(ctx.index);
				break;
			case 'r':
				this.removeSelection(ctx.index);
				break;
			case 't':
				this.moveSelectionToTop(ctx.index);
				break;
			case 'b':
				this.moveSelectionToBottom(ctx.index);
				break;
			case 'a':
				this.toggleDisableSelection(ctx.index);
				break;
			case 'c':
				this.toggleSectionCollapsed();
				break;
			case 'n':
				this.requestAddAt(ctx.index);
				break;
			case 'd':
				this.duplicateAt(ctx.index);
				break;
		}
	};

	private requestAddAt(targetIndex: number) {
		this.setState({ contextMenu: undefined, canPaste: false }, () => {
			this.props.onRequestAddAt(targetIndex);
		});
	}

	private toggleSectionCollapsed() {
		this.setState({ contextMenu: undefined, canPaste: false }, () => {
			this.props.onToggleSectionCollapsed();
		});
	}

	private shouldSuppressContextMenu(event: React.MouseEvent): boolean {
		// Don't open the custom menu while a modal/editor overlay is cgenh-active so native menus can be used.
		if (document.body.classList.contains('cgenh-has-modal-open')) {
			return true;
		}
		if (!(event.target instanceof HTMLElement)) return false;
		const target = event.target;
		if (target.isContentEditable) return true;

		// Skip inputs/editors so users can use the native context menu for copy/paste.
		const interactiveAncestor = target.closest(
			'input, textarea, select, option, button, [contenteditable], .monaco-editor, .cgenh-json-editor, .cgenh-config-field, .cgenh-configs-panel__panel, .cgenh-base-settings__panel, .selector-panel'
		);
		return Boolean(interactiveAncestor);
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
			contextMenu: undefined,
			openDetailIndex: index,
			openDetailNonce: (prev.openDetailNonce ?? 0) + 1,
			canPaste: false,
		}));
	}

	private triggerEdit(index: number) {
		this.setState((prev) => ({
			contextMenu: undefined,
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
		const edge = 80;
		const maxSpeed = 20;
		let delta = 0;

		// Check if cursor is near top edge of scroll container
		if (clientY < containerRect.top + edge && clientY >= containerRect.top) {
			const intensity = Math.min(1, (containerRect.top + edge - clientY) / edge);
			delta = -Math.max(4, Math.round(intensity * maxSpeed));
		}
		// Check if cursor is near bottom edge of scroll container
		else if (clientY > containerRect.bottom - edge && clientY <= containerRect.bottom) {
			const intensity = Math.min(1, (clientY - (containerRect.bottom - edge)) / edge);
			delta = Math.max(4, Math.round(intensity * maxSpeed));
		}

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
					toggleDisableListLabel={this.getToggleDisableLabel(menuSelection, true)}
					toggleDisableItemLabel={this.getToggleDisableLabel(menuSelection, false)}
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
					ref={this.dragPreviewRef}
					className={`shadow-lg cgenh-drag-preview ${this.dragPreviewStyle.className}`}
				>
					{this.customDragBlocks.length > 1 ? (
						<div className="position-relative">
							<div className="badge text-bg-secondary position-absolute top-0 start-0 translate-middle">
								{this.customDragBlocks.length}
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

					if (!isCheckSection || !checkMeta) {
						return (
							<LogicItemsListRow
								key={key}
								isCheckSection={false}
								eventId={eventId}
								blockType={blockType}
								index={idx}
								item={item}
								schemaVersion={this.props.schemaVersion}
								openDetailNonce={openDetailNonce}
								isFirst={isFirst}
								isLast={isLast}
								disabled={disabled}
								isSelected={isSelected}
								selectedPrev={selectedPrev}
								selectedNext={selectedNext}
								isDraggedItem={isDraggedItem}
								showDropIndicator={showDropIndicator}
								indicatorBorderClass={indicatorBorderClass}
								rowRef={this.itemRefs[idx]}
								onContextMenu={this.handleRowContextMenu}
								onMouseDown={this.handleRowMouseDown}
								onMouseUp={this.handleRowMouseUp}
								onMouseLeave={this.handleRowMouseLeave}
								onOpenMenu={this.openContextMenuFromButton}
								onEdit={this.handleOpenDetailFromButton}
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
							isCheckSection={true}
							eventId={eventId}
							blockType={blockType}
							index={idx}
							item={item}
							schemaVersion={this.props.schemaVersion}
							openDetailNonce={openDetailNonce}
							isFirst={isFirst}
							isLast={isLast}
							disabled={disabled}
							isSelected={isSelected}
							selectedPrev={selectedPrev}
							selectedNext={selectedNext}
							isDraggedItem={isDraggedItem}
							showDropIndicator={showDropIndicator}
							indicatorBorderClass={indicatorBorderClass}
							rowRef={this.itemRefs[idx]}
							onContextMenu={this.handleRowContextMenu}
							onMouseDown={this.handleRowMouseDown}
							onMouseUp={this.handleRowMouseUp}
							onMouseLeave={this.handleRowMouseLeave}
							onOpenMenu={this.openContextMenuFromButton}
							onEdit={this.handleOpenDetailFromButton}
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

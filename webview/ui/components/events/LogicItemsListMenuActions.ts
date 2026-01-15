import { ICgEventLogicBlock } from '@shared';
import { editor } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { translation } from '../../../trans/Trans';
import type { SelectedItem } from './SelectionState';
import { selectionStateManager } from './SelectionState';

function getEventOrder(eventId: string): number {
	const index = editor.getEventIndex(eventId);
	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function sortLogicEntriesByEventOrder<T extends { eventId: string; index: number }>(entries: ReadonlyArray<T>): T[] {
	const sorted = [...entries];
	sorted.sort((a, b) => {
		if (a.eventId === b.eventId) {
			return a.index - b.index;
		}
		const eventOrder = getEventOrder(a.eventId) - getEventOrder(b.eventId);
		if (eventOrder !== 0) return eventOrder;
		return a.eventId.localeCompare(b.eventId);
	});
	return sorted;
}

export function getLogicSelectionEntriesWithBlocks(blockType: EventBlockType): SelectedItem[] {
	const activeSection = selectionStateManager.getActiveSection();
	if (activeSection !== blockType) {
		return [];
	}
	const selection = selectionStateManager.getSelection();
	const entries: SelectedItem[] = [];
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

export function getLogicSectionEntries(eventId: string, blockType: EventBlockType): SelectedItem[] {
	const items = editor.getLogicBlocks(eventId, blockType);
	const entries: SelectedItem[] = [];
	for (let i = 0; i < items.length; i++) {
		const block = items[i];
		if (!block) continue;
		entries.push({ eventId, blockType, index: i, block });
	}
	return entries;
}

export function getLogicMenuEntriesForSection(eventId: string, blockType: EventBlockType): SelectedItem[] {
	const selectionEntries = getLogicSelectionEntriesWithBlocks(blockType);
	if (selectionEntries.length > 0) {
		return selectionEntries;
	}
	return getLogicSectionEntries(eventId, blockType);
}

function getSelectionDisabledState(selectionEntries: SelectedItem[]): { hasEnabled: boolean; hasDisabled: boolean } {
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

export function getToggleDisableLabel(selectionEntries: SelectedItem[], isList: boolean): string {
	const { hasEnabled, hasDisabled } = getSelectionDisabledState(selectionEntries);
	if (hasEnabled && !hasDisabled) {
		return isList ? translation.state.disableList.getTrans() : translation.state.disable.getTrans();
	}
	if (!hasEnabled && hasDisabled) {
		return isList ? translation.state.enableList.getTrans() : translation.state.enable.getTrans();
	}
	return isList ? translation.state.enableDisableList.getTrans() : translation.state.enableDisable.getTrans();
}

export function removeLogicEntries(blockType: EventBlockType, selectionEntries: SelectedItem[]) {
	const entries: Array<{ eventId: string; index: number }> = [];
	for (const item of selectionEntries) {
		if (item.blockType !== blockType) continue;
		entries.push({ eventId: item.eventId, index: item.index });
	}
	if (entries.length > 0) {
		editor.removeLogicSelection(blockType, entries);
	}
	selectionStateManager.clearSelection();
}

export function toggleDisabledForEntries(blockType: EventBlockType, selectionEntries: SelectedItem[]) {
	const entries: Array<{ eventId: string; index: number }> = [];
	for (const entry of selectionEntries) {
		if (entry.blockType !== blockType) continue;
		entries.push({ eventId: entry.eventId, index: entry.index });
	}
	if (entries.length > 0) {
		editor.toggleLogicDisabledSelection(blockType, entries);
	}

	selectionStateManager.clearSelection();
}

export async function copyEntriesToClipboard(
	blockType: EventBlockType,
	selectionEntries: SelectedItem[],
	options?: { removeAfterCopy?: boolean }
) {
	const sortedEntries = sortLogicEntriesByEventOrder(selectionEntries);
	const blocks = sortedEntries
		.map((sel) => sel.block)
		.filter((block): block is ICgEventLogicBlock => Boolean(block));
	if (!blocks.length) return;

	const payload = { type: blockType, blocks };
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
		removeLogicEntries(blockType, sortedEntries);
	}

	selectionStateManager.clearSelection();
}

export function extractAllowedBlocks(text: string, blockType: EventBlockType): ICgEventLogicBlock[] {
	let parsed: any;
	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}
	let blocks: any[] = [];
	if (parsed?.type === blockType && Array.isArray(parsed?.blocks)) {
		blocks = parsed.blocks;
	} else if (Array.isArray(parsed)) {
		blocks = parsed;
	}
	if (!blocks.length) return [];
	return blocks.map((block) => ({
		type: typeof block?.type === 'string' ? block.type : '',
		data: block?.data ?? {},
	}));
}

export async function pasteAt(eventId: string, blockType: EventBlockType, targetIndex: number) {
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
		const allowed = extractAllowedBlocks(text, blockType);
		if (!allowed.length) return;
		editor.insertLogicBlocks(eventId, blockType, allowed, targetIndex);
		selectionStateManager.clearSelection();
	} catch {
		// ignore cgenh-invalid JSON
	}
}

export function selectAllListItems(eventId: string, blockType: EventBlockType) {
	const items = editor.getLogicBlocks(eventId, blockType);
	if (!items.length) return;
	selectionStateManager.selectAllForList(eventId, blockType, items.length);
}

import { ICgEventLogicBlock } from '@shared';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { EventEmitter } from '../../../utils/EventEmitter';

export interface SelectedItem {
	eventId: string;
	blockType: EventBlockType;
	index: number;
	block?: ICgEventLogicBlock;
}

const EMPTY_INDEX_SET: Set<number> = new Set<number>();

class SelectionStateManager extends EventEmitter {
	private selections: Record<string, { indexes: number[] }> = {};
	private activeSection?: EventBlockType;

	hasSelection() {
		return Object.values(this.selections).some((entry) => entry.indexes.length > 0);
	}

	hasSelectionInSection(blockType: EventBlockType): boolean {
		return this.activeSection === blockType && this.hasSelection();
	}

	getActiveSection(): EventBlockType | undefined {
		return this.activeSection;
	}

	getSelection(): Array<{ eventId: string; blockType: EventBlockType; index: number }> {
		if (!this.activeSection) { return []; }
		const result: Array<{ eventId: string; blockType: EventBlockType; index: number }> = [];
		for (const [eventId, entry] of Object.entries(this.selections)) {
			for (let i = 0; i < entry.indexes.length; i++) {
				result.push({ eventId, blockType: this.activeSection, index: entry.indexes[i] });
			}
		}
		return result;
	}

	clearSelection() {
		let changed = false;
		for (const key of Object.keys(this.selections)) {
			if (this.selections[key].indexes.length) {
				this.selections[key].indexes = [];
				changed = true;
			}
		}
		if (this.activeSection !== undefined) {
			this.activeSection = undefined;
			changed = true;
		}
		if (changed) {
			this.emit('change');
		}
	}

	toggleIndex(eventId: string, blockType: EventBlockType, index: number) {
		this.ensureSection(blockType);
		const entry = this.selections[eventId] || { indexes: [] };
		const existingIdx = entry.indexes.indexOf(index);
		if (existingIdx >= 0) {
			entry.indexes.splice(existingIdx, 1);
		} else {
			entry.indexes.push(index);
		}
		this.selections[eventId] = entry;
		this.emit('change');
	}

	getSelectedIndicesForList(eventId: string, blockType: EventBlockType): Set<number> {
		if (this.activeSection !== blockType) { return EMPTY_INDEX_SET; }
		const entry = this.selections[eventId];
		if (!entry || entry.indexes.length === 0) {
			return EMPTY_INDEX_SET;
		}
		return new Set(entry.indexes);
	}

	selectAllForList(eventId: string, blockType: EventBlockType, itemCount: number) {
		const count = Math.max(0, Math.floor(itemCount));
		if (count === 0) {
			this.clearSelection();
			return;
		}

		let changed = false;
		for (const key of Object.keys(this.selections)) {
			if (this.selections[key].indexes.length) {
				this.selections[key].indexes = [];
				changed = true;
			}
		}

		if (this.activeSection !== blockType) {
			this.activeSection = blockType;
			changed = true;
		}

		const next: number[] = new Array<number>(count);
		for (let i = 0; i < count; i++) {
			next[i] = i;
		}
		this.selections[eventId] = { indexes: next };
		changed = true;

		if (changed) {
			this.emit('change');
		}
	}

	private ensureSection(blockType: EventBlockType) {
		if (this.activeSection && this.activeSection !== blockType) {
			for (const key of Object.keys(this.selections)) {
				if (this.selections[key].indexes.length) {
					this.selections[key].indexes = [];
				}
			}
		}
		this.activeSection = blockType;
	}
}

export const selectionStateManager = new SelectionStateManager();

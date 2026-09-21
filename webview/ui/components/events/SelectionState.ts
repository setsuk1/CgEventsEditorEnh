import { ICgEventLogicBlock } from '@shared';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { EventEmitter } from '../../../utils/EventEmitter';

export interface SelectedItem {
	eventId: string;
	blockType: EventBlockType;
	index: number;
	block?: ICgEventLogicBlock;
}

export class SelectionStateManager extends EventEmitter {
	private selections = new Map<string, Set<number>>();
	private activeSection?: EventBlockType;

	hasSelection(): boolean {
		return this.selections.size > 0;
	}

	hasSelectionInSection(blockType: EventBlockType): boolean {
		return this.activeSection === blockType && this.selections.size > 0;
	}

	getActiveSection(): EventBlockType | undefined {
		return this.activeSection;
	}

	getSelection(): Array<{ eventId: string; blockType: EventBlockType; index: number }> {
		const blockType = this.activeSection;
		if (!blockType) return [];
		const result: Array<{ eventId: string; blockType: EventBlockType; index: number }> = [];
		for (const [eventId, indexes] of this.selections) {
			for (const index of indexes) result.push({ eventId, blockType, index });
		}
		return result;
	}

	clearSelection(): void {
		if (!this.activeSection && this.selections.size === 0) return;
		this.selections.clear();
		this.activeSection = undefined;
		this.emit('change');
	}

	clearSection(blockType: EventBlockType): void {
		if (this.activeSection !== blockType) return;
		this.clearSelection();
	}

	renameEvent(previousEventId: string, nextEventId: string): void {
		if (!previousEventId || !nextEventId || previousEventId === nextEventId) return;
		const previous = this.selections.get(previousEventId);
		if (!previous) return;
		this.selections.delete(previousEventId);
		const next = new Set(this.selections.get(nextEventId));
		for (const index of previous) next.add(index);
		this.selections.set(nextEventId, next);
		this.emit('change');
	}

	reconcileEvents(
		update: { eventId?: string; previousEventId?: string } | undefined,
		validEventIds: Iterable<string>,
	): void {
		const previousEventId = update?.previousEventId;
		const eventId = update?.eventId;
		if (previousEventId && eventId && previousEventId !== eventId) {
			this.renameEvent(previousEventId, eventId);
		}
		this.pruneEvents(validEventIds);
	}

	pruneEvents(validEventIds: Iterable<string>): void {
		if (!this.selections.size) return;
		const valid = new Set(validEventIds);
		let changed = false;
		for (const eventId of this.selections.keys()) {
			if (!valid.has(eventId)) {
				this.selections.delete(eventId);
				changed = true;
			}
		}
		if (!changed) return;
		if (this.selections.size === 0) this.activeSection = undefined;
		this.emit('change');
	}

	toggleIndex(eventId: string, blockType: EventBlockType, index: number): void {
		if (!Number.isFinite(index)) return;
		index = Math.floor(index);
		if (index < 0) return;
		this.ensureSection(blockType);
		const next = new Set(this.selections.get(eventId));
		if (next.has(index)) next.delete(index);
		else next.add(index);

		if (next.size) {
			this.selections.set(eventId, next);
		} else {
			this.selections.delete(eventId);
			if (this.selections.size === 0) this.activeSection = undefined;
		}
		this.emit('change');
	}

	getSelectedIndicesForList(eventId: string, blockType: EventBlockType): Set<number> {
		if (this.activeSection !== blockType) return new Set<number>();
		return new Set(this.selections.get(eventId));
	}

	selectAllForList(eventId: string, blockType: EventBlockType, itemCount: number): void {
		if (!Number.isFinite(itemCount)) return;
		const count = Math.max(0, Math.floor(itemCount));
		if (count === 0) {
			this.clearSelection();
			return;
		}
		const current = this.activeSection === blockType && this.selections.size === 1
			? this.selections.get(eventId)
			: undefined;
		if (current?.size === count) {
			let complete = true;
			for (let i = 0; i < count; i++) {
				if (!current.has(i)) {
					complete = false;
					break;
				}
			}
			if (complete) return;
		}
		const indexes = new Set<number>();
		for (let i = 0; i < count; i++) indexes.add(i);
		this.activeSection = blockType;
		this.selections.clear();
		this.selections.set(eventId, indexes);
		this.emit('change');
	}

	private ensureSection(blockType: EventBlockType): void {
		if (this.activeSection === blockType) return;
		this.selections.clear();
		this.activeSection = blockType;
	}
}

export const selectionStateManager = new SelectionStateManager();

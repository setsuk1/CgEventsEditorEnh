import { EventBlockType } from '../../../editor/eventBlockTypes';

export interface EventCardUiState {
	collapsed: boolean;
	blockCollapsed: Record<EventBlockType, boolean>;
}

const createDefaultBlockCollapsed = (): Record<EventBlockType, boolean> => ({
	trigger: false,
	check: false,
	action: false,
});

export class EventCardUiStateStore {
	private stateById = new Map<string, EventCardUiState>();

	get(eventId: string): EventCardUiState | undefined {
		return this.stateById.get(eventId);
	}

	ensure(eventId: string): EventCardUiState {
		const existing = this.stateById.get(eventId);
		if (existing) {
			return existing;
		}
		const created: EventCardUiState = {
			collapsed: false,
			blockCollapsed: createDefaultBlockCollapsed(),
		};
		this.stateById.set(eventId, created);
		return created;
	}

	setCollapsed(eventId: string, collapsed: boolean): void {
		const state = this.ensure(eventId);
		state.collapsed = collapsed;
	}

	setBlockCollapsed(eventId: string, blockType: EventBlockType, collapsed: boolean): void {
		const state = this.ensure(eventId);
		state.blockCollapsed[blockType] = collapsed;
	}

	setBlockCollapsedMap(eventId: string, blockCollapsed: Record<EventBlockType, boolean>): void {
		const state = this.ensure(eventId);
		state.blockCollapsed = { ...blockCollapsed };
	}

	rename(previousEventId: string, nextEventId: string): void {
		if (!previousEventId || !nextEventId || previousEventId === nextEventId) {
			return;
		}
		const state = this.stateById.get(previousEventId);
		if (!state) {
			return;
		}
		this.stateById.delete(previousEventId);
		this.stateById.set(nextEventId, state);
	}

	prune(validIds: string[]): void {
		const keep = new Set(validIds);
		for (const id of this.stateById.keys()) {
			if (!keep.has(id)) {
				this.stateById.delete(id);
			}
		}
	}
}

export const eventCardUiStateStore = new EventCardUiStateStore();


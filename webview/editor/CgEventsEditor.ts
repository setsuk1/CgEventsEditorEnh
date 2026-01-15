import {
	ICgAppInfo,
	ICgEvent,
	ICgEventLogicBlock,
	ICgEventsDocument,
	ICgEventsFormat,
	ICgEventsParseResult,
	ICgEventsParseSuccess,
	ICgEventsSchema,
	ICgItemInfoList,
	ISortingPreset
} from '@shared';
import { EventEmitter } from '../utils/EventEmitter';
import { EditorHistory, EditorHistoryEntry } from './EditorHistory';
import { ebtConv, EventBlockType } from './eventBlockTypes';

export interface EditorViewState {
	document?: ICgEventsDocument;
	schema?: ICgEventsSchema;
	sources?: string[];
	resources?: string[];
	items?: ICgItemInfoList;
	cgapp?: ICgAppInfo;
	parseError?: any;
	format: ICgEventsFormat;
}

/**
 * Editor change event types
 */
export const EditorChangeEvents = {
	// Event-level changes
	EVENT_ADDED: 'event:added',
	EVENT_UPDATED: 'event:updated',
	EVENT_REMOVED: 'event:removed',
	EVENT_MOVED: 'event:moved',
	EVENTS_REORDERED: 'events:reordered',
	EVENTS_REPLACED: 'events:replaced',

	// Action-level changes
	ACTION_ADDED: 'action:added',
	ACTION_UPDATED: 'action:updated',
	ACTION_REMOVED: 'action:removed',
	ACTION_MOVED: 'action:moved',

	// Check-level changes
	CHECK_ADDED: 'check:added',
	CHECK_UPDATED: 'check:updated',
	CHECK_REMOVED: 'check:removed',
	CHECK_MOVED: 'check:moved',

	// Trigger-level changes
	TRIGGER_ADDED: 'trigger:added',
	TRIGGER_UPDATED: 'trigger:updated',
	TRIGGER_REMOVED: 'trigger:removed',
	TRIGGER_MOVED: 'trigger:moved',

	// Config-level changes
	CONFIG_UPDATED: 'config:updated',

	// Document-level changes
	DOCUMENT_UPDATED: 'document:updated',
	SCHEMA_UPDATED: 'schema:updated',
	SOURCES_UPDATED: 'sources:updated',
	RESOURCES_UPDATED: 'resources:updated',
	ITEMS_UPDATED: 'items:updated',
	CGAPP_UPDATED: 'cgapp:updated',
	FORMAT_UPDATED: 'format:updated',
	SORTING_PRESETS_UPDATED: 'sortingPresets:updated',

	// Generic change (fallback)
	CHANGE: 'change',
} as const;

export type EditorChangeEventType = typeof EditorChangeEvents[keyof typeof EditorChangeEvents];

export interface EditorChangeEventPayload {
	eventId?: string;
	blockType?: EventBlockType;
	index?: number;
	event?: ICgEvent;
	events?: ICgEvent[];
	config?: Record<string, any>;
	data?: any;
}

export class CgEventsEditor extends EventEmitter {
	private _parseResult: ICgEventsParseResult;
	private _entry?: ICgEventsParseSuccess;
	private _parseError?: any;
	private _schema?: ICgEventsSchema;
	private _sources?: string[];
	private _resources?: string[];
	private _items?: ICgItemInfoList;
	private _cgapp?: ICgAppInfo;
	private _sortingPresets: ISortingPreset[] = [];

	private eventOrderVersion: number = 0;
	private history = new EditorHistory();

	private cachedEventsRef?: ICgEvent[];
	private cachedEventById = new Map<string, ICgEvent>();
	private cachedEventIndexById = new Map<string, number>();

	private logicBlockUiKeyByBlock = new WeakMap<ICgEventLogicBlock, string>();
	private nextLogicBlockUiKey = 1;

	constructor() {
		super();
	}

	canUndo(): boolean {
		return this.history.canUndo();
	}

	canRedo(): boolean {
		return this.history.canRedo();
	}

	undo(): void {
		this.history.undo();
	}

	redo(): void {
		this.history.redo();
	}

	clearHistory(): void {
		this.history.clear();
	}

	private recordHistory(entry: EditorHistoryEntry): void {
		this.history.record(entry);
	}

	addEvent(partial?: { folder?: string }) {
		const result = this._addEvent(partial);
		if (!result) {
			return;
		}
		const storedEvent = result.event;
		this.recordHistory({
			undo: () => this._removeEvent(storedEvent.id),
			redo: () => this.insertEventAtIndex(storedEvent, result.index),
		});
	}

	duplicateEvent(id: string) {
		const result = this._duplicateEvent(id);
		if (!result) {
			return;
		}
		const storedEvent = result.event;
		this.recordHistory({
			undo: () => this._removeEvent(storedEvent.id),
			redo: () => this.insertEventAtIndex(storedEvent, result.index),
		});
	}

	updateEvent(id: string, patch: Partial<ICgEvent>) {
		const result = this._updateEvent(id, patch);
		if (!result) {
			return;
		}
		const previous = result.previous;
		const next = result.next;
		this.recordHistory({
			undo: () => this.replaceEventAtIndex(result.index, previous),
			redo: () => this.replaceEventAtIndex(result.index, next),
		});
	}

	removeEvent(id: string) {
		const result = this._removeEvent(id);
		if (!result) {
			return;
		}
		const storedEvent = result.event;
		this.recordHistory({
			undo: () => this.insertEventAtIndex(storedEvent, result.index),
			redo: () => this.removeEventAtIndex(result.index),
		});
	}

	moveEvent(id: string, delta: number) {
		const result = this._moveEvent(id, delta);
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.moveEventByIndex(result.toIndex, result.fromIndex),
			redo: () => this.moveEventByIndex(result.fromIndex, result.toIndex),
		});
	}

	toggleEventDisabled(id: string) {
		const result = this._toggleEventDisabled(id);
		if (!result) {
			return;
		}
		const previous = result.previous;
		const next = result.next;
		this.recordHistory({
			undo: () => this.replaceEventAtIndex(result.index, previous),
			redo: () => this.replaceEventAtIndex(result.index, next),
		});
	}

	updateConfig(configPatch: Record<string, any>) {
		const result = this._updateConfig(configPatch);
		if (!result) {
			return;
		}
		const previous = this._deepClone(result.previous) ?? result.previous;
		const next = this._deepClone(result.next) ?? result.next;
		this.recordHistory({
			undo: () => this.replaceConfig(previous),
			redo: () => this.replaceConfig(next),
		});
	}

	addLogic(eventId: string, blockType: EventBlockType, type: string) {
		const result = this._addLogic(eventId, blockType, type);
		if (!result) {
			return;
		}
		const storedBlock = this._deepClone(result.block) ?? result.block;
		this.recordHistory({
			undo: () => this.removeLogicAtIndex(eventId, blockType, result.index),
			redo: () => this.insertLogicAtIndex(eventId, blockType, storedBlock, result.index),
		});
	}

	insertLogic(eventId: string, blockType: EventBlockType, block: ICgEventLogicBlock, targetIndex?: number) {
		const result = this._insertLogic(eventId, blockType, block, targetIndex);
		if (!result) {
			return;
		}
		const storedBlock = this._deepClone(result.block) ?? result.block;
		this.recordHistory({
			undo: () => this.removeLogicAtIndex(eventId, blockType, result.index),
			redo: () => this.insertLogicAtIndex(eventId, blockType, storedBlock, result.index),
		});
	}

	updateLogicData(eventId: string, blockType: EventBlockType, index: number, data: any) {
		const result = this._updateLogicData(eventId, blockType, index, data);
		if (!result) {
			return;
		}
		const previous = this._deepClone(result.previous) ?? result.previous;
		const next = this._deepClone(result.next) ?? result.next;
		this.recordHistory({
			undo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, previous),
			redo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, next),
		});
	}

	updateLogicField(eventId: string, blockType: EventBlockType, index: number, path: string[], value: any) {
		const result = this._updateLogicField(eventId, blockType, index, path, value);
		if (!result) {
			return;
		}
		const previous = this._deepClone(result.previous) ?? result.previous;
		const next = this._deepClone(result.next) ?? result.next;
		this.recordHistory({
			undo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, previous),
			redo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, next),
		});
	}

	removeLogic(eventId: string, blockType: EventBlockType, index: number) {
		const result = this._removeLogic(eventId, blockType, index);
		if (!result) {
			return;
		}
		const storedBlock = this._deepClone(result.block) ?? result.block;
		this.recordHistory({
			undo: () => this.insertLogicAtIndex(eventId, blockType, storedBlock, result.index),
			redo: () => this.removeLogicAtIndex(eventId, blockType, result.index),
		});
	}

	moveLogic(eventId: string, blockType: EventBlockType, index: number, delta: number) {
		const result = this._moveLogic(eventId, blockType, index, delta);
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.moveLogicWithinEvent(eventId, blockType, result.toIndex, result.fromIndex),
			redo: () => this.moveLogicWithinEvent(eventId, blockType, result.fromIndex, result.toIndex),
		});
	}

	moveLogicToIndex(eventId: string, blockType: EventBlockType, index: number, targetIndex: number) {
		const result = this._moveLogicToIndex(eventId, blockType, index, targetIndex);
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.moveLogicWithinEvent(eventId, blockType, result.toIndex, result.fromIndex),
			redo: () => this.moveLogicWithinEvent(eventId, blockType, result.fromIndex, result.toIndex),
		});
	}

	moveLogicToEvent(eventId: string, blockType: EventBlockType, index: number, targetEventId: string, targetIndex?: number) {
		const result = this._moveLogicToEvent(eventId, blockType, index, targetEventId, targetIndex);
		if (!result) {
			return;
		}
		const storedBlock = this._deepClone(result.block) ?? result.block;
		const cloneForInsert = () => this._deepClone(storedBlock) ?? storedBlock;
		this.recordHistory({
			undo: () => {
				if (result.sourceEventId === result.targetEventId) {
					this.moveLogicWithinEvent(result.sourceEventId, blockType, result.targetIndex, result.sourceIndex);
					return;
				}
				this.removeLogicAtIndex(result.targetEventId, blockType, result.targetIndex);
				this.insertLogicAtIndex(result.sourceEventId, blockType, cloneForInsert(), result.sourceIndex);
			},
			redo: () => {
				if (result.sourceEventId === result.targetEventId) {
					this.moveLogicWithinEvent(result.sourceEventId, blockType, result.sourceIndex, result.targetIndex);
					return;
				}
				this.removeLogicAtIndex(result.sourceEventId, blockType, result.sourceIndex);
				this.insertLogicAtIndex(result.targetEventId, blockType, cloneForInsert(), result.targetIndex);
			},
		});
	}

	moveLogicSelectionToEvent(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number; block: ICgEventLogicBlock }>,
		targetEventId: string,
		targetIndex: number
	) {
		const result = this._moveLogicSelectionToEvent(blockType, selection, targetEventId, targetIndex);
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.restoreEventsForLogicSelection(result.previousEvents, blockType, result.affectedEventIds),
			redo: () => this.restoreEventsForLogicSelection(result.nextEvents, blockType, result.affectedEventIds),
		});
	}

	removeLogicSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._removeLogicSelection(blockType, selection);
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.restoreEventsForLogicSelection(result.previousEvents, blockType, result.affectedEventIds),
			redo: () => this.restoreEventsForLogicSelection(result.nextEvents, blockType, result.affectedEventIds),
		});
	}

	toggleLogicDisabledSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._toggleLogicDisabledSelection(blockType, selection);
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.restoreEventsForLogicSelection(result.previousEvents, blockType, result.affectedEventIds),
			redo: () => this.restoreEventsForLogicSelection(result.nextEvents, blockType, result.affectedEventIds),
		});
	}

	insertLogicBlocks(
		eventId: string,
		blockType: EventBlockType,
		blocks: ICgEventLogicBlock[],
		targetIndex: number
	) {
		const result = this._insertLogicBlocks(eventId, blockType, blocks, targetIndex);
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.restoreEventsForLogicSelection(result.previousEvents, blockType, result.affectedEventIds),
			redo: () => this.restoreEventsForLogicSelection(result.nextEvents, blockType, result.affectedEventIds),
		});
	}

	moveLogicSelectionToTop(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._moveLogicSelectionToBoundary(blockType, selection, 'top');
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.restoreEventsForLogicSelection(result.previousEvents, blockType, result.affectedEventIds),
			redo: () => this.restoreEventsForLogicSelection(result.nextEvents, blockType, result.affectedEventIds),
		});
	}

	moveLogicSelectionToBottom(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._moveLogicSelectionToBoundary(blockType, selection, 'bottom');
		if (!result) {
			return;
		}
		this.recordHistory({
			undo: () => this.restoreEventsForLogicSelection(result.previousEvents, blockType, result.affectedEventIds),
			redo: () => this.restoreEventsForLogicSelection(result.nextEvents, blockType, result.affectedEventIds),
		});
	}

	toggleLogicDisabled(eventId: string, blockType: EventBlockType, index: number) {
		const result = this._toggleLogicDisabled(eventId, blockType, index);
		if (!result) {
			return;
		}
		const previous = this._deepClone(result.previous) ?? result.previous;
		const next = this._deepClone(result.next) ?? result.next;
		this.recordHistory({
			undo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, previous),
			redo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, next),
		});
	}

	private restoreEventsForLogicSelection(events: ICgEvent[], blockType: EventBlockType, affectedEventIds: string[]) {
		this.setEvents(events);
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		for (let i = 0; i < affectedEventIds.length; i++) {
			this._emitChange(updateType, { eventId: affectedEventIds[i], blockType });
		}
	}

	private collectLogicSelectionIndicesByEventId(
		selection: Array<{ eventId: string; index: number }>
	): Map<string, number[]> {
		const grouped = new Map<string, number[]>();
		for (let i = 0; i < selection.length; i++) {
			const entry = selection[i];
			if (!entry) {
				continue;
			}
			const eventId = entry.eventId;
			const index = entry.index;
			if (!eventId) {
				continue;
			}
			if (!Number.isFinite(index)) {
				continue;
			}
			const existing = grouped.get(eventId);
			if (existing) {
				existing.push(index);
				continue;
			}
			grouped.set(eventId, [index]);
		}
		return grouped;
	}

	private _removeLogicSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	): { previousEvents: ICgEvent[]; nextEvents: ICgEvent[]; affectedEventIds: string[] } | undefined {
		const events = this._getEvents();
		if (!events || selection.length === 0) {
			return;
		}

		const blockKey = this.getBlockKey(blockType);
		const removalsByEvent = this.collectLogicSelectionIndicesByEventId(selection);
		if (removalsByEvent.size === 0) {
			return;
		}

		for (const indices of removalsByEvent.values()) {
			indices.sort((a, b) => b - a);
		}

		let changed = false;
		const affectedEventIds: string[] = [];

		const nextEvents = events.map((event) => {
			const removalIndices = removalsByEvent.get(event.id);
			if (!removalIndices || removalIndices.length === 0) {
				return event;
			}

			const sectionArr = event[blockKey];
			if (!Array.isArray(sectionArr)) {
				return event;
			}

			const newSectionArr = [...sectionArr];
			let removedAny = false;
			let lastIndex: number | null = null;
			for (let i = 0; i < removalIndices.length; i++) {
				const index = Math.floor(removalIndices[i]);
				if (lastIndex !== null && index === lastIndex) {
					continue;
				}
				lastIndex = index;
				if (index < 0 || index >= newSectionArr.length) {
					continue;
				}
				newSectionArr.splice(index, 1);
				removedAny = true;
			}
			if (!removedAny) {
				return event;
			}

			changed = true;
			affectedEventIds.push(event.id);
			return { ...event, [blockKey]: newSectionArr };
		});

		if (!changed) {
			return;
		}

		this.setEvents(nextEvents);
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		for (let i = 0; i < affectedEventIds.length; i++) {
			this._emitChange(updateType, { eventId: affectedEventIds[i], blockType });
		}
		return { previousEvents: events, nextEvents, affectedEventIds };
	}

	private _toggleLogicDisabledSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	): { previousEvents: ICgEvent[]; nextEvents: ICgEvent[]; affectedEventIds: string[] } | undefined {
		const events = this._getEvents();
		if (!events || selection.length === 0) {
			return;
		}

		const blockKey = this.getBlockKey(blockType);
		const indicesByEvent = this.collectLogicSelectionIndicesByEventId(selection);
		if (indicesByEvent.size === 0) {
			return;
		}

		for (const indices of indicesByEvent.values()) {
			indices.sort((a, b) => a - b);
		}

		let changed = false;
		const affectedEventIds: string[] = [];

		const nextEvents = events.map((event) => {
			const indices = indicesByEvent.get(event.id);
			if (!indices || indices.length === 0) {
				return event;
			}

			const sectionArr = event[blockKey];
			if (!Array.isArray(sectionArr)) {
				return event;
			}

			const newSectionArr = [...sectionArr];
			let updatedAny = false;
			let lastIndex: number | null = null;
			for (let i = 0; i < indices.length; i++) {
				const index = Math.floor(indices[i]);
				if (lastIndex !== null && index === lastIndex) {
					continue;
				}
				lastIndex = index;
				if (index < 0 || index >= newSectionArr.length) {
					continue;
				}

				const current = newSectionArr[index];
				if (!current) {
					continue;
				}
				const data = current.data || {};
				const nextDisable = !data.disabled;
				const nextData = { ...data, disabled: nextDisable };
				const nextBlock = { ...current, data: nextData };
				this.transferLogicBlockUiKey(current, nextBlock);
				newSectionArr[index] = nextBlock;
				updatedAny = true;
			}

			if (!updatedAny) {
				return event;
			}

			changed = true;
			affectedEventIds.push(event.id);
			return { ...event, [blockKey]: newSectionArr };
		});

		if (!changed) {
			return;
		}

		this.setEvents(nextEvents);
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		for (let i = 0; i < affectedEventIds.length; i++) {
			this._emitChange(updateType, { eventId: affectedEventIds[i], blockType });
		}
		return { previousEvents: events, nextEvents, affectedEventIds };
	}

	private _insertLogicBlocks(
		eventId: string,
		blockType: EventBlockType,
		blocks: ICgEventLogicBlock[],
		targetIndex: number
	): { previousEvents: ICgEvent[]; nextEvents: ICgEvent[]; affectedEventIds: string[] } | undefined {
		const events = this._getEvents();
		if (!events || !eventId || blocks.length === 0) {
			return;
		}

		const blockKey = this.getBlockKey(blockType);
		const targetEvent = events.find((evt) => evt.id === eventId);
		const targetArr = targetEvent ? targetEvent[blockKey] : undefined;
		if (!Array.isArray(targetArr)) {
			return;
		}

		const toInsert: ICgEventLogicBlock[] = [];
		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			if (!block) {
				continue;
			}
			toInsert.push({
				type: typeof block.type === 'string' ? block.type : '',
				data: block.data ? { ...block.data } : {},
			});
		}
		if (toInsert.length === 0) {
			return;
		}

		const insertAt = Math.max(0, Math.min(Math.floor(targetIndex), targetArr.length));
		const nextEvents = events.map((event) => {
			if (event.id !== eventId) {
				return event;
			}
			const sectionArr = event[blockKey];
			if (!Array.isArray(sectionArr)) {
				return event;
			}
			const nextSectionArr = [...sectionArr];
			nextSectionArr.splice(insertAt, 0, ...toInsert);
			return { ...event, [blockKey]: nextSectionArr };
		});

		this.setEvents(nextEvents);
		const affectedEventIds = [eventId];
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		this._emitChange(updateType, { eventId, blockType });
		return { previousEvents: events, nextEvents, affectedEventIds };
	}

	private _moveLogicSelectionToBoundary(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>,
		target: 'top' | 'bottom'
	): { previousEvents: ICgEvent[]; nextEvents: ICgEvent[]; affectedEventIds: string[] } | undefined {
		const events = this._getEvents();
		if (!events || selection.length === 0) {
			return;
		}

		const blockKey = this.getBlockKey(blockType);
		const indicesByEvent = this.collectLogicSelectionIndicesByEventId(selection);
		if (indicesByEvent.size === 0) {
			return;
		}

		let changed = false;
		const affectedEventIds: string[] = [];

		const nextEvents = events.map((event) => {
			const indices = indicesByEvent.get(event.id);
			if (!indices || indices.length === 0) {
				return event;
			}

			const sectionArr = event[blockKey];
			if (!Array.isArray(sectionArr) || sectionArr.length === 0) {
				return event;
			}

			const selected = new Set<number>();
			for (let i = 0; i < indices.length; i++) {
				const index = Math.floor(indices[i]);
				if (index < 0 || index >= sectionArr.length) {
					continue;
				}
				selected.add(index);
			}
			if (selected.size === 0 || selected.size === sectionArr.length) {
				return event;
			}

			const selectedBlocks: ICgEventLogicBlock[] = [];
			const restBlocks: ICgEventLogicBlock[] = [];
			for (let i = 0; i < sectionArr.length; i++) {
				const block = sectionArr[i];
				if (selected.has(i)) {
					selectedBlocks.push(block);
				} else {
					restBlocks.push(block);
				}
			}

			const nextSectionArr = target === 'top'
				? [...selectedBlocks, ...restBlocks]
				: [...restBlocks, ...selectedBlocks];
			changed = true;
			affectedEventIds.push(event.id);
			return { ...event, [blockKey]: nextSectionArr };
		});

		if (!changed) {
			return;
		}

		this.setEvents(nextEvents);
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		for (let i = 0; i < affectedEventIds.length; i++) {
			this._emitChange(updateType, { eventId: affectedEventIds[i], blockType });
		}
		return { previousEvents: events, nextEvents, affectedEventIds };
	}

	/**
	 * Gets the order version (increments when events are reordered)
	 */
	getOrderVersion(): number {
		return this.eventOrderVersion;
	}

	getEventsJson(): ICgEventsDocument | undefined {
		if (this._entry) {
			return this._entry.json;
		}
		if (this._parseResult && this._parseResult.format !== 'error') {
			return this._parseResult.json;
		}
		return undefined;
	}
	getEventsFormat() {
		return this._entry?.format ?? this._parseResult?.format;
	}
	getParseError() {
		return this._parseError;
	}
	getSchema() {
		return this._schema;
	}
	getSources() {
		return this._sources;
	}
	getResources() {
		return this._resources;
	}
	getItems() {
		return this._items;
	}
	getCgApp() {
		return this._cgapp;
	}
	getSortingPresets() {
		return this._sortingPresets;
	}

	private syncEventLookupCache() {
		const events = this._getEvents();
		if (events === this.cachedEventsRef) {
			return;
		}
		this.cachedEventsRef = events;
		this.cachedEventById.clear();
		this.cachedEventIndexById.clear();
		if (!events) {
			return;
		}
		for (let i = 0; i < events.length; i++) {
			const event = events[i];
			this.cachedEventById.set(event.id, event);
			this.cachedEventIndexById.set(event.id, i);
		}
	}

	getEvents() {
		return this.getEventsJson()?.events ?? [];
	}
	getEventIndex(eventId: string) {
		this.syncEventLookupCache();
		const index = this.cachedEventIndexById.get(eventId);
		return index === undefined ? -1 : index;
	}
	getEventById(id: string): ICgEvent | undefined {
		this.syncEventLookupCache();
		return this.cachedEventById.get(id);
	}
	getLogicBlocks(eventId: string, blockType: EventBlockType): ICgEventLogicBlock[] {
		const event = this.getEventById(eventId);
		const blockKey = this.getBlockKey(blockType);
		const blocks = event ? event[blockKey] : undefined;
		return Array.isArray(blocks) ? blocks : [];
	}

	getLogicBlockUiKey(block: ICgEventLogicBlock): string {
		const existing = this.logicBlockUiKeyByBlock.get(block);
		if (existing) {
			return existing;
		}
		const created = `logic-${this.nextLogicBlockUiKey++}`;
		this.logicBlockUiKeyByBlock.set(block, created);
		return created;
	}

	private transferLogicBlockUiKey(from: ICgEventLogicBlock, to: ICgEventLogicBlock): void {
		const existing = this.logicBlockUiKeyByBlock.get(from);
		if (!existing) {
			return;
		}
		this.logicBlockUiKeyByBlock.set(to, existing);
	}
	getLogicBlock(eventId: string, blockType: EventBlockType, index: number): ICgEventLogicBlock | undefined {
		const blocks = this.getLogicBlocks(eventId, blockType);
		return blocks[index];
	}

	private getBlockKey(blockType: EventBlockType): string {
		return ebtConv.COMPLEX[blockType];
	}

	private _emitChange(eventType: EditorChangeEventType = EditorChangeEvents.CHANGE, payload?: EditorChangeEventPayload) {
		// Emit specific event type
		if (eventType !== EditorChangeEvents.CHANGE) {
			this.emit(eventType, payload);
		}
		// Always emit generic change event for backward compatibility
		this.emit(EditorChangeEvents.CHANGE, payload);
	}

	private _replaceDocument(nextDoc: ICgEventsDocument) {
		if (!this._entry) {
			return;
		}

		const currentJson = this._entry.json;

		// Avoid creating new objects if content hasn't changed
		if (currentJson) {
			const configChanged = currentJson.config !== nextDoc.config;
			const eventsChanged = currentJson.events !== nextDoc.events;

			if (!configChanged && !eventsChanged) {
				// No actual changes, skip update
				return;
			}
		}

		// Only create new json object if something actually changed
		const nextJson = {
			...(currentJson ?? {}),
			config: nextDoc.config,
			events: nextDoc.events,
		};

		this._entry = {
			...this._entry,
			json: nextJson,
		};
		this._emitChange();
	}

	setCgEventsJson(json: ICgEventsParseResult) {
		this._parseResult = json;
		this.eventOrderVersion = 0;
		this.clearHistory();
		this.cachedEventsRef = undefined;
		this.cachedEventById.clear();
		this.cachedEventIndexById.clear();
		this.logicBlockUiKeyByBlock = new WeakMap<ICgEventLogicBlock, string>();
		this.nextLogicBlockUiKey = 1;
		if (json.format === 'error') {
			this._parseError = json.error;
			this._entry = undefined;
		} else {
			this._entry = json;
			this._parseError = undefined;
		}
		this._emitChange(EditorChangeEvents.DOCUMENT_UPDATED);
	}

	setCgEventsSchema(schema: ICgEventsSchema) {
		if (this._schema === schema) {
			return;
		}
		this._schema = schema;
		this._emitChange(EditorChangeEvents.SCHEMA_UPDATED);
	}

	setCgApp(cgapp: ICgAppInfo) {
		if (this._cgapp === cgapp) {
			return;
		}
		this._cgapp = cgapp;
		this._emitChange(EditorChangeEvents.CGAPP_UPDATED);
	}
	setSortingPresets(presets: ISortingPreset[]) {
		if (this._sortingPresets === presets) {
			return;
		}
		this._sortingPresets = presets;
		this._emitChange(EditorChangeEvents.SORTING_PRESETS_UPDATED, { data: presets });
	}

	setItems(items: any) {
		if (this._items === items) {
			return;
		}
		this._items = items;
		this._emitChange(EditorChangeEvents.ITEMS_UPDATED);
	}
	setSources(sources: string[]) {
		if (this._sources === sources) {
			return;
		}
		this._sources = sources;
		this._emitChange(EditorChangeEvents.SOURCES_UPDATED);
	}

	setResources(resources: string[]) {
		if (this._resources === resources) {
			return;
		}
		this._resources = resources;
		this._emitChange(EditorChangeEvents.RESOURCES_UPDATED);
	}

	private setEvents(events: ICgEvent[], isReorder = false) {
		const safeEvents = Array.isArray(events) ? events : [];
		const doc = this.getEventsJson();
		if (!doc) { return; }

		this._replaceDocument({ ...doc, events: safeEvents });

		if (isReorder) {
			this.eventOrderVersion++;
			this.emit('events-reordered', safeEvents);
		}
	}

	private _addEvent(partial?: { folder?: string }): { event: ICgEvent; index: number } | undefined {
		const doc = this.getEventsJson();
		if (!doc) {
			return;
		}
		const nextEvent: ICgEvent = {
			id: this._generateEventId(doc.events),
			folder: partial?.folder ?? '',
			disabled: false,
			startTime: 0,
			checkInterval: 10,
			repeatInterval: 0,
			repeats: 0,
			devOnly: false,
			referenceOnly: false,
			color: '#ffffff',
			actions: [],
			checks: [],
			triggers: [],
		};
		this.setEvents([...doc.events, nextEvent]);
		this._emitChange(EditorChangeEvents.EVENT_ADDED, { eventId: nextEvent.id, event: nextEvent });
		return { event: nextEvent, index: doc.events.length };
	}

	private _deepClone<T>(value: T): T {
		try {
			if (typeof structuredClone === 'function') {
				return structuredClone(value);
			}
		} catch {
			// fallback below
		}
		try {
			return JSON.parse(JSON.stringify(value));
		} catch {
			return value;
		}
	}

	private cloneEntry(entry?: ICgEventsParseSuccess): ICgEventsParseSuccess | undefined {
		if (!entry) {
			return undefined;
		}
		const clonedJson = this._deepClone(entry.json) ?? entry.json;
		return { format: entry.format, json: clonedJson };
	}

	private restoreEntry(entry?: ICgEventsParseSuccess, parseError?: any) {
		this._entry = entry;
		this._parseError = parseError;
		this._emitChange(EditorChangeEvents.DOCUMENT_UPDATED);
	}

	private replaceEntryJson(nextJson: ICgEventsDocument) {
		if (!this._entry) {
			this._entry = { format: 'json', json: nextJson };
		} else {
			this._entry = { ...this._entry, json: nextJson };
		}
		this._parseError = undefined;
		this._emitChange(EditorChangeEvents.DOCUMENT_UPDATED);
	}

	private _generateDuplicateEventId(baseId: string, events: ICgEvent[]): string {
		const existing = new Set(events.map((evt) => evt.id));
		let idx = 1;
		let candidate = `${baseId}_copy${idx}`;
		while (existing.has(candidate)) {
			idx += 1;
			candidate = `${baseId}_copy${idx}`;
		}
		return candidate;
	}

	private _duplicateEvent(eventId: string): { event: ICgEvent; index: number } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		const idx = events.findIndex((e) => e.id === eventId);
		if (idx === -1) { return; }

		const sourceEvent = events[idx];
		if (!sourceEvent) { return; }

		const nextId = this._generateDuplicateEventId(sourceEvent.id, events);
		const clonedEvent: ICgEvent = { ...this._deepClone(sourceEvent), id: nextId };

		const newEvents = [...events];
		newEvents.splice(idx + 1, 0, clonedEvent);
		this.setEvents(newEvents);
		this._emitChange(EditorChangeEvents.EVENT_ADDED, { eventId: clonedEvent.id, event: clonedEvent });
		return { event: clonedEvent, index: idx + 1 };
	}

	private _generateEventId(events: ICgEvent[]): string {
		const existing = new Set(events.map((evt) => evt.id));
		let idx = 1;
		let candidate = this._formatEventId(idx);
		while (existing.has(candidate)) {
			idx += 1;
			candidate = this._formatEventId(idx);
		}
		return candidate;
	}

	private _formatEventId(idx: number) {
		return `event_${String(idx).padStart(4, '0')}`;
	}

	getCurrentEntry(): ICgEventsParseSuccess | undefined {
		const doc = this.getEventsJson();
		if (!this._entry || !doc) {
			return undefined;
		}
		return {
			format: this._entry.format,
			json: {
				...(this._entry.json ?? {}),
				config: doc.config,
				events: doc.events,
			},
		};
	}

	setFormat(format: Exclude<ICgEventsFormat, 'error'>) {
		if (!this._entry) {
			return;
		}
		this._entry = {
			...this._entry,
			format,
		};
		this._emitChange(EditorChangeEvents.FORMAT_UPDATED);
	}

	applyJsonText(raw: string): Error | null {
		try {
			const previousEntry = this.cloneEntry(this._entry);
			const previousError = this._parseError;
			const parsed = JSON.parse(raw);
			this.replaceEntryJson(parsed);
			const nextEntry = this.cloneEntry(this._entry);
			if (nextEntry) {
				this.recordHistory({
					undo: () => this.restoreEntry(previousEntry, previousError),
					redo: () => this.restoreEntry(nextEntry, undefined),
				});
			}
			return null;
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			this._parseError = err;
			this._emitChange(EditorChangeEvents.DOCUMENT_UPDATED);
			return err;
		}
	}

	private _getEvents(): ICgEvent[] | undefined {
		const doc = this.getEventsJson();
		return doc?.events;
	}

	private insertEventAtIndex(event: ICgEvent, index: number) {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		const safeIndex = Math.max(0, Math.min(index, events.length));
		const nextEvents = [...events];
		nextEvents.splice(safeIndex, 0, event);
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents.EVENT_ADDED, { eventId: event.id, event });
	}

	private removeEventAtIndex(index: number): ICgEvent | undefined {
		const events = this._getEvents();
		if (!events || index < 0 || index >= events.length) {
			return undefined;
		}
		const nextEvents = [...events];
		const [removed] = nextEvents.splice(index, 1);
		this.setEvents(nextEvents);
		if (removed) {
			this._emitChange(EditorChangeEvents.EVENT_REMOVED, { eventId: removed.id, event: removed });
		}
		return removed;
	}

	private replaceEventAtIndex(index: number, nextEvent: ICgEvent) {
		const events = this._getEvents();
		if (!events || index < 0 || index >= events.length) {
			return;
		}
		const nextEvents = [...events];
		nextEvents[index] = nextEvent;
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents.EVENT_UPDATED, { eventId: nextEvent.id, event: nextEvent });
	}

	private moveEventByIndex(index: number, target: number) {
		const events = this._getEvents();
		if (!events || index < 0 || index >= events.length) {
			return;
		}
		const safeTarget = Math.max(0, Math.min(target, events.length - 1));
		if (safeTarget === index) {
			return;
		}
		const nextEvents = [...events];
		const [item] = nextEvents.splice(index, 1);
		nextEvents.splice(safeTarget, 0, item);
		this.setEvents(nextEvents, true);
		if (item) {
			this._emitChange(EditorChangeEvents.EVENT_MOVED, { eventId: item.id, event: item });
		}
	}

	private insertLogicAtIndex(
		eventId: string,
		blockType: EventBlockType,
		block: ICgEventLogicBlock,
		index: number
	) {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		const blockKey = this.getBlockKey(blockType);
		const nextEvents = events.map((event) => {
			if (event.id !== eventId) {
				return event;
			}
			const sectionArr = Array.isArray(event[blockKey]) ? event[blockKey] : [];
			const nextSection = [...sectionArr];
			const safeIndex = Math.max(0, Math.min(index, nextSection.length));
			nextSection.splice(safeIndex, 0, block);
			return { ...event, [blockKey]: nextSection };
		});
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`], { eventId, blockType, index, data: block });
	}

	private removeLogicAtIndex(eventId: string, blockType: EventBlockType, index: number): ICgEventLogicBlock | undefined {
		const events = this._getEvents();
		if (!events) {
			return undefined;
		}
		let removed: ICgEventLogicBlock | undefined;
		const blockKey = this.getBlockKey(blockType);
		const nextEvents = events.map((event) => {
			if (event.id !== eventId) {
				return event;
			}
			const sectionArr = Array.isArray(event[blockKey]) ? event[blockKey] : [];
			if (index < 0 || index >= sectionArr.length) {
				return event;
			}
			const nextSection = [...sectionArr];
			[removed] = nextSection.splice(index, 1);
			return { ...event, [blockKey]: nextSection };
		});
		this.setEvents(nextEvents);
		if (removed) {
			this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_REMOVED`], { eventId, blockType, index });
		}
		return removed;
	}

	private replaceLogicDataAtIndex(eventId: string, blockType: EventBlockType, index: number, data: any) {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		const blockKey = this.getBlockKey(blockType);
		const nextEvents = events.map((event) => {
			if (event.id !== eventId) {
				return event;
			}
			const sectionArr = event[blockKey];
			if (!Array.isArray(sectionArr) || !sectionArr[index]) {
				return event;
			}
			const nextSection = [...sectionArr];
			const previousBlock = nextSection[index];
			const nextBlock = { ...previousBlock, data };
			this.transferLogicBlockUiKey(previousBlock, nextBlock);
			nextSection[index] = nextBlock;
			return { ...event, [blockKey]: nextSection };
		});
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`], { eventId, blockType, index, data });
	}

	private moveLogicWithinEvent(eventId: string, blockType: EventBlockType, index: number, target: number) {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		const blockKey = this.getBlockKey(blockType);
		const nextEvents = events.map((event) => {
			if (event.id !== eventId) {
				return event;
			}
			const sectionArr = event[blockKey];
			if (!Array.isArray(sectionArr) || index < 0 || index >= sectionArr.length) {
				return event;
			}
			const safeTarget = Math.max(0, Math.min(target, sectionArr.length - 1));
			if (safeTarget === index) {
				return event;
			}
			const nextSection = [...sectionArr];
			const [item] = nextSection.splice(index, 1);
			nextSection.splice(safeTarget, 0, item);
			return { ...event, [blockKey]: nextSection };
		});
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_MOVED`], { eventId, blockType, index });
	}

	private setValueAtPath(source: any, path: string[], value: any): any {
		if (path.length === 0) {
			return value;
		}
		const [rawKey, ...rest] = path;
		const isArray = Array.isArray(source);
		const parsedIndex = Number(rawKey);
		const key = isArray && Number.isFinite(parsedIndex) ? parsedIndex : rawKey;
		let clone: any;
		if (Array.isArray(source)) {
			clone = [...source];
		} else if (source && typeof source === 'object') {
			clone = { ...source };
		} else {
			clone = isArray ? [] : {};
		}
		const sourceAny: any = source;
		const current = source && typeof source === 'object' ? sourceAny[key] : undefined;
		clone[key] = this.setValueAtPath(current, rest, value);
		return clone;
	}

	private _toggleEventDisabled(eventId: string): { index: number; previous: ICgEvent; next: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events) { return; }
		const newEvents = events.map((e) =>
			e.id === eventId ? { ...e, disabled: !e.disabled } : e
		);
		this.setEvents(newEvents);
		const updatedEvent = newEvents.find(e => e.id === eventId);
		const previousEvent = events.find(e => e.id === eventId);
		const index = events.findIndex(e => e.id === eventId);
		if (updatedEvent) {
			this._emitChange(EditorChangeEvents.EVENT_UPDATED, { eventId, event: updatedEvent });
		}
		if (!updatedEvent || !previousEvent || index === -1) {
			return;
		}
		return { index, previous: previousEvent, next: updatedEvent };
	}

	private _moveEvent(eventId: string, delta: number): { fromIndex: number; toIndex: number; event: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events) { return; }
		const idx = events.findIndex((e) => e.id === eventId);
		if (idx === -1) { return; }
		const target = idx + delta;
		if (target < 0 || target >= events.length) { return; }

		const newEvents = [...events];
		const [item] = newEvents.splice(idx, 1);
		newEvents.splice(target, 0, item);
		this.setEvents(newEvents, true); // true = reorder only
		this._emitChange(EditorChangeEvents.EVENT_MOVED, { eventId, event: item });
		if (!item) {
			return;
		}
		return { fromIndex: idx, toIndex: target, event: item };
	}

	private _toggleLogicDisabled(eventId: string, blockType: EventBlockType, index: number): { previous: any; next: any } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		let previousData: any;
		let nextData: any;
		let found = false;
		const newEvents = events.map(e => {
			if (e.id !== eventId) { return e; }
			const blockKey = this.getBlockKey(blockType);
			const sectionArr = e[blockKey];
			if (!Array.isArray(sectionArr) || !sectionArr[index]) { return e; }

			const current = sectionArr[index];
			const data = current?.data || {};
			const nextDisable = !data.disabled;
			previousData = data;
			nextData = { ...data, disabled: nextDisable };
			found = true;

			const newSectionArr = [...sectionArr];
			const nextBlock = { ...current, data: nextData };
			this.transferLogicBlockUiKey(current, nextBlock);
			newSectionArr[index] = nextBlock;
			return { ...e, [blockKey]: newSectionArr };
		});
		this.setEvents(newEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		this._emitChange(eventType, { eventId, blockType, index });
		if (!found) {
			return;
		}
		return { previous: previousData, next: nextData };
	}

	private _moveLogic(eventId: string, blockType: EventBlockType, index: number, delta: number): { fromIndex: number; toIndex: number } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		const newEvents = events.map(e => {
			if (e.id !== eventId) { return e; }
			const blockKey = this.getBlockKey(blockType);
			const sectionArr = e[blockKey];
			if (!Array.isArray(sectionArr)) { return e; }
			const target = index + delta;
			if (index < 0 || index >= sectionArr.length || target < 0 || target >= sectionArr.length) { return e; }

			const newSectionArr = [...sectionArr];
			const [item] = newSectionArr.splice(index, 1);
			newSectionArr.splice(target, 0, item);
			return { ...e, [blockKey]: newSectionArr };
		});
		this.setEvents(newEvents); // Logic reorder affects event data
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_MOVED`];
		this._emitChange(eventType, { eventId, blockType, index });
		const targetIndex = index + delta;
		if (targetIndex < 0) {
			return;
		}
		return { fromIndex: index, toIndex: targetIndex };
	}

	private _moveLogicToIndex(eventId: string, blockType: EventBlockType, index: number, targetIndex: number): { fromIndex: number; toIndex: number } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		let finalIndex = -1;
		const newEvents = events.map(e => {
			if (e.id !== eventId) { return e; }
			const blockKey = this.getBlockKey(blockType);
			const sectionArr = e[blockKey];
			if (!Array.isArray(sectionArr)) { return e; }
			if (index < 0 || index >= sectionArr.length) { return e; }

			const newSectionArr = [...sectionArr];
			const [item] = newSectionArr.splice(index, 1);
			const insertAt = Math.max(0, Math.min(targetIndex, newSectionArr.length));
			newSectionArr.splice(insertAt, 0, item);
			finalIndex = insertAt;
			return { ...e, [blockKey]: newSectionArr };
		});
		this.setEvents(newEvents); // Logic reorder affects event data
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_MOVED`];
		this._emitChange(eventType, { eventId, blockType, index });
		if (finalIndex < 0) {
			return;
		}
		return { fromIndex: index, toIndex: finalIndex };
	}

	private _moveLogicToEvent(
		eventId: string,
		blockType: EventBlockType,
		index: number,
		targetEventId: string,
		targetIndex?: number,
	): { sourceEventId: string; targetEventId: string; sourceIndex: number; targetIndex: number; block: ICgEventLogicBlock } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		const sourceEvt = events.find(e => e.id === eventId);
		if (!sourceEvt) { return; }
		const blockKey = this.getBlockKey(blockType);
		const sourceArr = sourceEvt[blockKey];
		if (!Array.isArray(sourceArr) || !sourceArr[index]) { return; }
		const itemToMove = sourceArr[index];
		const targetEvt = events.find(e => e.id === targetEventId);
		const targetArr = Array.isArray(targetEvt?.[blockKey]) ? targetEvt[blockKey] : [];
		const insertAt = targetIndex === undefined
			? targetArr.length
			: Math.max(0, Math.min(targetIndex, targetArr.length));

		// If source and target are the same, use normal move logic
		if (eventId === targetEventId) {
			const targetIdx = targetIndex ?? (sourceArr.length - 1);
			const moveResult = this._moveLogicToIndex(eventId, blockType, index, targetIdx);
			if (!moveResult) {
				return;
			}
			return {
				sourceEventId: eventId,
				targetEventId,
				sourceIndex: moveResult.fromIndex,
				targetIndex: moveResult.toIndex,
				block: itemToMove,
			};
		}

		const newEvents = events.map(e => {
			if (e.id === eventId) {
				// Remove from source
				const sectionArr = e[blockKey];
				const newArr = [...(Array.isArray(sectionArr) ? sectionArr : [])];
				newArr.splice(index, 1);
				return { ...e, [blockKey]: newArr };
			}
			if (e.id === targetEventId) {
				// Add to target
				const sectionArr = e[blockKey];
				const newArr = [...(Array.isArray(sectionArr) ? sectionArr : [])];
				const insertAt = targetIndex === undefined
					? newArr.length
					: Math.max(0, Math.min(targetIndex, newArr.length));
				newArr.splice(insertAt, 0, itemToMove);
				return { ...e, [blockKey]: newArr };
			}
			return e;
		});
		this.setEvents(newEvents);
		const removeType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_REMOVED`];
		this._emitChange(removeType, { eventId, blockType, index });
		const addType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`];
		this._emitChange(addType, { eventId: targetEventId, blockType, index: insertAt, data: itemToMove });
		return {
			sourceEventId: eventId,
			targetEventId,
			sourceIndex: index,
			targetIndex: insertAt,
			block: itemToMove,
		};
	}

	private _moveLogicSelectionToEvent(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number; block: ICgEventLogicBlock }>,
		targetEventId: string,
		targetIndex: number
	): { previousEvents: ICgEvent[]; nextEvents: ICgEvent[]; affectedEventIds: string[] } | undefined {
		const events = this._getEvents();
		if (!events || selection.length === 0) {
			return;
		}

		const blockKey = this.getBlockKey(blockType);
		const targetEvent = events.find((evt) => evt.id === targetEventId);
		const targetArr = targetEvent ? targetEvent[blockKey] : undefined;
		if (!Array.isArray(targetArr)) {
			return;
		}

		const removalsByEvent = new Map<string, number[]>();
		const affectedEventIds: string[] = [];

		for (let i = 0; i < selection.length; i++) {
			const entry = selection[i];
			if (!entry) {
				continue;
			}
			const indices = removalsByEvent.get(entry.eventId);
			if (indices) {
				indices.push(entry.index);
				continue;
			}
			removalsByEvent.set(entry.eventId, [entry.index]);
			affectedEventIds.push(entry.eventId);
		}

		if (!removalsByEvent.has(targetEventId)) {
			affectedEventIds.push(targetEventId);
		}

		const blocksToInsert: ICgEventLogicBlock[] = [];
		for (let i = 0; i < selection.length; i++) {
			const block = selection[i]?.block;
			if (block) {
				blocksToInsert.push(block);
			}
		}
		if (blocksToInsert.length === 0) {
			return;
		}

		for (const indices of removalsByEvent.values()) {
			indices.sort((a, b) => b - a);
		}

		const insertAtTarget = Math.max(0, Math.min(Math.floor(targetIndex), targetArr.length));

		const nextEvents = events.map((event) => {
			const eventId = event.id;
			const isTarget = eventId === targetEventId;
			const removalIndices = removalsByEvent.get(eventId);
			if (!isTarget && (!removalIndices || removalIndices.length === 0)) {
				return event;
			}

			const sectionArr = event[blockKey];
			if (!Array.isArray(sectionArr)) {
				return event;
			}

			let nextSection = sectionArr;
			if (removalIndices && removalIndices.length > 0) {
				const cloned = [...nextSection];
				for (let i = 0; i < removalIndices.length; i++) {
					const index = removalIndices[i];
					if (index >= 0 && index < cloned.length) {
						cloned.splice(index, 1);
					}
				}
				nextSection = cloned;
			}

			if (isTarget) {
				const base = nextSection === sectionArr ? [...nextSection] : nextSection;
				const insertAt = Math.max(0, Math.min(insertAtTarget, base.length));
				for (let i = 0; i < blocksToInsert.length; i++) {
					const block = blocksToInsert[i];
					const clone: ICgEventLogicBlock = {
						type: block?.type ?? '',
						data: block?.data ? { ...block.data } : {},
					};
					base.splice(insertAt + i, 0, clone);
				}
				nextSection = base;
			}

			if (nextSection === sectionArr) {
				return event;
			}
			return { ...event, [blockKey]: nextSection };
		});

		this.setEvents(nextEvents);
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		for (let i = 0; i < affectedEventIds.length; i++) {
			this._emitChange(updateType, { eventId: affectedEventIds[i], blockType });
		}

		return { previousEvents: events, nextEvents, affectedEventIds };
	}

	private _updateLogicData(eventId: string, blockType: EventBlockType, index: number, data: any): { previous: any; next: any } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		let previousData: any;
		let found = false;
		const newEvents = events.map(e => {
			if (e.id !== eventId) { return e; }
			const blockKey = this.getBlockKey(blockType);
			const sectionArr = e[blockKey];
			if (!Array.isArray(sectionArr) || !sectionArr[index]) { return e; }

			const newSectionArr = [...sectionArr];
			const previousBlock = newSectionArr[index];
			previousData = previousBlock?.data;
			found = true;
			const nextBlock = { ...previousBlock, data };
			this.transferLogicBlockUiKey(previousBlock, nextBlock);
			newSectionArr[index] = nextBlock;
			return { ...e, [blockKey]: newSectionArr };
		});
		this.setEvents(newEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		this._emitChange(eventType, { eventId, blockType, index, data });
		if (!found) {
			return;
		}
		return { previous: previousData, next: data };
	}

	private _updateLogicField(
		eventId: string,
		blockType: EventBlockType,
		index: number,
		path: string[],
		value: any,
	): { previous: any; next: any } | undefined {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		const blockKey = this.getBlockKey(blockType);
		const event = events.find((evt) => evt.id === eventId);
		const sectionArr = event ? event[blockKey] : undefined;
		if (!Array.isArray(sectionArr) || !sectionArr[index]) {
			return;
		}
		const currentData = sectionArr[index]?.data ?? {};
		const nextData = this.setValueAtPath(currentData, path, value);
		this.replaceLogicDataAtIndex(eventId, blockType, index, nextData);
		return { previous: currentData, next: nextData };
	}

	private _removeLogic(eventId: string, blockType: EventBlockType, index: number): { index: number; block: ICgEventLogicBlock } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		let removed: ICgEventLogicBlock | undefined;
		const newEvents = events.map(e => {
			if (e.id !== eventId) { return e; }
			const blockKey = this.getBlockKey(blockType);
			const sectionArr = e[blockKey];
			if (!Array.isArray(sectionArr) || index < 0 || index >= sectionArr.length) { return e; }

			const newSectionArr = [...sectionArr];
			[removed] = newSectionArr.splice(index, 1);
			return { ...e, [blockKey]: newSectionArr };
		});
		this.setEvents(newEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_REMOVED`];
		this._emitChange(eventType, { eventId, blockType, index });
		if (!removed) {
			return;
		}
		return { index, block: removed };
	}

	private _addLogic(eventId: string, blockType: EventBlockType, type: string): { index: number; block: ICgEventLogicBlock } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		let insertIndex = -1;
		const newBlock: ICgEventLogicBlock = { type, data: {} };
		const newEvents = events.map(e => {
			if (e.id !== eventId) { return e; }
			const blockKey = this.getBlockKey(blockType);
			const sectionArr = e[blockKey];
			if (!Array.isArray(sectionArr)) { return e; }
			insertIndex = sectionArr.length;
			return { ...e, [blockKey]: [...sectionArr, newBlock] };
		});
		this.setEvents(newEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`];
		this._emitChange(eventType, { eventId, blockType, index: insertIndex, data: newBlock });
		if (insertIndex < 0) {
			return;
		}
		return { index: insertIndex, block: newBlock };
	}

	private _insertLogic(
		eventId: string,
		blockType: EventBlockType,
		block: ICgEventLogicBlock,
		targetIndex?: number,
	): { index: number; block: ICgEventLogicBlock } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		let insertIndex = -1;
		let insertedBlock: ICgEventLogicBlock | undefined;
		const newEvents = events.map(e => {
			if (e.id !== eventId) { return e; }
			const blockKey = this.getBlockKey(blockType);
			const sectionArr = e[blockKey];
			if (!Array.isArray(sectionArr)) { return e; }

			// Shallow copy is sufficient - the data object is not modified after insertion
			const clone: ICgEventLogicBlock = {
				type: block?.type ?? '',
				data: block?.data ? { ...block.data } : {},
			};
			insertedBlock = clone;

			const newSectionArr = [...sectionArr];
			const insertAt = targetIndex === undefined
				? newSectionArr.length
				: Math.max(0, Math.min(targetIndex, newSectionArr.length));
			newSectionArr.splice(insertAt, 0, clone);
			insertIndex = insertAt;

			return { ...e, [blockKey]: newSectionArr };
		});
		this.setEvents(newEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`];
		this._emitChange(eventType, { eventId, blockType, index: insertIndex, data: block });
		if (insertIndex < 0 || !insertedBlock) {
			return;
		}
		return { index: insertIndex, block: insertedBlock };
	}

	private _removeEvent(eventId: string): { index: number; event: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events) { return; }
		const index = events.findIndex((e) => e.id === eventId);
		if (index === -1) {
			return;
		}
		const removedEvent = this.removeEventAtIndex(index);
		if (!removedEvent) {
			return;
		}
		return { index, event: removedEvent };
	}

	private _updateEvent(eventId: string, patch: Partial<ICgEvent>): { index: number; previous: ICgEvent; next: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		const idx = events.findIndex((e) => e.id === eventId);
		if (idx === -1) { return; }

		let nextPatch = patch;
		if (typeof nextPatch.id === 'string') {
			const trimmed = nextPatch.id.trim();
			const duplicate = trimmed.length > 0 && events.some((e, i) => i !== idx && e.id === trimmed);
			if (!trimmed || duplicate) {
				return;
			}
			if (trimmed !== nextPatch.id) {
				nextPatch = { ...nextPatch, id: trimmed };
			}
		}

		const newEvents = events.map((e, i) =>
			i === idx ? { ...e, ...nextPatch } : e
		);
		this.setEvents(newEvents);
		const updatedEvent = newEvents[idx];
		if (updatedEvent) {
			this._emitChange(EditorChangeEvents.EVENT_UPDATED, { eventId: updatedEvent.id, event: updatedEvent });
		}
		const previousEvent = events[idx];
		if (!updatedEvent || !previousEvent) {
			return;
		}
		return { index: idx, previous: previousEvent, next: updatedEvent };
	}

	private _updateConfig(configPatch: Record<string, any>): { previous: Record<string, any>; next: Record<string, any> } | undefined {
		const doc = this.getEventsJson();
		if (!doc || !this._entry) { return; }
		const previousConfig = { ...(doc.config ?? {}) };
		const nextConfig = { ...previousConfig, ...configPatch };
		this._replaceDocument({ ...doc, config: nextConfig });
		this._emitChange(EditorChangeEvents.CONFIG_UPDATED, { config: nextConfig });
		return { previous: previousConfig, next: nextConfig };
	}

	private replaceConfig(nextConfig: Record<string, any>) {
		const doc = this.getEventsJson();
		if (!doc || !this._entry) {
			return;
		}
		this._replaceDocument({ ...doc, config: nextConfig });
		this._emitChange(EditorChangeEvents.CONFIG_UPDATED, { config: nextConfig });
	}
}

export const editor = new CgEventsEditor();

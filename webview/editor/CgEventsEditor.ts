import {
	ICgAppInfo,
	ICgEvent,
	ICgEventLogicBlock,
	ICgEventsDocument,
	ICgEventsDocumentConfig,
	ICgEventsFormat,
	ICgEventsParseResult,
	ICgEventsParseSuccess,
	ICgEventsSchema,
	ICgItemInfoList,
	ISortingPreset,
	ObjectUtil,
	isCgEventsDocument
} from '@shared';
import { EventEmitter } from '../utils/EventEmitter';
import { setOwnValueAtPath } from '../utils/ownPath';
import { EditorHistory, EditorHistoryEntry } from './EditorHistory';
import { cloneEditorEntry, cloneEditorValue } from './EditorSnapshots';
import { createDefaultEvent } from './EventDefaults';
import { generateDuplicateEventId, generateEventId } from './EventIdGeneration';
import { ebtConv, EventBlockType, type LogicBlockKey } from './eventBlockTypes';
import {
	type LogicBlockMoveResult,
	moveLogicBlockByDelta,
	moveLogicBlockToEvent,
	moveLogicBlockToIndex,
} from './LogicBlockMoveMutations';
import { LogicBlockUiIdentityRegistry } from './LogicBlockUiIdentityRegistry';
import { normalizeClampedIndex, resolveRelativeIndex } from './editorIndex';
import {
	type LogicSelectionMutationResult,
	insertLogicBlocks,
	moveLogicSelectionToBoundary,
	moveLogicSelectionToEvent,
	removeLogicSelection,
	toggleLogicSelectionDisabled,
} from './LogicSelectionMutations';

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
	previousEventId?: string;
	blockType?: EventBlockType;
	index?: number;
	event?: ICgEvent;
	previousEvent?: ICgEvent;
	events?: ICgEvent[];
	config?: Record<string, any>;
	data?: any;
}

export class CgEventsEditor extends EventEmitter {
	private _format?: ICgEventsFormat;
	private _entry?: ICgEventsParseSuccess;
	private _documentVersion?: number;
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

	private readonly logicBlockUiIdentity = new LogicBlockUiIdentityRegistry();

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

	updateConfig(configPatch: Partial<ICgEventsDocumentConfig>) {
		const result = this._updateConfig(configPatch);
		if (!result) {
			return;
		}
		const previous = cloneEditorValue(result.previous) ?? result.previous;
		const next = cloneEditorValue(result.next) ?? result.next;
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
		this.recordLogicInsertionHistory(eventId, blockType, result.index, result.block);
	}

	insertLogic(eventId: string, blockType: EventBlockType, block: ICgEventLogicBlock, targetIndex?: number) {
		const result = this._insertLogic(eventId, blockType, block, targetIndex);
		if (!result) {
			return;
		}
		this.recordLogicInsertionHistory(eventId, blockType, result.index, result.block);
	}

	updateLogicData(eventId: string, blockType: EventBlockType, index: number, data: any) {
		const result = this._updateLogicData(eventId, blockType, index, data);
		if (!result) {
			return;
		}
		this.recordLogicDataHistory(eventId, blockType, index, result);
	}

	updateLogicField(eventId: string, blockType: EventBlockType, index: number, path: string[], value: any) {
		const result = this._updateLogicField(eventId, blockType, index, path, value);
		if (!result) {
			return;
		}
		this.recordLogicDataHistory(eventId, blockType, index, result);
	}

	removeLogic(eventId: string, blockType: EventBlockType, index: number) {
		const result = this._removeLogic(eventId, blockType, index);
		if (!result) {
			return;
		}
		const storedBlock = this.cloneLogicBlockWithUiIdentity(result.block);
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
		this.recordLogicMoveHistory(eventId, blockType, result);
	}

	moveLogicToIndex(eventId: string, blockType: EventBlockType, index: number, targetIndex: number) {
		const result = this._moveLogicToIndex(eventId, blockType, index, targetIndex);
		if (!result) {
			return;
		}
		this.recordLogicMoveHistory(eventId, blockType, result);
	}

	moveLogicToEvent(eventId: string, blockType: EventBlockType, index: number, targetEventId: string, targetIndex?: number) {
		const result = this._moveLogicToEvent(eventId, blockType, index, targetEventId, targetIndex);
		if (!result) {
			return;
		}
		const storedBlock = this.cloneLogicBlockWithUiIdentity(result.block);
		const cloneForInsert = () => this.cloneLogicBlockWithUiIdentity(storedBlock);
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
		this.recordLogicSelectionHistory(blockType, result);
	}

	removeLogicSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._removeLogicSelection(blockType, selection);
		if (!result) {
			return;
		}
		this.recordLogicSelectionHistory(blockType, result);
	}

	toggleLogicDisabledSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._toggleLogicDisabledSelection(blockType, selection);
		if (!result) {
			return;
		}
		this.recordLogicSelectionHistory(blockType, result);
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
		this.recordLogicSelectionHistory(blockType, result);
	}

	moveLogicSelectionToTop(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._moveLogicSelectionToBoundary(blockType, selection, 'top');
		if (!result) {
			return;
		}
		this.recordLogicSelectionHistory(blockType, result);
	}

	moveLogicSelectionToBottom(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	) {
		const result = this._moveLogicSelectionToBoundary(blockType, selection, 'bottom');
		if (!result) {
			return;
		}
		this.recordLogicSelectionHistory(blockType, result);
	}

	toggleLogicDisabled(eventId: string, blockType: EventBlockType, index: number) {
		const result = this._toggleLogicDisabled(eventId, blockType, index);
		if (!result) {
			return;
		}
		this.recordLogicDataHistory(eventId, blockType, index, result);
	}

	private recordLogicMoveHistory(
		eventId: string,
		blockType: EventBlockType,
		result: { fromIndex: number; toIndex: number },
	): void {
		this.recordHistory({
			undo: () => this.moveLogicWithinEvent(eventId, blockType, result.toIndex, result.fromIndex),
			redo: () => this.moveLogicWithinEvent(eventId, blockType, result.fromIndex, result.toIndex),
		});
	}

	private recordLogicInsertionHistory(
		eventId: string,
		blockType: EventBlockType,
		index: number,
		block: ICgEventLogicBlock,
	): void {
		const storedBlock = this.cloneLogicBlockWithUiIdentity(block);
		this.recordHistory({
			undo: () => this.removeLogicAtIndex(eventId, blockType, index),
			redo: () => this.insertLogicAtIndex(eventId, blockType, storedBlock, index),
		});
	}

	private recordLogicDataHistory(
		eventId: string,
		blockType: EventBlockType,
		index: number,
		result: { previous: any; next: any },
	): void {
		const previous = cloneEditorValue(result.previous) ?? result.previous;
		const next = cloneEditorValue(result.next) ?? result.next;
		this.recordHistory({
			undo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, previous),
			redo: () => this.replaceLogicDataAtIndex(eventId, blockType, index, next),
		});
	}

	private recordLogicSelectionHistory(
		blockType: EventBlockType,
		result: LogicSelectionMutationResult,
	): void {
		this.recordHistory({
			undo: () => this.restoreEventsForLogicSelection(result.previousEvents, blockType, result.affectedEventIds),
			redo: () => this.restoreEventsForLogicSelection(result.nextEvents, blockType, result.affectedEventIds),
		});
	}

	private emitLogicSelectionUpdates(blockType: EventBlockType, affectedEventIds: string[]): void {
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		for (let i = 0; i < affectedEventIds.length; i++) {
			this.emit(updateType, { eventId: affectedEventIds[i], blockType });
		}
		this.emit(EditorChangeEvents.CHANGE, { blockType });
	}

	private restoreEventsForLogicSelection(events: ICgEvent[], blockType: EventBlockType, affectedEventIds: string[]) {
		this.setEvents(events);
		this.emitLogicSelectionUpdates(blockType, affectedEventIds);
	}

	private applyLogicSelectionMutationResult(
		blockType: EventBlockType,
		result: LogicSelectionMutationResult | undefined,
	): LogicSelectionMutationResult | undefined {
		if (!result) {
			return undefined;
		}
		for (const replacement of result.blockReplacements) {
			this.transferLogicBlockUiKey(replacement.previous, replacement.next);
		}
		this.setEvents(result.nextEvents);
		this.emitLogicSelectionUpdates(blockType, result.affectedEventIds);
		return result;
	}


	private _removeLogicSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	): LogicSelectionMutationResult | undefined {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		return this.applyLogicSelectionMutationResult(
			blockType,
			removeLogicSelection(events, this.getBlockKey(blockType), selection),
		);
	}

	private _toggleLogicDisabledSelection(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>
	): LogicSelectionMutationResult | undefined {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		return this.applyLogicSelectionMutationResult(
			blockType,
			toggleLogicSelectionDisabled(events, this.getBlockKey(blockType), selection),
		);
	}

	private _insertLogicBlocks(
		eventId: string,
		blockType: EventBlockType,
		blocks: ICgEventLogicBlock[],
		targetIndex: number
	): LogicSelectionMutationResult | undefined {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		const result = insertLogicBlocks(
			events,
			this.getBlockKey(blockType),
			this.getEventIndex(eventId),
			blocks,
			targetIndex,
		);
		if (!result) {
			return;
		}
		this.setEvents(result.nextEvents);
		const updateType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		this._emitChange(updateType, { eventId, blockType });
		return result;
	}

	private _moveLogicSelectionToBoundary(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number }>,
		target: 'top' | 'bottom'
	): LogicSelectionMutationResult | undefined {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		return this.applyLogicSelectionMutationResult(
			blockType,
			moveLogicSelectionToBoundary(
				events,
				this.getBlockKey(blockType),
				selection,
				target,
			),
		);
	}

	/**
	 * Gets the order version (increments when events are reordered)
	 */
	getOrderVersion(): number {
		return this.eventOrderVersion;
	}

	getEventsJson(): ICgEventsDocument | undefined {
		return this._entry?.json;
	}
	getEventsFormat() {
		return this._entry?.format ?? this._format;
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
		return this.logicBlockUiIdentity.getKey(block);
	}

	private transferLogicBlockUiKey(from: ICgEventLogicBlock, to: ICgEventLogicBlock): void {
		this.logicBlockUiIdentity.transfer(from, to);
	}

	private cloneLogicBlockWithUiIdentity(block: ICgEventLogicBlock): ICgEventLogicBlock {
		this.getLogicBlockUiKey(block);
		const cloned = cloneEditorValue(block) ?? block;
		if (cloned !== block) {
			this.transferLogicBlockUiKey(block, cloned);
		}
		return cloned;
	}
	getLogicBlock(eventId: string, blockType: EventBlockType, index: number): ICgEventLogicBlock | undefined {
		const blocks = this.getLogicBlocks(eventId, blockType);
		return blocks[index];
	}

	private getBlockKey(blockType: EventBlockType): LogicBlockKey {
		return ebtConv.COMPLEX[blockType];
	}

	private getLogicSectionTarget(eventId: string, blockType: EventBlockType) {
		const events = this._getEvents();
		if (!events) return undefined;
		const eventIndex = this.getEventIndex(eventId);
		if (eventIndex === -1) return undefined;
		const event = events[eventIndex];
		if (!event) return undefined;
		const blockKey = this.getBlockKey(blockType);
		const section = event[blockKey];
		if (!Array.isArray(section)) return undefined;
		return { events, eventIndex, event, blockKey, section };
	}

	private getLogicMutationTarget(eventId: string, blockType: EventBlockType, index: number) {
		const target = this.getLogicSectionTarget(eventId, blockType);
		if (!target || index < 0 || index >= target.section.length) return undefined;
		const block = target.section[index];
		if (!block) return undefined;
		return { ...target, block };
	}

	private _emitChange(eventType: EditorChangeEventType = EditorChangeEvents.CHANGE, payload?: EditorChangeEventPayload) {
		if (eventType !== EditorChangeEvents.CHANGE) {
			this.emit(eventType, payload);
		}
		this.emit(EditorChangeEvents.CHANGE, payload);
	}

	private _replaceDocument(nextDoc: ICgEventsDocument): boolean {
		if (!this._entry) {
			return false;
		}
		const currentJson = this._entry.json;
		if (currentJson.config === nextDoc.config && currentJson.events === nextDoc.events) {
			return false;
		}
		this._entry = {
			...this._entry,
			json: {
				...currentJson,
				config: nextDoc.config,
				events: nextDoc.events,
			},
		};
		return true;
	}

	setCgEventsJson(json: ICgEventsParseResult) {
		this._documentVersion = json.documentVersion;
		if (json.format !== 'error' && this._entry?.format === json.format && ObjectUtil.equals(this._entry.json, json.json)) {
			this._format = json.format;
			this._entry = { ...this._entry, documentVersion: json.documentVersion };
			return;
		}
		this._format = json.format;
		this.eventOrderVersion = 0;
		this.clearHistory();
		this.cachedEventsRef = undefined;
		this.cachedEventById.clear();
		this.cachedEventIndexById.clear();
		this.logicBlockUiIdentity.reset();
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

	setCgApp(cgapp: ICgAppInfo | undefined) {
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

	setItems(items: ICgItemInfoList | undefined) {
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
		const doc = this.getEventsJson();
		if (!doc || !this._replaceDocument({ ...doc, events })) {
			return;
		}
		if (isReorder) {
			this.eventOrderVersion++;
		}
	}

	private _addEvent(partial?: { folder?: string }): { event: ICgEvent; index: number } | undefined {
		const doc = this.getEventsJson();
		if (!doc) {
			return;
		}
		const nextEvent = createDefaultEvent(
			generateEventId(doc.events),
			{ folder: partial?.folder },
		);
		this.setEvents([...doc.events, nextEvent]);
		this._emitChange(EditorChangeEvents.EVENT_ADDED, { eventId: nextEvent.id, event: nextEvent });
		return { event: nextEvent, index: doc.events.length };
	}

	private restoreEntry(
		entry?: ICgEventsParseSuccess,
		parseError?: any,
		format?: ICgEventsFormat,
	) {
		this._entry = entry;
		this._parseError = parseError;
		this._format = entry?.format ?? format;
		this._emitChange(EditorChangeEvents.DOCUMENT_UPDATED);
	}

	private replaceEntryJson(nextJson: ICgEventsDocument) {
		const documentVersion = this._entry?.documentVersion ?? this._documentVersion;
		if (!this._entry) {
			this._entry = { format: 'json', json: nextJson, documentVersion };
		} else {
			this._entry = { ...this._entry, json: nextJson, documentVersion };
		}
		this._format = this._entry.format;
		this._parseError = undefined;
		this._emitChange(EditorChangeEvents.DOCUMENT_UPDATED);
	}


	private _duplicateEvent(eventId: string): { event: ICgEvent; index: number } | undefined {
		const events = this._getEvents();
		if (!events) { return; }

		const idx = this.getEventIndex(eventId);
		if (idx === -1) { return; }

		const sourceEvent = events[idx];
		if (!sourceEvent) { return; }

		const nextId = generateDuplicateEventId(sourceEvent.id, events);
		const clonedEvent: ICgEvent = { ...cloneEditorValue(sourceEvent), id: nextId };

		const newEvents = [...events];
		newEvents.splice(idx + 1, 0, clonedEvent);
		this.setEvents(newEvents);
		this._emitChange(EditorChangeEvents.EVENT_ADDED, { eventId: clonedEvent.id, event: clonedEvent });
		return { event: clonedEvent, index: idx + 1 };
	}

	getCurrentEntry(): ICgEventsParseSuccess | undefined {
		const doc = this.getEventsJson();
		if (!this._entry || !doc) {
			return undefined;
		}
		return {
			format: this._entry.format,
			documentVersion: this._entry.documentVersion,
			json: {
				...this._entry.json,
				config: doc.config,
				events: doc.events,
			},
		};
	}

	setFormat(format: Exclude<ICgEventsFormat, 'error'>) {
		if (!this._entry || this._entry.format === format) {
			return;
		}
		this._entry = {
			...this._entry,
			format,
		};
		this._format = format;
		this._emitChange(EditorChangeEvents.FORMAT_UPDATED);
	}

	applyJsonText(raw: string): Error | null {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (!isCgEventsDocument(parsed)) {
				throw new Error('Invalid events document structure');
			}
			if (this._entry && ObjectUtil.equals(this._entry.json, parsed)) {
				return null;
			}
			const previousEntry = cloneEditorEntry(this._entry);
			const previousError = this._parseError;
			const previousFormat = this.getEventsFormat();
			this.replaceEntryJson(parsed);
			const nextEntry = cloneEditorEntry(this._entry);
			const nextFormat = this.getEventsFormat();
			if (nextEntry) {
				this.recordHistory({
					undo: () => this.restoreEntry(previousEntry, previousError, previousFormat),
					redo: () => this.restoreEntry(nextEntry, undefined, nextFormat),
				});
			}
			return null;
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
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
		const safeIndex = normalizeClampedIndex(index, events.length);
		if (safeIndex === undefined) {
			return;
		}
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
		const previousEvent = events[index];
		if (!previousEvent) {
			return;
		}
		const nextEvents = [...events];
		nextEvents[index] = nextEvent;
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents.EVENT_UPDATED, {
			eventId: nextEvent.id,
			previousEventId: previousEvent.id,
			event: nextEvent,
			previousEvent,
		});
	}

	private moveEventByIndex(index: number, target: number): { fromIndex: number; toIndex: number; event: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events || index < 0 || index >= events.length) {
			return;
		}
		const sourceIndex = normalizeClampedIndex(index, events.length - 1);
		const safeTarget = normalizeClampedIndex(target, events.length - 1);
		if (sourceIndex === undefined || safeTarget === undefined || safeTarget === sourceIndex) {
			return;
		}
		const nextEvents = [...events];
		const [item] = nextEvents.splice(sourceIndex, 1);
		if (!item) {
			return;
		}
		nextEvents.splice(safeTarget, 0, item);
		this.setEvents(nextEvents, true);
		this._emitChange(EditorChangeEvents.EVENT_MOVED, { eventId: item.id, event: item });
		return { fromIndex: sourceIndex, toIndex: safeTarget, event: item };
	}

	private insertLogicAtIndex(
		eventId: string,
		blockType: EventBlockType,
		block: ICgEventLogicBlock,
		index: number
	) {
		const target = this.getLogicSectionTarget(eventId, blockType);
		if (!target) return;
		const nextSection = [...target.section];
		const safeIndex = normalizeClampedIndex(index, nextSection.length);
		if (safeIndex === undefined) return;
		nextSection.splice(safeIndex, 0, block);
		const nextEvents = [...target.events];
		nextEvents[target.eventIndex] = { ...target.event, [target.blockKey]: nextSection };
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`], { eventId, blockType, index, data: block });
	}

	private removeLogicAtIndex(eventId: string, blockType: EventBlockType, index: number): ICgEventLogicBlock | undefined {
		const target = this.getLogicMutationTarget(eventId, blockType, index);
		if (!target) return undefined;
		const nextSection = [...target.section];
		const [removed] = nextSection.splice(index, 1);
		if (!removed) return undefined;
		const nextEvents = [...target.events];
		nextEvents[target.eventIndex] = { ...target.event, [target.blockKey]: nextSection };
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_REMOVED`], { eventId, blockType, index });
		return removed;
	}

	private replaceLogicDataAtIndex(eventId: string, blockType: EventBlockType, index: number, data: any) {
		const target = this.getLogicMutationTarget(eventId, blockType, index);
		if (!target || ObjectUtil.equals(target.block.data, data)) return;
		const nextBlock = { ...target.block, data };
		this.transferLogicBlockUiKey(target.block, nextBlock);
		const nextSection = [...target.section];
		nextSection[index] = nextBlock;
		const nextEvents = [...target.events];
		nextEvents[target.eventIndex] = { ...target.event, [target.blockKey]: nextSection };
		this.setEvents(nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`], { eventId, blockType, index, data });
	}

	private applyLogicMoveWithinEvent(
		blockType: EventBlockType,
		result: LogicBlockMoveResult | undefined,
	): LogicBlockMoveResult | undefined {
		if (!result) return;
		this.setEvents(result.nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_MOVED`], {
			eventId: result.sourceEventId,
			blockType,
			index: result.sourceIndex,
		});
		return result;
	}

	private moveLogicWithinEvent(eventId: string, blockType: EventBlockType, index: number, target: number) {
		const events = this._getEvents();
		if (!events) return;
		this.applyLogicMoveWithinEvent(
			blockType,
			moveLogicBlockToIndex(
				events,
				this.getBlockKey(blockType),
				this.getEventIndex(eventId),
				index,
				target,
			),
		);
	}

	private _toggleEventDisabled(eventId: string): { index: number; previous: ICgEvent; next: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events) { return; }
		const index = this.getEventIndex(eventId);
		if (index === -1) { return; }
		const previousEvent = events[index];
		if (!previousEvent) { return; }
		const updatedEvent = { ...previousEvent, disabled: !previousEvent.disabled };
		this.replaceEventAtIndex(index, updatedEvent);
		return { index, previous: previousEvent, next: updatedEvent };
	}

	private _moveEvent(eventId: string, delta: number): { fromIndex: number; toIndex: number; event: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events) { return; }
		const index = this.getEventIndex(eventId);
		if (index === -1) { return; }
		const target = resolveRelativeIndex(index, delta, events.length);
		if (target === undefined || target === index) { return; }
		return this.moveEventByIndex(index, target);
	}

	private _toggleLogicDisabled(eventId: string, blockType: EventBlockType, index: number): { previous: any; next: any } | undefined {
		const target = this.getLogicMutationTarget(eventId, blockType, index);
		if (!target) return;
		const previousData = target.block.data || {};
		const nextData = { ...previousData, disabled: !previousData.disabled };
		const nextBlock = { ...target.block, data: nextData };
		this.transferLogicBlockUiKey(target.block, nextBlock);
		const nextSection = [...target.section];
		nextSection[index] = nextBlock;
		const nextEvents = [...target.events];
		nextEvents[target.eventIndex] = { ...target.event, [target.blockKey]: nextSection };
		this.setEvents(nextEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		this._emitChange(eventType, { eventId, blockType, index });
		return { previous: previousData, next: nextData };
	}

	private _moveLogic(eventId: string, blockType: EventBlockType, index: number, delta: number): { fromIndex: number; toIndex: number } | undefined {
		const events = this._getEvents();
		if (!events) return;
		const result = this.applyLogicMoveWithinEvent(
			blockType,
			moveLogicBlockByDelta(
				events,
				this.getBlockKey(blockType),
				this.getEventIndex(eventId),
				index,
				delta,
			),
		);
		return result
			? { fromIndex: result.sourceIndex, toIndex: result.targetIndex }
			: undefined;
	}

	private _moveLogicToIndex(eventId: string, blockType: EventBlockType, index: number, targetIndex: number): { fromIndex: number; toIndex: number } | undefined {
		const events = this._getEvents();
		if (!events) return;
		const result = this.applyLogicMoveWithinEvent(
			blockType,
			moveLogicBlockToIndex(
				events,
				this.getBlockKey(blockType),
				this.getEventIndex(eventId),
				index,
				targetIndex,
			),
		);
		return result
			? { fromIndex: result.sourceIndex, toIndex: result.targetIndex }
			: undefined;
	}

	private _moveLogicToEvent(
		eventId: string,
		blockType: EventBlockType,
		index: number,
		targetEventId: string,
		targetIndex?: number,
	): LogicBlockMoveResult | undefined {
		const events = this._getEvents();
		if (!events) return;
		const result = moveLogicBlockToEvent(
			events,
			this.getBlockKey(blockType),
			this.getEventIndex(eventId),
			index,
			this.getEventIndex(targetEventId),
			targetIndex,
		);
		if (!result) return;

		if (result.sourceEventId === result.targetEventId) {
			return this.applyLogicMoveWithinEvent(blockType, result);
		}

		this.setEvents(result.nextEvents);
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_REMOVED`], {
			eventId,
			blockType,
			index,
		});
		this._emitChange(EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`], {
			eventId: targetEventId,
			blockType,
			index: result.targetIndex,
			data: result.block,
		});
		return result;
	}

	private _moveLogicSelectionToEvent(
		blockType: EventBlockType,
		selection: Array<{ eventId: string; index: number; block: ICgEventLogicBlock }>,
		targetEventId: string,
		targetIndex: number
	): LogicSelectionMutationResult | undefined {
		const events = this._getEvents();
		if (!events) {
			return;
		}
		return this.applyLogicSelectionMutationResult(
			blockType,
			moveLogicSelectionToEvent(
				events,
				this.getBlockKey(blockType),
				selection,
				targetEventId,
				targetIndex,
			),
		);
	}

	private _updateLogicData(eventId: string, blockType: EventBlockType, index: number, data: any): { previous: any; next: any } | undefined {
		const target = this.getLogicMutationTarget(eventId, blockType, index);
		if (!target) return;
		const previousData = target.block.data;
		if (ObjectUtil.equals(previousData, data)) return;
		const nextBlock = { ...target.block, data };
		this.transferLogicBlockUiKey(target.block, nextBlock);
		const nextSection = [...target.section];
		nextSection[index] = nextBlock;
		const nextEvents = [...target.events];
		nextEvents[target.eventIndex] = { ...target.event, [target.blockKey]: nextSection };
		this.setEvents(nextEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_UPDATED`];
		this._emitChange(eventType, { eventId, blockType, index, data });
		return { previous: previousData, next: data };
	}

	private _updateLogicField(
		eventId: string,
		blockType: EventBlockType,
		index: number,
		path: string[],
		value: any,
	): { previous: any; next: any } | undefined {
		const target = this.getLogicMutationTarget(eventId, blockType, index);
		if (!target) return;
		const currentData = target.block.data ?? {};
		const nextData = setOwnValueAtPath(currentData, path, value);
		if (ObjectUtil.equals(currentData, nextData)) return;
		this.replaceLogicDataAtIndex(eventId, blockType, index, nextData);
		return { previous: currentData, next: nextData };
	}

	private _removeLogic(eventId: string, blockType: EventBlockType, index: number): { index: number; block: ICgEventLogicBlock } | undefined {
		const block = this.removeLogicAtIndex(eventId, blockType, index);
		return block ? { index, block } : undefined;
	}

	private _addLogic(eventId: string, blockType: EventBlockType, type: string): { index: number; block: ICgEventLogicBlock } | undefined {
		const target = this.getLogicSectionTarget(eventId, blockType);
		if (!target) return;
		const newBlock: ICgEventLogicBlock = { type, data: {} };
		const insertIndex = target.section.length;
		const nextEvents = [...target.events];
		nextEvents[target.eventIndex] = { ...target.event, [target.blockKey]: [...target.section, newBlock] };
		this.setEvents(nextEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`];
		this._emitChange(eventType, { eventId, blockType, index: insertIndex, data: newBlock });
		return { index: insertIndex, block: newBlock };
	}

	private _insertLogic(
		eventId: string,
		blockType: EventBlockType,
		block: ICgEventLogicBlock,
		targetIndex?: number,
	): { index: number; block: ICgEventLogicBlock } | undefined {
		const target = this.getLogicSectionTarget(eventId, blockType);
		if (!target) return;
		const insertedBlock: ICgEventLogicBlock = {
			type: block?.type ?? '',
			data: block?.data ? { ...block.data } : {},
		};
		const nextSection = [...target.section];
		const insertIndex = targetIndex === undefined
			? nextSection.length
			: normalizeClampedIndex(targetIndex, nextSection.length);
		if (insertIndex === undefined) return;
		nextSection.splice(insertIndex, 0, insertedBlock);
		const nextEvents = [...target.events];
		nextEvents[target.eventIndex] = { ...target.event, [target.blockKey]: nextSection };
		this.setEvents(nextEvents);
		const eventType = EditorChangeEvents[`${ebtConv.UPPER[blockType]}_ADDED`];
		this._emitChange(eventType, { eventId, blockType, index: insertIndex, data: block });
		return { index: insertIndex, block: insertedBlock };
	}

	private _removeEvent(eventId: string): { index: number; event: ICgEvent } | undefined {
		const events = this._getEvents();
		if (!events) { return; }
		const index = this.getEventIndex(eventId);
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

		const idx = this.getEventIndex(eventId);
		if (idx === -1) { return; }

		let nextPatch = patch;
		if (typeof nextPatch.id === 'string') {
			const trimmed = nextPatch.id.trim();
			const existingIndex = trimmed.length > 0 ? this.getEventIndex(trimmed) : -1;
			const duplicate = existingIndex !== -1 && existingIndex !== idx;
			if (!trimmed || duplicate) {
				return;
			}
			if (trimmed !== nextPatch.id) {
				nextPatch = { ...nextPatch, id: trimmed };
			}
		}

		const previousEvent = events[idx];
		if (!previousEvent) {
			return;
		}
		const patchKeys = Object.keys(nextPatch) as Array<keyof ICgEvent>;
		if (patchKeys.length === 0 || patchKeys.every((key) => ObjectUtil.equals(previousEvent[key], nextPatch[key]))) {
			return;
		}
		const updatedEvent = { ...previousEvent, ...nextPatch };
		this.replaceEventAtIndex(idx, updatedEvent);
		return { index: idx, previous: previousEvent, next: updatedEvent };
	}

	private _updateConfig(configPatch: Partial<ICgEventsDocumentConfig>): { previous: ICgEventsDocumentConfig; next: ICgEventsDocumentConfig } | undefined {
		const doc = this.getEventsJson();
		if (!doc || !this._entry) { return; }
		const currentConfig = doc.config;
		const patchKeys = Object.keys(configPatch) as Array<keyof ICgEventsDocumentConfig>;
		if (patchKeys.length === 0 || patchKeys.every((key) => ObjectUtil.equals(currentConfig[key], configPatch[key]))) {
			return;
		}
		const previousConfig = { ...currentConfig };
		const nextConfig = { ...previousConfig, ...configPatch };
		if (!this._replaceDocument({ ...doc, config: nextConfig })) {
			return;
		}
		this._emitChange(EditorChangeEvents.CONFIG_UPDATED, { config: nextConfig });
		return { previous: previousConfig, next: nextConfig };
	}

	private replaceConfig(nextConfig: ICgEventsDocumentConfig) {
		const doc = this.getEventsJson();
		if (!doc || !this._entry || !this._replaceDocument({ ...doc, config: nextConfig })) {
			return;
		}
		this._emitChange(EditorChangeEvents.CONFIG_UPDATED, { config: nextConfig });
	}
}

export const editor = new CgEventsEditor();
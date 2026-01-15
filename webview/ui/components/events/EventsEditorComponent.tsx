import sortingSchema from '@media/json/sorting.enheditor.schema.json';
import { ISortingPreset, ISortingRule, OutgoingMessageType } from '@shared';
import React from 'react';
import { editor, EditorChangeEvents } from '../../../editor/CgEventsEditor';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { msgHandler } from '../../../msg/MessageHandler';
import { translation } from '../../../trans/Trans';
import { SvgCollapseAll } from '../../svg/SvgCollapseAll';
import { SvgExpandAll } from '../../svg/SvgExpandAll';
import { SvgTrash } from '../../svg/SvgTrash';
import { RJSFConfigsPanel } from '../../rjsf/RJSFConfigsPanel';
import { acquireModalLock } from '../../utils/modalLock';
import { BaseSettings } from '../base/BaseSettings';
import { EventComponent } from './EventComponent';
import { eventCardUiStateStore } from './EventCardUiStateStore';
import { EventsFolderDropdown } from './EventsFolderDropdown';
import { eventsNavigation } from './EventsNavigation';
import { EventsSortingDropdown } from './EventsSortingDropdown';
import { VirtualizedEventsList } from './VirtualizedEventsList';

const NO_FOLDER_VALUE = '__NO_FOLDER__';
const ALL_FOLDERS_VALUE = '__ALL__';

interface EventsEditorComponentProps {
	onEditAsJson(): void;
	scrollContainerRef: React.RefObject<HTMLElement>;
}

const DEFAULT_PRESET_NAME: string = undefined;

const createDefaultPreset = (): ISortingPreset => ({
	name: DEFAULT_PRESET_NAME,
	rules: [{ order: 'asc', target: 'index' }],
});

type ConfirmModalAction = 'overwrite' | 'delete' | '';
type ConfirmModalReturn = 'save' | 'load' | '';

interface EventsEditorComponentState {
	cachedFolderOptions: string[];
	folderFilter: string[];
	folderDropdownOpen: boolean;
	eventIds: string[];
	sortingDropdownOpen: boolean;
	sortingModalOpen: boolean;
	sortingRules: ISortingRule[];
	// Preset management
	currentPresetName: string;
	saveModalOpen: boolean;
	loadModalOpen: boolean;
	presetNameInput: string;
	sortingPresetsVersion: number;
	confirmModalOpen: boolean;
	confirmModalMessage: string;
	confirmModalAction: ConfirmModalAction;
	confirmModalPresetName: string;
	confirmModalReturnTo: ConfirmModalReturn;
}

export class EventsEditorComponent extends React.Component<EventsEditorComponentProps, EventsEditorComponentState> {
	// Keep refs to EventComponent instances for collapse all/expand all
	private eventComponentRefs = new Map<string, React.RefObject<EventComponent>>();
	private virtualListRef: React.RefObject<VirtualizedEventsList> = React.createRef();
	private folderDropdownRef: React.RefObject<HTMLDivElement> = React.createRef();
	private folderButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();
	private sortingDropdownRef: React.RefObject<HTMLDivElement> = React.createRef();
	private baseSettingsRef: React.RefObject<BaseSettings> = React.createRef();
	private presetNameInputRef: React.RefObject<HTMLInputElement> = React.createRef();
	private editorListenersAttached = false;
	private releaseModalLock: (() => void) | null = null;

	constructor(props: EventsEditorComponentProps) {
		super(props);
		const eventIds = this.getEventIds();
		const initialFolderOptions = this.computeFolderOptions();
		const defaultPreset = createDefaultPreset();

		this.state = {
			cachedFolderOptions: initialFolderOptions,
			folderFilter: [ALL_FOLDERS_VALUE],
			folderDropdownOpen: false,
			eventIds,
			sortingDropdownOpen: false,
			sortingModalOpen: false,
			sortingRules: defaultPreset.rules,
			currentPresetName: DEFAULT_PRESET_NAME,
			saveModalOpen: false,
			loadModalOpen: false,
			presetNameInput: '',
			sortingPresetsVersion: 0,
			confirmModalOpen: false,
			confirmModalMessage: '',
			confirmModalAction: '',
			confirmModalPresetName: '',
			confirmModalReturnTo: '',
		};
	}

	componentDidMount(): void {
		this.attachEditorListeners();
		this.refreshEventIds();
		eventsNavigation.on('scroll-to-event', this.handleScrollToEventRequest, this);
	}

	componentWillUnmount(): void {
		eventsNavigation.off('scroll-to-event', this.handleScrollToEventRequest, this);
		this.detachEditorListeners();
		// Release modal lock if held
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private handleSortingPresetsUpdated = () => {
		this.setState((prev) => ({ sortingPresetsVersion: prev.sortingPresetsVersion + 1 }));
	};

	private handleScrollToEventRequest = (eventId: string) => {
		const list = this.virtualListRef.current;
		if (!list) {
			return;
		}
		list.scrollToEventId(eventId);
	};

	private attachEditorListeners(): void {
		if (this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = true;
		editor.on(EditorChangeEvents.EVENT_ADDED, this.handleEventAdded, this);

		editor.on(EditorChangeEvents.EVENT_UPDATED, this.handleEventUpdated, this);

		editor.on(EditorChangeEvents.EVENT_REMOVED, this.handleEventRemoved, this);

		editor.on(EditorChangeEvents.EVENT_MOVED, this.handleEventMoved, this);

		editor.on(EditorChangeEvents.EVENTS_REORDERED, this.handleEventsReordered, this);

		editor.on(EditorChangeEvents.EVENTS_REPLACED, this.handleEventsReplaced, this);

		editor.on(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentUpdated, this);

		editor.on(EditorChangeEvents.SORTING_PRESETS_UPDATED, this.handleSortingPresetsUpdated, this);
	}

	private detachEditorListeners(): void {
		if (!this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = false;
		editor.off(EditorChangeEvents.EVENT_ADDED, this.handleEventAdded, this);
		editor.off(EditorChangeEvents.EVENT_UPDATED, this.handleEventUpdated, this);
		editor.off(EditorChangeEvents.EVENT_REMOVED, this.handleEventRemoved, this);
		editor.off(EditorChangeEvents.EVENT_MOVED, this.handleEventMoved, this);
		editor.off(EditorChangeEvents.EVENTS_REORDERED, this.handleEventsReordered, this);
		editor.off(EditorChangeEvents.EVENTS_REPLACED, this.handleEventsReplaced, this);
		editor.off(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentUpdated, this);
		editor.off(EditorChangeEvents.SORTING_PRESETS_UPDATED, this.handleSortingPresetsUpdated, this);
	}

	private handleEventAdded = () => {
		this.refreshEventIds();
	};

	private handleEventUpdated = () => {
		const nextIds = this.getEventIds();
		const idsChanged = !this.arraysEqual(this.state.eventIds, nextIds);
		if (idsChanged) {
			this.refreshEventIds(nextIds);
			return;
		}
		this.syncFolderOptions();
	};

	private handleEventRemoved = () => {
		this.refreshEventIds();
	};

	private handleEventMoved = () => {
		this.refreshEventIds();
	};

	private handleEventsReordered = () => {
		this.refreshEventIds();
	};

	private handleEventsReplaced = () => {
		this.refreshEventIds();
	};

	private handleDocumentUpdated = () => {
		this.refreshEventIds();
	};

	private hasSameIdSet(a: string[], b: string[]): boolean {
		if (a.length !== b.length) {
			return false;
		}
		const set = new Set(a);
		if (set.size !== a.length) {
			return false;
		}
		for (let i = 0; i < b.length; i++) {
			if (!set.has(b[i])) {
				return false;
			}
		}
		return true;
	}

	private pruneEventComponentRefs(validIds: string[]) {
		const keep = new Set(validIds);
		for (const id of this.eventComponentRefs.keys()) {
			if (!keep.has(id)) {
				this.eventComponentRefs.delete(id);
			}
		}
	}

	private refreshEventIds(nextIdsOverride?: string[]) {
		const nextIds = nextIdsOverride ?? this.getEventIds();
		const prevIds = this.state.eventIds;
		if (this.arraysEqual(prevIds, nextIds)) {
			return;
		}

		const reorderOnly = this.hasSameIdSet(prevIds, nextIds);
		if (!reorderOnly) {
			this.pruneEventComponentRefs(nextIds);
		}

		if (reorderOnly) {
			this.setState({ eventIds: nextIds });
			return;
		}

		eventCardUiStateStore.prune(nextIds);
		const newFolderOptions = this.computeFolderOptions();
		const nextFilter = this.reconcileFolderFilter(this.state.cachedFolderOptions, newFolderOptions, this.state.folderFilter);
		this.setState({
			eventIds: nextIds,
			cachedFolderOptions: newFolderOptions,
			folderFilter: nextFilter,
		});
	}

	private syncFolderOptions() {
		const newFolderOptions = this.computeFolderOptions();
		const nextFilter = this.reconcileFolderFilter(this.state.cachedFolderOptions, newFolderOptions, this.state.folderFilter);
		const optionsChanged = !this.arraysEqual(this.state.cachedFolderOptions, newFolderOptions);
		const filterChanged = !this.arraysEqual(this.state.folderFilter, nextFilter);
		if (optionsChanged || filterChanged) {
			this.setState({
				cachedFolderOptions: newFolderOptions,
				folderFilter: nextFilter,
			});
		}
	}

	private getEventIds(): string[] {
		return editor.getEvents().map((event) => event.id);
	}

	componentDidUpdate(_prevProps: EventsEditorComponentProps, prevState: EventsEditorComponentState) {
		// Handle modal lock for any open modal
		const anyModalOpen = this.state.sortingModalOpen || this.state.saveModalOpen || this.state.loadModalOpen || this.state.confirmModalOpen;
		const prevAnyModalOpen = prevState.sortingModalOpen || prevState.saveModalOpen || prevState.loadModalOpen || prevState.confirmModalOpen;
		if (anyModalOpen !== prevAnyModalOpen) {
			if (anyModalOpen) {
				this.releaseModalLock = this.releaseModalLock ?? acquireModalLock();
			} else {
				this.releaseModalLock?.();
				this.releaseModalLock = null;
			}
		}
	}

	private reconcileFolderFilter(prevOptions: string[], nextOptions: string[], currentFilter: string[]): string[] {
		const specials = new Set([ALL_FOLDERS_VALUE, NO_FOLDER_VALUE]);
		const removed = prevOptions.filter((item) => !nextOptions.includes(item));
		const added = nextOptions.filter((item) => !prevOptions.includes(item));

		const mapped = currentFilter.map((value) => {
			if (removed.length === 1 && added.length === 1 && value === removed[0]) {
				return added[0];
			}
			return value;
		});

		const filtered = mapped.filter((value) => specials.has(value) || nextOptions.includes(value));
		const deduped = Array.from(new Set(filtered));
		if (!deduped.length) {
			return [ALL_FOLDERS_VALUE];
		}
		return deduped;
	}

	private arraysEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	private computeFolderOptions(): string[] {
		const set = new Set<string>();
		editor.getEvents().forEach((event) => {
			const folder = (event.folder ?? '').trim();
			if (folder) {
				set.add(folder);
			}
		});
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}

	private collapseAll = () => {
		for (let i = 0; i < this.state.eventIds.length; i++) {
			eventCardUiStateStore.setCollapsed(this.state.eventIds[i], true);
		}
		this.eventComponentRefs.forEach((ref) => {
			ref.current?.setCollapsed(true);
		});
		this.virtualListRef.current?.invalidateLayout();
	};

	private expandAll = () => {
		for (let i = 0; i < this.state.eventIds.length; i++) {
			eventCardUiStateStore.setCollapsed(this.state.eventIds[i], false);
		}
		this.eventComponentRefs.forEach((ref) => {
			ref.current?.setCollapsed(false);
		});
		this.virtualListRef.current?.invalidateLayout();
	};

	private handleAddEvent = () => {
		let folder: string | undefined;
		if (this.state.folderFilter.length === 1) {
			if (this.state.folderFilter[0] === NO_FOLDER_VALUE) {
				folder = '';
			} else if (this.state.folderFilter[0] !== ALL_FOLDERS_VALUE) {
				folder = this.state.folderFilter[0];
			}
		}
		editor.addEvent(folder !== undefined ? { folder } : undefined);
	};

	// Sorting dropdown methods
	private toggleSortingDropdown = () => {
		this.setState((prev) => ({ sortingDropdownOpen: !prev.sortingDropdownOpen }));
	};

	private onSortingDropdownBlur = (event: React.FocusEvent<HTMLDivElement>) => {
		if (!event.relatedTarget || !(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
			this.setState({ sortingDropdownOpen: false });
		}
	};

	private openSortingModal = () => {
		this.setState({ sortingDropdownOpen: false, sortingModalOpen: true });
	};

	private closeSortingModal = () => {
		this.setState({ sortingModalOpen: false });
	};

	private handleSortingUpdate = (patch: Record<string, any>) => {
		const ruleSet = patch?.configs?.EventSortingRuleSet;
		if (!ruleSet) {
			return;
		}
		const rules = Array.isArray(ruleSet.rules) ? ruleSet.rules : [];
		this.setState({ sortingRules: rules, currentPresetName: '' });
	};

	/**
	 * Compare two events based on sorting rules.
	 * Returns negative if a < b, positive if a > b, 0 if equal.
	 */
	private compareEvents = (a: ReturnType<typeof editor.getEventById>, b: ReturnType<typeof editor.getEventById>): number => {
		if (!a || !b) return 0;
		const { sortingRules } = this.state;

		for (const rule of sortingRules) {
			const { target, order } = rule;
			let aVal: unknown = a[target];
			let bVal: unknown = b[target];

			if (target === 'actions') {
				aVal = a.actions?.length ?? 0;
				bVal = b.actions?.length ?? 0;
			} else if (target === 'checks') {
				aVal = a.checks?.length ?? 0;
				bVal = b.checks?.length ?? 0;
			} else if (target === 'triggers') {
				aVal = a.triggers?.length ?? 0;
				bVal = b.triggers?.length ?? 0;
			} else if (target === 'index') {
				aVal = editor.getEventIndex(a.id);
				bVal = editor.getEventIndex(b.id);
			}

			let cmp = 0;
			if (typeof aVal === 'string' && typeof bVal === 'string') {
				cmp = aVal.localeCompare(bVal);
			} else if (typeof aVal === 'number' && typeof bVal === 'number') {
				cmp = aVal - bVal;
			} else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
				cmp = aVal === bVal ? 0 : (aVal ? 1 : -1);
			} else {
				cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
			}

			if (cmp !== 0) {
				return order === 'desc' ? -cmp : cmp;
			}
		}
		return 0;
	};

	/**
	 * Get event IDs sorted for display only (does not modify JSON).
	 * Sorting is always enabled. If sorting by index in ascending order only,
	 * return the original order (no sorting needed).
	 */
	private getSortedEventIdsForDisplay = (): string[] => {
		const { eventIds, sortingRules } = this.state;
		const filteredIds = this.getFolderFilteredEventIds(eventIds);

		if (sortingRules.length === 0) {
			return filteredIds;
		}
		if (sortingRules.length === 1 && sortingRules[0].target === 'index' && sortingRules[0].order === 'asc') {
			return filteredIds;
		}

		const ids = filteredIds === eventIds ? [...eventIds] : filteredIds;
		const eventById = new Map<string, ReturnType<typeof editor.getEventById>>();
		for (let i = 0; i < ids.length; i++) {
			const id = ids[i];
			eventById.set(id, editor.getEventById(id));
		}

		return ids.sort((idA, idB) => {
			const eventA = eventById.get(idA);
			const eventB = eventById.get(idB);
			return this.compareEvents(eventA, eventB);
		});
	};

	private getFolderFilteredEventIds(eventIds: string[]): string[] {
		const filter = this.state.folderFilter;
		if (!filter.length || filter.includes(ALL_FOLDERS_VALUE)) {
			return eventIds;
		}
		const showNoFolder = filter.includes(NO_FOLDER_VALUE);
		const filtered: string[] = [];
		for (let i = 0; i < eventIds.length; i++) {
			const event = editor.getEventById(eventIds[i]);
			const folder = event?.folder ?? '';
			if (!folder) {
				if (showNoFolder) {
					filtered.push(eventIds[i]);
				}
				continue;
			}
			if (filter.includes(folder)) {
				filtered.push(eventIds[i]);
			}
		}
		return filtered;
	}

	private toggleFolderDropdown = () => {
		this.setState((prev) => ({ folderDropdownOpen: !prev.folderDropdownOpen }));
	};

	private onDropdownBlur = (event: React.FocusEvent<HTMLDivElement>) => {
		if (!event.relatedTarget || !(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
			this.setState({ folderDropdownOpen: false });
		}
	};

	private handleFolderToggle = (value: string) => {
		const current = this.state.folderFilter;
		if (value === ALL_FOLDERS_VALUE) {
			this.setState({ folderFilter: [ALL_FOLDERS_VALUE] });
			return;
		}

		const set = new Set(current.filter((v: string) => v !== ALL_FOLDERS_VALUE));
		if (set.has(value)) {
			set.delete(value);
		} else {
			set.add(value);
		}
		if (set.size === 0) {
			set.add(ALL_FOLDERS_VALUE);
		}
		this.setState({ folderFilter: Array.from(set) });
	};

	private getEventRef = (eventId: string): React.RefObject<EventComponent> => {
		const existing = this.eventComponentRefs.get(eventId);
		if (existing) {
			return existing;
		}
		const created = React.createRef<EventComponent>();
		this.eventComponentRefs.set(eventId, created);
		return created;
	};

	private openSaveModal = () => {
		const presetNameInput = this.state.currentPresetName && this.state.currentPresetName !== DEFAULT_PRESET_NAME
			? this.state.currentPresetName
			: '';
		this.setState({
			sortingDropdownOpen: false,
			saveModalOpen: true,
			presetNameInput,
		});
	};

	private closeSaveModal = () => {
		this.setState({ saveModalOpen: false, presetNameInput: '' });
	};

	private openLoadModal = () => {
		this.setState({
			sortingDropdownOpen: false,
			loadModalOpen: true,
		});
	};

	private closeLoadModal = () => {
		this.setState({ loadModalOpen: false });
	};

	private handlePresetNameBlur = () => {
		const input = this.presetNameInputRef.current;
		const value = input ? input.value : '';
		if (value !== this.state.presetNameInput) {
			this.setState({ presetNameInput: value });
		}
	};

	private handlePresetNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== 'Enter') {
			return;
		}
		e.preventDefault();
		this.handleSavePreset();
	};

	private handleSelectPresetName = (name: string) => {
		const input = this.presetNameInputRef.current;
		if (input) {
			input.value = name;
			input.focus();
		}
		if (this.state.presetNameInput !== name) {
			this.setState({ presetNameInput: name });
		}
	};

	private openConfirmModal = (action: ConfirmModalAction, name: string, message: string, returnTo: ConfirmModalReturn) => {
		const nextState: Partial<EventsEditorComponentState> = {
			confirmModalOpen: true,
			confirmModalMessage: message,
			confirmModalAction: action,
			confirmModalPresetName: name,
			confirmModalReturnTo: returnTo,
		};
		this.setState(nextState);
	};

	private handleConfirmModalCancel = () => {
		const nextState: Partial<EventsEditorComponentState> = {
			confirmModalOpen: false,
			confirmModalMessage: '',
			confirmModalAction: '',
			confirmModalPresetName: '',
			confirmModalReturnTo: '',
		};
		this.setState(nextState);
	};

	private handleConfirmModalConfirm = () => {
		const { confirmModalAction, confirmModalPresetName, confirmModalReturnTo } = this.state;
		if (!confirmModalAction || !confirmModalPresetName) {
			this.setState({
				confirmModalOpen: false,
				confirmModalMessage: '',
				confirmModalAction: '',
				confirmModalPresetName: '',
				confirmModalReturnTo: '',
			});
			return;
		}
		if (confirmModalAction === 'overwrite') {
			this.commitSavePreset(confirmModalPresetName);
			return;
		}
		if (confirmModalAction === 'delete') {
			this.commitDeletePreset(confirmModalPresetName, confirmModalReturnTo);
		}
	};

	private commitSavePreset = (name: string) => {
		const preset: ISortingPreset = { name, rules: this.state.sortingRules };
		msgHandler.send(OutgoingMessageType.SORTING_PRESETS_SAVE, preset);
		this.setState({
			saveModalOpen: false,
			presetNameInput: '',
			currentPresetName: name,
			confirmModalOpen: false,
			confirmModalMessage: '',
			confirmModalAction: '',
			confirmModalPresetName: '',
			confirmModalReturnTo: '',
		});
	};

	private commitDeletePreset = (name: string, returnTo: ConfirmModalReturn) => {
		msgHandler.send(OutgoingMessageType.SORTING_PRESETS_DELETE, name);
		const nextState: Partial<EventsEditorComponentState> = {
			confirmModalOpen: false,
			confirmModalMessage: '',
			confirmModalAction: '',
			confirmModalPresetName: '',
			confirmModalReturnTo: '',
		};
		if (returnTo === 'load') {
			nextState.loadModalOpen = true;
		}
		if (this.state.currentPresetName === name) {
			const defaultPreset = createDefaultPreset();
			nextState.sortingRules = defaultPreset.rules;
			nextState.currentPresetName = DEFAULT_PRESET_NAME;
		}
		this.setState(nextState);
	};

	private handleSavePreset = () => {
		const presets = editor.getSortingPresets();
		const rawName = this.presetNameInputRef.current?.value ?? this.state.presetNameInput;
		const name = rawName.trim();
		if (!name) return;

		const existingPreset = presets.find((preset) => preset.name === name);
		if (existingPreset) {
			const confirmMsg = translation.events.sorting.confirmOverwrite.getTrans({ name });
			this.openConfirmModal('overwrite', name, confirmMsg, 'save');
			return;
		}

		this.commitSavePreset(name);
	};

	private handleLoadPreset = (preset: ISortingPreset) => {
		this.setState({
			loadModalOpen: false,
			sortingRules: preset.rules,
			currentPresetName: preset.name,
		});
	};

	private handleDeletePreset = (name: string) => {
		const confirmMsg = translation.events.sorting.confirmDelete.getTrans({ name });
		this.openConfirmModal('delete', name, confirmMsg, 'load');
	};

	private handleLoadDefaultPreset = () => {
		const defaultPreset = createDefaultPreset();
		this.setState({
			loadModalOpen: false,
			sortingRules: defaultPreset.rules,
			currentPresetName: DEFAULT_PRESET_NAME,
		});
	};

	private getDisplayPresetName = (): string => {
		const { currentPresetName } = this.state;
		if (currentPresetName === DEFAULT_PRESET_NAME) {
			return translation.events.sorting.defaultPreset.getTrans();
		}
		return currentPresetName || translation.events.sorting.title.getTrans();
	};

		render() {
			const folderOptions = this.state.cachedFolderOptions;
			const { eventIds } = this.state;
			const presets = editor.getSortingPresets();
			const displayEventIds = this.getSortedEventIdsForDisplay();

			return (
			<section className="d-flex flex-column w-100 flex-grow-1 flex-shrink-0">
				<BaseSettings
					ref={this.baseSettingsRef}
					onEditAsJson={this.props.onEditAsJson}
					/>
					<div className="cgenh-events-frame">
						<div className="cgenh-events-toolbar cgenh-events-toolbar--framed">
								<div className="cgenh-events-toolbar__left">
									<button
										type="button"
										className="btn btn-sm btn-outline-secondary cgenh-toolbar-icon-btn"
										onClick={this.expandAll}
										title={translation.list.expandAll.getTrans()}
										aria-label={translation.list.expandAll.getTrans()}
										onMouseEnter={playMouseHoverAudio}
										onMouseDown={playMouseDownAudio}
									>
										<SvgExpandAll aria-hidden="true" />
									</button>
									<button
										type="button"
										className="btn btn-sm btn-outline-secondary cgenh-toolbar-icon-btn"
										onClick={this.collapseAll}
										title={translation.list.collapseAll.getTrans()}
										aria-label={translation.list.collapseAll.getTrans()}
										onMouseEnter={playMouseHoverAudio}
										onMouseDown={playMouseDownAudio}
									>
										<SvgCollapseAll aria-hidden="true" />
									</button>
									<button type="button" className="btn btn-sm btn-outline-secondary" onClick={this.handleAddEvent} onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}>{translation.events.addEvent.getTrans()}</button>
									<EventsSortingDropdown
										open={this.state.sortingDropdownOpen}
										displayName={this.getDisplayPresetName()}
										dropdownRef={this.sortingDropdownRef}
										onBlur={this.onSortingDropdownBlur}
										onToggle={this.toggleSortingDropdown}
										onOpenEdit={this.openSortingModal}
										onOpenSave={this.openSaveModal}
										onOpenLoad={this.openLoadModal}
									/>
								</div>
								<div className="cgenh-events-toolbar__right">
									<EventsFolderDropdown
										open={this.state.folderDropdownOpen}
										folderFilter={this.state.folderFilter}
										options={folderOptions}
										allFoldersValue={ALL_FOLDERS_VALUE}
										noFolderValue={NO_FOLDER_VALUE}
										dropdownRef={this.folderDropdownRef}
										buttonRef={this.folderButtonRef}
										onBlur={this.onDropdownBlur}
										onToggle={this.toggleFolderDropdown}
										onToggleFolder={this.handleFolderToggle}
									/>
								</div>
							</div>
						<div className="cgenh-events-frame__body">
							<VirtualizedEventsList
								ref={this.virtualListRef}
								scrollContainerRef={this.props.scrollContainerRef}
								eventIds={displayEventIds}
								totalEventCount={eventIds.length}
								onEditAsJson={this.props.onEditAsJson}
								getEventRef={this.getEventRef}
							/>
							{displayEventIds.length === 0 && (
								<div className="text-center text-body-secondary border rounded p-3">
									{translation.validation.noItems.getTrans()}
								</div>
							)}
						</div>
					</div>
					{this.state.sortingModalOpen && (
						<>
							<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.closeSortingModal();
								}
							}}
						>
							<div
								className="modal-dialog modal-lg modal-dialog-centered cgenh-modal-dialog"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<RJSFConfigsPanel
									configs={{ EventSortingRuleSet: { rules: this.state.sortingRules } }}
									configKey="EventSortingRuleSet"
									schema={sortingSchema}
									schemaSection="definition"
									onUpdate={this.handleSortingUpdate}
									onClose={this.closeSortingModal}
								/>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>
				)}
				{this.state.saveModalOpen && (
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.closeSaveModal();
								}
							}}
						>
							<div
								className="modal-dialog modal-dialog-centered"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<div className="modal-content">
									<div className="modal-header">
										<h5 className="modal-title">{translation.events.sorting.savePreset.getTrans()}</h5>
										<button type="button" className="btn-close" onClick={this.closeSaveModal} aria-label={translation.common.close.getTrans()} />
									</div>
									<div className="modal-body">
										<div className="mb-3">
											<label htmlFor="preset-name-input" className="form-label">{translation.events.sorting.presetName.getTrans()}</label>
											<input
												ref={this.presetNameInputRef}
												type="text"
												className="form-control"
												id="preset-name-input"
												defaultValue={this.state.presetNameInput}
												onBlur={this.handlePresetNameBlur}
												onKeyDown={this.handlePresetNameKeyDown}
												placeholder={translation.events.sorting.presetNamePlaceholder.getTrans()}
												autoFocus
											/>
										</div>
										{presets.length > 0 && (
											<div>
												<label className="form-label">{translation.events.sorting.existingPresets.getTrans()}</label>
												<div className="list-group list-group-flush cgenh-modal-scroll-list">
													{presets.map((preset) => (
														<button
															key={preset.name}
															type="button"
															className="list-group-item list-group-item-action py-2"
															onClick={() => this.handleSelectPresetName(preset.name)}
														>
															{preset.name}
														</button>
													))}
												</div>
											</div>
										)}
									</div>
									<div className="modal-footer">
										<button type="button" className="btn btn-secondary" onClick={this.closeSaveModal}>{translation.common.cancel.getTrans()}</button>
										<button
											type="button"
											className="btn btn-primary"
											onClick={this.handleSavePreset}
										>
											{translation.common.save.getTrans()}
										</button>
									</div>
								</div>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>
				)}
				{this.state.loadModalOpen && (
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.closeLoadModal();
								}
							}}
						>
							<div
								className="modal-dialog modal-dialog-centered"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<div className="modal-content">
									<div className="modal-header">
										<h5 className="modal-title">{translation.events.sorting.loadPreset.getTrans()}</h5>
										<button type="button" className="btn-close" onClick={this.closeLoadModal} aria-label={translation.common.close.getTrans()} />
									</div>
									<div className="modal-body">
										<div className="cgenh-preset-list">
											<div
												className={`cgenh-preset-item${this.state.currentPresetName === DEFAULT_PRESET_NAME ? ' cgenh-preset-item--selected' : ''}`}
												onClick={this.handleLoadDefaultPreset}
											>
												<span className="cgenh-preset-item__name">{translation.events.sorting.defaultPreset.getTrans()}</span>
												<span className="cgenh-preset-item__badge">Default</span>
											</div>
											{presets.map((preset) => (
												<div
													key={preset.name}
													className={`cgenh-preset-item${this.state.currentPresetName === preset.name ? ' cgenh-preset-item--selected' : ''}`}
													onClick={() => this.handleLoadPreset(preset)}
												>
													<span className="cgenh-preset-item__name">{preset.name}</span>
													<button
														type="button"
														className="cgenh-preset-item__delete"
														onClick={(e) => { e.stopPropagation(); this.handleDeletePreset(preset.name); }}
														title={translation.events.sorting.deletePreset.getTrans()}
													>
														<SvgTrash width={14} height={14} aria-hidden="true" />
													</button>
												</div>
											))}
											{presets.length === 0 && (
												<div className="cgenh-preset-empty">
													{translation.events.sorting.noPresets.getTrans()}
												</div>
											)}
										</div>
									</div>
									<div className="modal-footer">
										<button type="button" className="btn btn-secondary" onClick={this.closeLoadModal}>{translation.common.close.getTrans()}</button>
									</div>
								</div>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>
				)}
				{this.state.confirmModalOpen && (
					<>
						<div
							className="modal show d-block cgenh-modal--confirm"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.handleConfirmModalCancel();
								}
							}}
						>
							<div
								className="modal-dialog modal-dialog-centered modal-sm"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<div className="modal-content">
									<div className="modal-header">
										<h5 className="modal-title">{translation.common.confirm.getTrans()}</h5>
										<button
											type="button"
											className="btn-close"
											onClick={this.handleConfirmModalCancel}
											aria-label={translation.common.close.getTrans()}
										/>
									</div>
									<div className="modal-body">
										<p className="mb-0">{this.state.confirmModalMessage}</p>
									</div>
									<div className="modal-footer">
										<button type="button" className="btn btn-secondary" onClick={this.handleConfirmModalCancel}>
											{translation.common.cancel.getTrans()}
										</button>
										<button type="button" className="btn btn-primary" onClick={this.handleConfirmModalConfirm}>
											{translation.common.confirm.getTrans()}
										</button>
									</div>
								</div>
							</div>
						</div>
						<div className="modal-backdrop show cgenh-modal-backdrop--confirm" />
					</>
				)}
			</section>
		);
	}
}

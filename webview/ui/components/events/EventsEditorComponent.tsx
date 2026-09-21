import { ISortingPreset, ISortingRule, OutgoingMessageType } from '@shared';
import React from 'react';
import { editor, EditorChangeEvents, type EditorChangeEventPayload, type EditorChangeEventType } from '../../../editor/CgEventsEditor';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { msgHandler } from '../../../msg/MessageHandler';
import { translation } from '../../../trans/Trans';
import { SvgCollapseAll } from '../../svg/SvgCollapseAll';
import { SvgExpandAll } from '../../svg/SvgExpandAll';
import { acquireModalLock } from '../../utils/modalLock';
import { BaseSettings } from '../base/BaseSettings';
import { EventComponent } from './EventComponent';
import {
	computeEventFolderOptions,
	getSortedEventIdsForDisplay as deriveSortedEventIdsForDisplay,
	haveSameUniqueStringSet,
	reconcileEventFolderFilter,
	resolveEventNavigationFolderFilter,
	resolveNewEventFolder,
	stringArraysEqual,
} from './EventsDisplay';
import { eventCardUiStateStore } from './EventCardUiStateStore';
import { EventsFolderDropdown } from './EventsFolderDropdown';
import { eventsNavigation } from './EventsNavigation';
import { EventsSortingDropdown } from './EventsSortingDropdown';
import { EventsSortingModals } from './EventsSortingModals';
import { VirtualizedEventsList } from './VirtualizedEventsList';

const NO_FOLDER_VALUE = '__NO_FOLDER__';
const ALL_FOLDERS_VALUE = '__ALL__';

const EVENT_LIST_REFRESH_EVENTS: readonly EditorChangeEventType[] = [
	EditorChangeEvents.EVENT_ADDED,
	EditorChangeEvents.EVENT_REMOVED,
	EditorChangeEvents.EVENT_MOVED,
	EditorChangeEvents.EVENTS_REORDERED,
	EditorChangeEvents.EVENTS_REPLACED,
	EditorChangeEvents.DOCUMENT_UPDATED,
];


interface EventsEditorComponentProps {
	onEditAsJson(): void;
	scrollContainerRef: React.RefObject<HTMLElement>;
}

const DEFAULT_PRESET_NAME: string | undefined = undefined;

const createDefaultPreset = () => ({
	name: DEFAULT_PRESET_NAME,
	rules: [{ order: 'asc' as const, target: 'index' as const }],
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
	currentPresetName?: string;
	saveModalOpen: boolean;
	loadModalOpen: boolean;
	presetNameInput: string;
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
	private presetNameInputRef: React.RefObject<HTMLInputElement> = React.createRef();
	private editorListenersAttached = false;
	private releaseModalLock: (() => void) | null = null;

	constructor(props: EventsEditorComponentProps) {
		super(props);
		const eventIds = this.getEventIds();
		const initialFolderOptions = computeEventFolderOptions(editor.getEvents());
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
		eventsNavigation.on('scroll-to-event', this.handleScrollToEventRequest);
	}

	componentWillUnmount(): void {
		eventsNavigation.off('scroll-to-event', this.handleScrollToEventRequest);
		this.detachEditorListeners();
		// Release modal lock if held
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private handleSortingPresetsUpdated = () => {
		this.forceUpdate();
	};

	private handleScrollToEventRequest = (eventId: string) => {
		const targetId = eventId.trim();
		const list = this.virtualListRef.current;
		if (!targetId || !list || list.scrollToEventId(targetId)) {
			return;
		}

		const nextFilter = resolveEventNavigationFolderFilter(
			this.state.folderFilter,
			editor.getEventById(targetId),
			ALL_FOLDERS_VALUE,
			NO_FOLDER_VALUE,
		);
		if (!nextFilter) {
			return;
		}
		this.setState({ folderFilter: nextFilter }, () => {
			this.virtualListRef.current?.scrollToEventId(targetId);
		});
	};

	private attachEditorListeners(): void {
		if (this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = true;
		for (const eventType of EVENT_LIST_REFRESH_EVENTS) {
			editor.on(eventType, this.handleEventListRefresh);
		}
		editor.on(EditorChangeEvents.EVENT_UPDATED, this.handleEventUpdated);
		editor.on(EditorChangeEvents.SORTING_PRESETS_UPDATED, this.handleSortingPresetsUpdated);
	}

	private detachEditorListeners(): void {
		if (!this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = false;
		for (const eventType of EVENT_LIST_REFRESH_EVENTS) {
			editor.off(eventType, this.handleEventListRefresh);
		}
		editor.off(EditorChangeEvents.EVENT_UPDATED, this.handleEventUpdated);
		editor.off(EditorChangeEvents.SORTING_PRESETS_UPDATED, this.handleSortingPresetsUpdated);
	}

	private handleEventListRefresh = () => {
		this.refreshEventIds();
	};

	private handleEventUpdated = (payload?: EditorChangeEventPayload) => {
		const nextIds = this.getEventIds();
		const idsChanged = !stringArraysEqual(this.state.eventIds, nextIds);
		const previousFolder = (payload?.previousEvent?.folder ?? '').trim();
		const nextFolder = (payload?.event?.folder ?? '').trim();
		const folderRename = previousFolder && nextFolder && previousFolder !== nextFolder
			? { previousFolder, nextFolder }
			: undefined;

		if (idsChanged) {
			const previousEventId = payload?.previousEventId;
			const eventId = payload?.eventId;
			if (previousEventId && eventId && previousEventId !== eventId) {
				eventCardUiStateStore.rename(previousEventId, eventId);
			}
			this.refreshEventIds(nextIds, folderRename);
			return;
		}
		this.syncFolderOptions(folderRename);
	};

	private pruneEventComponentRefs(validIds: string[]) {
		const keep = new Set(validIds);
		for (const id of this.eventComponentRefs.keys()) {
			if (!keep.has(id)) {
				this.eventComponentRefs.delete(id);
			}
		}
	}

	private refreshEventIds(nextIdsOverride?: string[], folderRename?: { previousFolder: string; nextFolder: string }) {
		const nextIds = nextIdsOverride ?? this.getEventIds();
		const prevIds = this.state.eventIds;
		if (stringArraysEqual(prevIds, nextIds)) {
			this.syncFolderOptions();
			this.forceUpdate();
			return;
		}

		const reorderOnly = haveSameUniqueStringSet(prevIds, nextIds);
		if (!reorderOnly) {
			this.pruneEventComponentRefs(nextIds);
		}

		if (reorderOnly) {
			this.setState({ eventIds: nextIds });
			return;
		}

		eventCardUiStateStore.prune(nextIds);
		const newFolderOptions = computeEventFolderOptions(editor.getEvents());
		const nextFilter = reconcileEventFolderFilter(
			this.state.cachedFolderOptions,
			newFolderOptions,
			this.state.folderFilter,
			ALL_FOLDERS_VALUE,
			NO_FOLDER_VALUE,
			folderRename,
		);
		this.setState({
			eventIds: nextIds,
			cachedFolderOptions: newFolderOptions,
			folderFilter: nextFilter,
		});
	}

	private syncFolderOptions(folderRename?: { previousFolder: string; nextFolder: string }) {
		const newFolderOptions = computeEventFolderOptions(editor.getEvents());
		const nextFilter = reconcileEventFolderFilter(
			this.state.cachedFolderOptions,
			newFolderOptions,
			this.state.folderFilter,
			ALL_FOLDERS_VALUE,
			NO_FOLDER_VALUE,
			folderRename,
		);
		const optionsChanged = !stringArraysEqual(this.state.cachedFolderOptions, newFolderOptions);
		const filterChanged = !stringArraysEqual(this.state.folderFilter, nextFilter);
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
		const folder = resolveNewEventFolder(
			this.state.folderFilter,
			ALL_FOLDERS_VALUE,
			NO_FOLDER_VALUE,
		);
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
	 * Get event IDs sorted for display only (does not modify JSON).
	 * Sorting is always enabled. If sorting by index in ascending order only,
	 * return the original order (no sorting needed).
	 */
	private getSortedEventIdsForDisplay = (): string[] =>
		deriveSortedEventIdsForDisplay(
			this.state.eventIds,
			this.state.folderFilter,
			this.state.sortingRules,
			(id) => editor.getEventById(id),
			(id) => editor.getEventIndex(id),
			ALL_FOLDERS_VALUE,
			NO_FOLDER_VALUE,
		);

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
		if (e.nativeEvent.isComposing || e.key !== 'Enter') {
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
		this.setState((prev) => ({ ...prev, ...nextState }));
	};

	private handleConfirmModalCancel = () => {
		const nextState: Partial<EventsEditorComponentState> = {
			confirmModalOpen: false,
			confirmModalMessage: '',
			confirmModalAction: '',
			confirmModalPresetName: '',
			confirmModalReturnTo: '',
		};
		this.setState((prev) => ({ ...prev, ...nextState }));
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
		this.setState((prev) => ({ ...prev, ...nextState }));
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
					<EventsSortingModals
						sortingOpen={this.state.sortingModalOpen}
						sortingRules={this.state.sortingRules}
						onSortingUpdate={this.handleSortingUpdate}
						onCloseSorting={this.closeSortingModal}
						saveOpen={this.state.saveModalOpen}
						loadOpen={this.state.loadModalOpen}
						confirmOpen={this.state.confirmModalOpen}
						presets={presets}
						currentPresetName={this.state.currentPresetName}
						defaultPresetSelected={this.state.currentPresetName === DEFAULT_PRESET_NAME}
						presetNameInput={this.state.presetNameInput}
						presetNameInputRef={this.presetNameInputRef}
						confirmMessage={this.state.confirmModalMessage}
						onCloseSave={this.closeSaveModal}
						onPresetNameBlur={this.handlePresetNameBlur}
						onPresetNameKeyDown={this.handlePresetNameKeyDown}
						onSelectPresetName={this.handleSelectPresetName}
						onSavePreset={this.handleSavePreset}
						onCloseLoad={this.closeLoadModal}
						onLoadDefaultPreset={this.handleLoadDefaultPreset}
						onLoadPreset={this.handleLoadPreset}
						onDeletePreset={this.handleDeletePreset}
						onConfirmCancel={this.handleConfirmModalCancel}
						onConfirm={this.handleConfirmModalConfirm}
					/>
			</section>
		);
	}
}

import { ICgEvent } from '@shared';
import eventSchemaJson from '@media/json/event.enheditor.schema.json';
import React from 'react';
import { createPortal } from 'react-dom';
import type { EditorChangeEventPayload } from '../../../editor/CgEventsEditor';
import { editor, EditorChangeEvents } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { translation } from '../../../trans/Trans';
import { RJSFConfigsPanel } from '../../rjsf/RJSFConfigsPanel';
import { isRecord } from '../../rjsf/utils/rjsfUtils';
import { EVENT_FOLDER_REGEX, EVENT_NAME_REGEX } from '../../utils/validators';
import { EventCardHeader } from './EventCardHeader';
import { eventCardUiStateStore } from './EventCardUiStateStore';
import { EventLogicSections } from './EventLogicSections';
import { LogicItemsList } from './LogicItemsList';
import { LogicListJsonPanel } from './LogicListJsonPanel';
import { LogicLibraryPanel } from './LogicLibraryPanel';

interface EventComponentProps {
	eventId: string;
	initialCollapsed?: boolean;
	onEditAsJson(): void;
	isFirst?: boolean;
	isLast?: boolean;
}

interface EventComponentState {
	blockCollapsed: Record<EventBlockType, boolean>;
	metaOpen: boolean;
	addBlockType?: EventBlockType;
	addType?: string;
	addInsertIndex?: number;
	jsonEditBlockType?: EventBlockType;
	collapsed: boolean;
	schemaVersion: number;
}

function buildEventMetaEditorData(event: ICgEvent): Record<string, any> {
	const meta: Record<string, any> = {};
	for (const [key, value] of Object.entries(event ?? {})) {
		if (key === 'actions' || key === 'checks' || key === 'triggers') {
			continue;
		}
		meta[key] = value;
	}

	const referenceOnly = meta['referenceOnly'];
	if (typeof referenceOnly === 'boolean') {
		meta['referenceOnly'] = referenceOnly ? 1 : 0;
	}

	return meta;
}

function buildEventPatchFromMeta(meta: Record<string, any>): Partial<ICgEvent> {
	const patch: Partial<ICgEvent> = {};
	for (const [key, value] of Object.entries(meta)) {
		if (key === 'actions' || key === 'checks' || key === 'triggers') {
			continue;
		}

		if (key === 'id') {
			if (typeof value === 'string') {
				patch.id = value.trim();
			}
			continue;
		}

		if (key === 'folder') {
			patch.folder = typeof value === 'string' ? value.trim() : '';
			continue;
		}

		if (key === 'referenceOnly') {
			patch.referenceOnly = value === 1 || value === true;
			continue;
		}

		if (key === 'disabled') {
			patch.disabled = !!value;
			continue;
		}

		if (key === 'devOnly') {
			patch.devOnly = !!value;
			continue;
		}

		patch[key] = value;
	}

	return patch;
}

function validateEventMetaEditorData(editingEventId: string, meta: any): string | undefined {
	const nextId = typeof meta?.id === 'string' ? meta.id.trim() : '';
	if (!nextId) {
		return translation.events.eventNameRequired.getTrans();
	}
	if (!EVENT_NAME_REGEX.test(nextId)) {
		return translation.events.eventNameInvalid.getTrans();
	}
	const collision = editor.getEvents().some((evt) => evt.id === nextId && evt.id !== editingEventId);
	if (collision) {
		return translation.events.eventNameExists.getTrans();
	}

	const folder = typeof meta?.folder === 'string' ? meta.folder.trim() : '';
	if (!EVENT_FOLDER_REGEX.test(folder)) {
		return translation.events.folderNameInvalid.getTrans();
	}

	return undefined;
}

export class EventComponent extends React.Component<EventComponentProps, EventComponentState> {
	private cardRef: React.RefObject<HTMLElement> = React.createRef();
	private logicListRefs: Record<EventBlockType, React.RefObject<LogicItemsList>> = {
		trigger: React.createRef<LogicItemsList>(),
		check: React.createRef<LogicItemsList>(),
		action: React.createRef<LogicItemsList>(),
	};
	private editorListenersAttached = false;

	constructor(props: EventComponentProps) {
		super(props);
		const savedUiState = eventCardUiStateStore.get(props.eventId);
		const initialCollapsed = savedUiState ? savedUiState.collapsed : !!props.initialCollapsed;
		eventCardUiStateStore.setCollapsed(props.eventId, initialCollapsed);
		const savedBlockCollapsed = savedUiState ? savedUiState.blockCollapsed : undefined;
		const initialBlockCollapsed = savedBlockCollapsed
			? { trigger: savedBlockCollapsed.trigger, check: savedBlockCollapsed.check, action: savedBlockCollapsed.action }
			: { trigger: false, check: false, action: false };
		this.state = {
			blockCollapsed: initialBlockCollapsed,
			metaOpen: false,
			collapsed: initialCollapsed,
			schemaVersion: 0,
		};
	}

	// Public method to be called by parent for collapse all/expand all
	public setCollapsed(collapsed: boolean) {
		this.setState({ collapsed }, () => {
			eventCardUiStateStore.setCollapsed(this.props.eventId, collapsed);
			this.updateCollapseDOM(collapsed);
		});
	}

	private updateCollapseDOM(collapsed = this.state.collapsed) {
		// Directly manipulate DOM to avoid re-render
		if (this.cardRef.current) {
			this.cardRef.current.classList.toggle('cgenh-event-card--collapsed', collapsed);
		}
	}

	private readEvent(eventId: string): ICgEvent {
		const event = editor.getEventById(eventId);
		if (event) {
			return event;
		}
		return {
			id: eventId,
			folder: '',
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
	}

	shouldComponentUpdate(nextProps: EventComponentProps, nextState: EventComponentState) {
		// State changes always trigger update (collapsed, collapsed sections, modals)
		if (this.hasStateChanged(nextState)) return true;

		// Check UI-affecting props
		if (this.props.eventId !== nextProps.eventId) return true;
		if (this.props.initialCollapsed !== nextProps.initialCollapsed) return true;
		if (this.props.isFirst !== nextProps.isFirst) return true;
		if (this.props.isLast !== nextProps.isLast) return true;

		// No changes detected
		return false;
	}

	private hasStateChanged(nextState: EventComponentState): boolean {
		if (this.state.collapsed !== nextState.collapsed) return true;
		if (this.state.metaOpen !== nextState.metaOpen) return true;
		if (this.state.addBlockType !== nextState.addBlockType) return true;
		if (this.state.addType !== nextState.addType) return true;
		if (this.state.addInsertIndex !== nextState.addInsertIndex) return true;
		if (this.state.jsonEditBlockType !== nextState.jsonEditBlockType) return true;
		if (this.state.schemaVersion !== nextState.schemaVersion) return true;
		return this.hasBlockCollapseChanged(nextState.blockCollapsed);
	}

	private hasBlockCollapseChanged(nextCollapsed: Record<EventBlockType, boolean>): boolean {
		const current = this.state.blockCollapsed;
		return current.trigger !== nextCollapsed.trigger
			|| current.check !== nextCollapsed.check
			|| current.action !== nextCollapsed.action;
	}

	componentDidMount() {
		this.updateCollapseDOM();
		this.attachEditorListeners();
	}

	private attachEditorListeners(): void {
		if (this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = true;
		editor.on(EditorChangeEvents.SCHEMA_UPDATED, this.handleSchemaUpdated, this);
		editor.on(EditorChangeEvents.EVENT_UPDATED, this.handleEventUpdated, this);
		editor.on(EditorChangeEvents.TRIGGER_ADDED, this.handleTriggerAdded, this);
		editor.on(EditorChangeEvents.TRIGGER_UPDATED, this.handleTriggerUpdated, this);
		editor.on(EditorChangeEvents.TRIGGER_REMOVED, this.handleTriggerRemoved, this);
		editor.on(EditorChangeEvents.TRIGGER_MOVED, this.handleTriggerMoved, this);
		editor.on(EditorChangeEvents.CHECK_ADDED, this.handleCheckAdded, this);
		editor.on(EditorChangeEvents.CHECK_UPDATED, this.handleCheckUpdated, this);
		editor.on(EditorChangeEvents.CHECK_REMOVED, this.handleCheckRemoved, this);
		editor.on(EditorChangeEvents.CHECK_MOVED, this.handleCheckMoved, this);
		editor.on(EditorChangeEvents.ACTION_ADDED, this.handleActionAdded, this);
		editor.on(EditorChangeEvents.ACTION_UPDATED, this.handleActionUpdated, this);
		editor.on(EditorChangeEvents.ACTION_REMOVED, this.handleActionRemoved, this);
		editor.on(EditorChangeEvents.ACTION_MOVED, this.handleActionMoved, this);
	}

	private detachEditorListeners(): void {
		if (!this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = false;
		editor.off(EditorChangeEvents.SCHEMA_UPDATED, this.handleSchemaUpdated, this);
		editor.off(EditorChangeEvents.EVENT_UPDATED, this.handleEventUpdated, this);
		editor.off(EditorChangeEvents.TRIGGER_ADDED, this.handleTriggerAdded, this);
		editor.off(EditorChangeEvents.TRIGGER_UPDATED, this.handleTriggerUpdated, this);
		editor.off(EditorChangeEvents.TRIGGER_REMOVED, this.handleTriggerRemoved, this);
		editor.off(EditorChangeEvents.TRIGGER_MOVED, this.handleTriggerMoved, this);
		editor.off(EditorChangeEvents.CHECK_ADDED, this.handleCheckAdded, this);
		editor.off(EditorChangeEvents.CHECK_UPDATED, this.handleCheckUpdated, this);
		editor.off(EditorChangeEvents.CHECK_REMOVED, this.handleCheckRemoved, this);
		editor.off(EditorChangeEvents.CHECK_MOVED, this.handleCheckMoved, this);
		editor.off(EditorChangeEvents.ACTION_ADDED, this.handleActionAdded, this);
		editor.off(EditorChangeEvents.ACTION_UPDATED, this.handleActionUpdated, this);
		editor.off(EditorChangeEvents.ACTION_REMOVED, this.handleActionRemoved, this);
		editor.off(EditorChangeEvents.ACTION_MOVED, this.handleActionMoved, this);
	}

	componentDidUpdate(prevProps: EventComponentProps) {
		// Only reset collapsed/meta when switching to a different event card.
		if (prevProps.eventId !== this.props.eventId) {
			const savedUiState = eventCardUiStateStore.get(this.props.eventId);
			const nextCollapsed = savedUiState ? savedUiState.collapsed : (this.props.initialCollapsed ?? false);
			eventCardUiStateStore.setCollapsed(this.props.eventId, nextCollapsed);
			const savedBlockCollapsed = savedUiState ? savedUiState.blockCollapsed : undefined;
			const nextBlockCollapsed = savedBlockCollapsed
				? { trigger: savedBlockCollapsed.trigger, check: savedBlockCollapsed.check, action: savedBlockCollapsed.action }
				: { trigger: false, check: false, action: false };
			eventCardUiStateStore.setBlockCollapsedMap(this.props.eventId, nextBlockCollapsed);
			this.setState(
				{
					blockCollapsed: nextBlockCollapsed,
					metaOpen: false,
					collapsed: nextCollapsed,
					addBlockType: undefined,
					addType: undefined,
					addInsertIndex: undefined,
				},
				() => {
					this.updateCollapseDOM(nextCollapsed);
				}
			);
			return;
		}
		if (prevProps.initialCollapsed !== this.props.initialCollapsed && this.props.initialCollapsed !== undefined) {
			const nextCollapsed = !!this.props.initialCollapsed;
			this.setState({ collapsed: nextCollapsed }, () => {
				eventCardUiStateStore.setCollapsed(this.props.eventId, nextCollapsed);
				this.updateCollapseDOM(nextCollapsed);
			});
		}
	}

	componentWillUnmount(): void {
		this.detachEditorListeners();
	}

	private handleSchemaUpdated = () => {
		this.setState((prev) => ({ schemaVersion: prev.schemaVersion + 1 }));
	};

	private refreshForEventChange(payload?: EditorChangeEventPayload) {
		if (!payload?.eventId) {
			return;
		}
		if (payload.eventId !== this.props.eventId) {
			return;
		}
		this.forceUpdate();
	}

	private handleEventUpdated = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleTriggerAdded = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleTriggerUpdated = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleTriggerRemoved = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleTriggerMoved = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleCheckAdded = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleCheckUpdated = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleCheckRemoved = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleCheckMoved = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleActionAdded = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleActionUpdated = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleActionRemoved = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private handleActionMoved = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private toggleSection = (section: EventBlockType) => {
		this.setState((prev) => {
			const nextCollapsed = !prev.blockCollapsed[section];
			eventCardUiStateStore.setBlockCollapsed(this.props.eventId, section, nextCollapsed);
			return {
				blockCollapsed: { ...prev.blockCollapsed, [section]: nextCollapsed },
			};
		});
	};

	private openMeta = () => this.setState({ metaOpen: true });
	private closeMeta = () => this.setState({ metaOpen: false });
	private openAdd = (blockType: EventBlockType, insertIndex?: number) =>
		this.setState({ addBlockType: blockType, addType: undefined, addInsertIndex: insertIndex });
	private closeAdd = () => this.setState({ addBlockType: undefined, addType: undefined, addInsertIndex: undefined });
	private openEditListAsJson = (blockType: EventBlockType) => this.setState({ jsonEditBlockType: blockType });
	private closeEditListAsJson = () => this.setState({ jsonEditBlockType: undefined });
	private toggleCollapse = (nextCollapsed: boolean) => {
		this.setState({ collapsed: nextCollapsed }, () => {
			eventCardUiStateStore.setCollapsed(this.props.eventId, nextCollapsed);
			this.updateCollapseDOM(nextCollapsed);
		});
	};

	render() {
		const event = this.readEvent(this.props.eventId);
		const { schemaVersion } = this.state;
		const triggerCount = Array.isArray(event.triggers) ? event.triggers.length : 0;
		const checkCount = Array.isArray(event.checks) ? event.checks.length : 0;
		const actionCount = Array.isArray(event.actions) ? event.actions.length : 0;
		const disabledClass = event.disabled && !this.state.metaOpen ? 'border-danger opacity-75' : '';
		const editingClass = this.state.metaOpen ? 'border-primary' : '';
		const collapsed = this.state.collapsed;
		const schema = editor.getSchema();
		const addSection = this.state.addBlockType;
		const addLibraryPanel = addSection
			? createPortal(
				<LogicLibraryPanel
					open
					title={translation.logic.add[addSection].getTrans()}
					blockType={addSection}
					schemaVersion={schemaVersion}
					onSelect={(type) => {
						this.setState({ addType: type });
					}}
					onClose={this.closeAdd}
				/>,
				document.body
			)
				: null;

		const editListPanel = this.state.jsonEditBlockType
			? createPortal(
				<LogicListJsonPanel
					eventId={event.id}
					blockType={this.state.jsonEditBlockType}
					onClose={this.closeEditListAsJson}
				/>,
				document.body
			)
			: null;

		const addConfigPanel =
			this.state.addBlockType && this.state.addType
				? createPortal(
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.closeAdd();
								}
							}}
						>
							<div
								className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable cgenh-modal-dialog"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<RJSFConfigsPanel
									schema={schema}
									schemaSection={this.state.addBlockType}
									configs={{ [this.state.addType]: {} }}
									configKey={this.state.addType}
									onUpdate={(patch) => {
										const type = this.state.addType;
										const blockType = this.state.addBlockType;
										if (!type || !blockType) return;
										const data = patch?.configs?.[type] ?? {};
										editor.insertLogic(event.id, blockType, { type, data }, this.state.addInsertIndex);
									}}
									onClose={this.closeAdd}
									onBack={() => this.setState({ addType: undefined })}
								/>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>,
					document.body
				)
				: null;

		return (
			<section
				ref={this.cardRef}
				data-event-id={event.id}
				className={[
					'card',
					'shadow-sm',
					'cgenh-event-card',
					collapsed ? 'cgenh-event-card--collapsed' : '',
					event.disabled ? 'cgenh-event-card--disabled' : '',
					disabledClass,
					editingClass,
				].filter(Boolean).join(' ')}
			>
				<EventCardHeader
					eventId={event.id}
					event={event}
					collapsed={collapsed}
					triggerCount={triggerCount}
					checkCount={checkCount}
					actionCount={actionCount}
					onToggleCollapse={this.toggleCollapse}
					onEdit={this.openMeta}
					isFirst={this.props.isFirst}
					isLast={this.props.isLast}
				/>

				<EventLogicSections
					event={event}
					schemaVersion={schemaVersion}
					blockCollapsed={this.state.blockCollapsed}
					logicListRefs={this.logicListRefs}
					onToggleSection={this.toggleSection}
					onOpenAdd={this.openAdd}
					onEditListAsJson={this.openEditListAsJson}
				/>
				{addLibraryPanel}
				{addConfigPanel}
				{editListPanel}
				{this.state.metaOpen && createPortal(
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.closeMeta();
								}
							}}
						>
							<div
								className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable cgenh-modal-dialog"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<RJSFConfigsPanel
									schema={eventSchemaJson}
									schemaSection="definition"
									configs={{ Event: buildEventMetaEditorData(event) }}
									configKey="Event"
									title={event.id}
									description={translation.events.editEvent.getTrans()}
									onValidate={(meta) => validateEventMetaEditorData(this.props.eventId, meta)}
									onUpdate={(patch) => {
										const configs = isRecord(patch?.configs) ? patch.configs : undefined;
										const meta = configs ? configs['Event'] : undefined;
										if (!isRecord(meta)) {
											return;
										}
										editor.updateEvent(this.props.eventId, buildEventPatchFromMeta(meta));
									}}
									onClose={this.closeMeta}
								/>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>,
					document.body
				)}
			</section>
		);
	}
}

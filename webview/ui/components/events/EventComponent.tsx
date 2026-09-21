import { ICgEvent } from '@shared';
import eventSchemaJson from '@media/json/event.enheditor.schema.json';
import React from 'react';
import { createPortal } from 'react-dom';
import type { EditorChangeEventPayload, EditorChangeEventType } from '../../../editor/CgEventsEditor';
import { createDefaultEvent } from '../../../editor/EventDefaults';
import { editor, EditorChangeEvents } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { translation } from '../../../trans/Trans';
import { RJSFConfigsPanel } from '../../rjsf/RJSFConfigsPanel';
import { isRecord } from '../../rjsf/utils/rjsfUtils';
import { acquireModalLock } from '../../utils/modalLock';
import { cloneDraftSnapshot, isDraftSnapshotCurrent } from '../../utils/draftSnapshot';
import { EventCardHeader } from './EventCardHeader';
import { getEventIdentityValidationMessage, validateEventFolder, validateEventId } from './EventIdentityValidation';
import { buildEventMetaEditorData, buildEventPatchFromMeta } from './EventMetaData';
import { eventCardUiStateStore } from './EventCardUiStateStore';
import { EventLogicSections } from './EventLogicSections';
import { LogicItemsList } from './LogicItemsList';
import { LogicListJsonPanel } from './LogicListJsonPanel';
import { LogicLibraryPanel } from './LogicLibraryPanel';
import { getOwnLogicSchemaSectionEntry } from './LogicSchemaEntry';

const EVENT_CONTENT_CHANGE_EVENTS: readonly EditorChangeEventType[] = [
	EditorChangeEvents.EVENT_UPDATED,
	EditorChangeEvents.TRIGGER_ADDED,
	EditorChangeEvents.TRIGGER_UPDATED,
	EditorChangeEvents.TRIGGER_REMOVED,
	EditorChangeEvents.TRIGGER_MOVED,
	EditorChangeEvents.CHECK_ADDED,
	EditorChangeEvents.CHECK_UPDATED,
	EditorChangeEvents.CHECK_REMOVED,
	EditorChangeEvents.CHECK_MOVED,
	EditorChangeEvents.ACTION_ADDED,
	EditorChangeEvents.ACTION_UPDATED,
	EditorChangeEvents.ACTION_REMOVED,
	EditorChangeEvents.ACTION_MOVED,
];

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

function validateEventMetaEditorData(editingEventId: string, meta: any): string | undefined {
	const idValidation = validateEventId(
		meta?.id,
		editingEventId,
		(eventId) => Boolean(editor.getEventById(eventId)),
	);
	if (idValidation.error) {
		return getEventIdentityValidationMessage(idValidation.error);
	}

	const folderValidation = validateEventFolder(meta?.folder);
	return folderValidation.error
		? getEventIdentityValidationMessage(folderValidation.error)
		: undefined;
}

export class EventComponent extends React.Component<EventComponentProps, EventComponentState> {
	private cardRef: React.RefObject<HTMLElement> = React.createRef();
	private logicListRefs: Record<EventBlockType, React.RefObject<LogicItemsList>> = {
		trigger: React.createRef<LogicItemsList>(),
		check: React.createRef<LogicItemsList>(),
		action: React.createRef<LogicItemsList>(),
	};
	private editorListenersAttached = false;
	private releaseMetaModalLock: (() => void) | null = null;
	private metaInitialSnapshot?: Record<string, any>;

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

	public setCollapsed(collapsed: boolean) {
		this.setState({ collapsed }, () => {
			eventCardUiStateStore.setCollapsed(this.props.eventId, collapsed);
			this.updateCollapseDOM(collapsed);
		});
	}

	private updateCollapseDOM(collapsed = this.state.collapsed) {
		if (this.cardRef.current) {
			this.cardRef.current.classList.toggle('cgenh-event-card--collapsed', collapsed);
		}
	}

	private readEvent(eventId: string): ICgEvent {
		const event = editor.getEventById(eventId);
		if (event) {
			return event;
		}
		return createDefaultEvent(eventId);
	}

	shouldComponentUpdate(nextProps: EventComponentProps, nextState: EventComponentState) {
		if (this.hasStateChanged(nextState)) return true;
		if (this.props.eventId !== nextProps.eventId) return true;
		if (this.props.initialCollapsed !== nextProps.initialCollapsed) return true;
		if (this.props.isFirst !== nextProps.isFirst) return true;
		if (this.props.isLast !== nextProps.isLast) return true;
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
		if (this.editorListenersAttached) return;
		this.editorListenersAttached = true;
		editor.on(EditorChangeEvents.SCHEMA_UPDATED, this.handleSchemaUpdated);
		editor.on(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentUpdated);
		for (const eventType of EVENT_CONTENT_CHANGE_EVENTS) {
			editor.on(eventType, this.handleEventContentChange);
		}
	}

	private detachEditorListeners(): void {
		if (!this.editorListenersAttached) return;
		this.editorListenersAttached = false;
		editor.off(EditorChangeEvents.SCHEMA_UPDATED, this.handleSchemaUpdated);
		editor.off(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentUpdated);
		for (const eventType of EVENT_CONTENT_CHANGE_EVENTS) {
			editor.off(eventType, this.handleEventContentChange);
		}
	}

	componentDidUpdate(prevProps: EventComponentProps) {
		if (prevProps.eventId !== this.props.eventId) {
			this.releaseMetaModalLock?.();
			this.releaseMetaModalLock = null;
			this.metaInitialSnapshot = undefined;
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
				() => this.updateCollapseDOM(nextCollapsed)
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
		this.releaseMetaModalLock?.();
		this.releaseMetaModalLock = null;
	}

	private handleSchemaUpdated = () => {
		const schema = editor.getSchema();
		this.setState((prev) => {
			const addEntry = prev.addBlockType && prev.addType
				? getOwnLogicSchemaSectionEntry(schema, prev.addBlockType, prev.addType)
				: undefined;
			const addTypeUnavailable = Boolean(prev.addBlockType && prev.addType)
				&& (!addEntry || addEntry.deprecated === true);
			return {
				schemaVersion: prev.schemaVersion + 1,
				addType: addTypeUnavailable ? undefined : prev.addType,
			};
		});
	};

	private handleDocumentUpdated = () => {
		if (editor.getEventById(this.props.eventId)) this.forceUpdate();
	};

	private refreshForEventChange(payload?: EditorChangeEventPayload) {
		if (!payload?.eventId || payload.eventId !== this.props.eventId) return;
		this.forceUpdate();
	}

	private handleEventContentChange = (payload?: EditorChangeEventPayload) => {
		this.refreshForEventChange(payload);
	};

	private toggleSection = (section: EventBlockType) => {
		this.setState((prev) => {
			const nextCollapsed = !prev.blockCollapsed[section];
			eventCardUiStateStore.setBlockCollapsed(this.props.eventId, section, nextCollapsed);
			return { blockCollapsed: { ...prev.blockCollapsed, [section]: nextCollapsed } };
		});
	};

	private openMeta = () => {
		this.metaInitialSnapshot = cloneDraftSnapshot(buildEventMetaEditorData(this.readEvent(this.props.eventId)));
		this.releaseMetaModalLock = this.releaseMetaModalLock ?? acquireModalLock();
		this.setState({ metaOpen: true });
	};
	private closeMeta = () => {
		this.releaseMetaModalLock?.();
		this.releaseMetaModalLock = null;
		this.metaInitialSnapshot = undefined;
		this.setState({ metaOpen: false });
	};
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
					onSelect={(type) => this.setState({ addType: type })}
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
								if (e.target === e.currentTarget) this.closeAdd();
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
								if (e.target === e.currentTarget) this.closeMeta();
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
										if (!isRecord(meta)) return;
										const currentEvent = editor.getEventById(this.props.eventId);
										const currentMeta = currentEvent ? buildEventMetaEditorData(currentEvent) : undefined;
										if (!this.metaInitialSnapshot || !currentMeta || !isDraftSnapshotCurrent(this.metaInitialSnapshot, currentMeta)) {
											throw new Error(translation.validation.dataChanged.getTrans());
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

import { ICgEvent } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SvgCircleCheck } from '../../svg/SvgCircleCheck';
import { SvgCircleSlash } from '../../svg/SvgCircleSlash';
import { SvgCodeBracketsStroke } from '../../svg/SvgCodeBracketsStroke';
import { SvgEdit } from '../../svg/SvgEdit';
import { SvgFolderFilled } from '../../svg/SvgFolderFilled';
import { SvgFolderOutline } from '../../svg/SvgFolderOutline';
import { SvgLink } from '../../svg/SvgLink';
import { SvgMinusStroke } from '../../svg/SvgMinusStroke';
import { SvgMoreVertical } from '../../svg/SvgMoreVertical';
import { SvgMoveDownTriangle } from '../../svg/SvgMoveDownTriangle';
import { SvgMoveUpTriangle } from '../../svg/SvgMoveUpTriangle';
import { SvgPlayCircle } from '../../svg/SvgPlayCircle';
import { SvgPlusStroke } from '../../svg/SvgPlusStroke';
import { SvgRefresh } from '../../svg/SvgRefresh';
import { SvgRepeat } from '../../svg/SvgRepeat';
import { SvgTrashOutline } from '../../svg/SvgTrashOutline';
import { EVENT_FOLDER_REGEX, EVENT_NAME_REGEX } from '../../utils/validators';
import { ContextMenuPortal } from './ContextMenuPortal';
import { contextMenuStateManager } from './ContextMenuState';
import { eventCardHeaderGlobalManager } from './EventCardHeaderGlobalManager';

function pad2(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

function formatClockTimeSeconds(totalSeconds: number): string {
	const clamped = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
	const hours = Math.floor(clamped / 3600);
	const minutes = Math.floor((clamped % 3600) / 60);
	const seconds = clamped % 60;
	return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export interface EventCardHeaderProps {
	eventId: string;
	event: ICgEvent;
	collapsed: boolean;
	triggerCount: number;
	checkCount: number;
	actionCount: number;
	onToggleCollapse(next: boolean): void;
	onEdit(): void;
	isFirst?: boolean;
	isLast?: boolean;
}

interface EventCardHeaderState {
	editingId: boolean;
	editingFolder: boolean;
	idValue: string;
	folderValue: string;
	idError?: string;
	folderError?: string;
	contextMenuOpen: boolean;
	contextMenuX: number;
	contextMenuY: number;
}

export class EventCardHeader extends React.PureComponent<EventCardHeaderProps, EventCardHeaderState> {
	private headerElement: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private compactUpdateFrame: number | null = null;
	// Dynamic listeners (added/removed based on state)
	private resizeFallbackAttached = false;

	constructor(props: EventCardHeaderProps) {
		super(props);
		const event = this.getEventSnapshot(props.eventId);
		this.state = {
			editingId: false,
			editingFolder: false,
			idValue: event.id,
			folderValue: event.folder ?? '',
			idError: undefined,
			folderError: undefined,
			contextMenuOpen: false,
			contextMenuX: 0,
			contextMenuY: 0,
		};
	}

	private setup(): void {
		contextMenuStateManager.on('change', this.handleContextMenuStateChange, this);
	}

	private dispose(): void {
		contextMenuStateManager.off('change', this.handleContextMenuStateChange, this);
	}

	componentDidMount(): void {
		this.setup();
		eventCardHeaderGlobalManager.register(this.props.eventId, this);
		this.observeHeader();
		this.scheduleCompactUpdate();
	}

	componentDidUpdate(prevProps: EventCardHeaderProps, prevState: EventCardHeaderState) {
		const eventIdChanged = prevProps.eventId !== this.props.eventId;
		const eventChanged = prevProps.event !== this.props.event;

		if (eventIdChanged) {
			this.closeContextMenu();
			const nextEvent = this.getEventSnapshot(this.props.eventId);
			this.setState({
				editingId: false,
				editingFolder: false,
				idValue: nextEvent.id,
				folderValue: nextEvent.folder ?? '',
				idError: undefined,
				folderError: undefined,
				contextMenuOpen: false,
			});
		} else if (eventChanged && !this.state.editingId && !this.state.editingFolder) {
			// Sync state when event data changes (e.g., folder updated from elsewhere)
			const nextEvent = this.props.event;
			const needsSync =
				this.state.idValue !== nextEvent.id ||
				this.state.folderValue !== (nextEvent.folder ?? '');
			if (needsSync) {
				this.setState({
					idValue: nextEvent.id,
					folderValue: nextEvent.folder ?? '',
				});
			}
		}

		this.observeHeader();
		this.scheduleCompactUpdate();
	}

	componentWillUnmount(): void {
		this.dispose();
		eventCardHeaderGlobalManager.clearContextMenuOwner(this.props.eventId);
		eventCardHeaderGlobalManager.unregister(this.props.eventId, this);
		if (this.compactUpdateFrame !== null) {
			cancelAnimationFrame(this.compactUpdateFrame);
			this.compactUpdateFrame = null;
		}
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.resizeFallbackAttached) {
			winEE.off('resize', this.handleResizeFallback, this);
			this.resizeFallbackAttached = false;
		}
	}

	private setHeaderRef = (element: HTMLElement | null) => {
		this.headerElement = element;
	};

	private observeHeader() {
		if (!this.headerElement) return;
		if (typeof ResizeObserver === 'undefined') {
			if (!this.resizeFallbackAttached) {
				winEE.on('resize', this.handleResizeFallback, this);
				this.resizeFallbackAttached = true;
			}
			return;
		}
		if (!this.resizeObserver) {
			this.resizeObserver = new ResizeObserver(() => this.scheduleCompactUpdate());
			this.resizeObserver.observe(this.headerElement);
		}
	}

	private handleResizeFallback = () => this.scheduleCompactUpdate();

	private scheduleCompactUpdate = () => {
		if (this.compactUpdateFrame !== null) return;
		this.compactUpdateFrame = requestAnimationFrame(() => {
			this.compactUpdateFrame = null;
			this.applyCompactLevel();
		});
	};

	private applyCompactLevel() {
		const header = this.headerElement;
		if (!header) return;

		const maxLevel = 4;
		const isOverflowing = () => header.scrollWidth > header.clientWidth + 1;
		const idElement = header.querySelector('.cgenh-event-card__id');
		const idInput = header.querySelector('.cgenh-event-card__id-input');
		const folderBadge = header.querySelector('.cgenh-event-card__folder-badge');
		const folderInput = header.querySelector('.cgenh-event-card__folder-input');
		const chips = header.querySelector('.cgenh-event-card__chips');
		const resolveElement = (primary: Element | null, fallback: Element | null): HTMLElement | null => {
			if (primary instanceof HTMLElement) return primary;
			if (fallback instanceof HTMLElement) return fallback;
			return null;
		};
		const idTarget = resolveElement(idElement, idInput);
		const folderTarget = resolveElement(folderBadge, folderInput);
		const chipsTarget = chips instanceof HTMLElement ? chips : null;
		const isTruncated = (element: HTMLElement | null) => element ? element.scrollWidth > element.clientWidth + 1 : false;
		const needsCompaction = () =>
			isOverflowing() ||
			isTruncated(idTarget) ||
			isTruncated(folderTarget) ||
			isTruncated(chipsTarget);
		const setLevel = (level: number) => {
			if (level <= 0) header.removeAttribute('data-cgenh-compact-level');
			else header.setAttribute('data-cgenh-compact-level', String(level));
		};

		const rawLevel = header.getAttribute('data-cgenh-compact-level');
		const parsedLevel = rawLevel ? Number(rawLevel) : 0;
		let level = Number.isFinite(parsedLevel) ? parsedLevel : 0;
		level = Math.min(maxLevel, Math.max(0, Math.floor(level)));

		setLevel(level);
		if (needsCompaction()) {
			while (level < maxLevel && needsCompaction()) {
				level += 1;
				setLevel(level);
			}
			return;
		}

		while (level > 0) {
			const nextLevel = level - 1;
			setLevel(nextLevel);
			if (needsCompaction()) {
				setLevel(level);
				break;
			}
			level = nextLevel;
		}
	}

	private openContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		// If already open and the click is inside the menu, do nothing (don't close or reopen)
		const menuId = this.getMenuId();
		contextMenuStateManager.openContextMenu(menuId);
		eventCardHeaderGlobalManager.setContextMenuOwner(this.props.eventId);
		this.setState({
			contextMenuOpen: true,
			contextMenuX: e.clientX,
			contextMenuY: e.clientY,
		});
	};

	private closeContextMenu = () => {
		eventCardHeaderGlobalManager.clearContextMenuOwner(this.props.eventId);
		if (!this.state.contextMenuOpen) return;
		contextMenuStateManager.closeContextMenu(this.getMenuId());
		this.setState({ contextMenuOpen: false });
	};

	private handleHeaderContextMenu = (e: React.MouseEvent) => {
		const target = e.target instanceof HTMLElement ? e.target : null;
		// Allow the native menu inside editable inputs while still enabling a quick right-click menu elsewhere
		if (target && target.closest('input, textarea, select, option, [contenteditable]')) {
			return;
		}
		this.openContextMenu(e);
	};

	private getMenuId() {
		return `event-${this.props.eventId}`;
	}

	private handleContextMenuStateChange = () => {
		if (this.state.contextMenuOpen) {
			const id = this.getMenuId();
			if (contextMenuStateManager.shouldClose(id)) {
				this.closeContextMenu();
			}
		}
	};

	public handleEventHeaderMenuKeyDown = (event: KeyboardEvent) => {
		if (!this.state.contextMenuOpen) return;
		if (event.repeat) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			this.closeContextMenu();
			return;
		}
		const key = event.key.toLowerCase();
		if (!['d', 'e', 'a', 'r', 'c'].includes(key)) return;
		event.preventDefault();

		event.stopPropagation();
		if (key === 'd') this.handleDuplicate();
		if (key === 'e') this.handleEdit();
		if (key === 'a') this.handleToggleDisabled();
		if (key === 'r') this.handleRemove();
		if (key === 'c') this.handleToggleCollapseAction();
	};


	private getEventSnapshot(eventId: string): ICgEvent {
		const event = this.props.event || editor.getEventById(eventId);
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

	private startEditId = () => {
		const event = this.getEventSnapshot(this.props.eventId);
		this.setState({ editingId: true, idValue: event.id, idError: undefined });
	};

	private startEditFolder = () => {
		const event = this.getEventSnapshot(this.props.eventId);
		this.setState({ editingFolder: true, folderValue: event.folder ?? '', folderError: undefined });
	};

	private commitId = () => {
		const nextId = this.state.idValue.trim();
		if (!nextId) {
			this.setState({ idError: translation.events.eventNameRequired.getTrans() });
			return;
		}
		if (!EVENT_NAME_REGEX.test(nextId)) {
			this.setState({ idError: translation.events.eventNameInvalid.getTrans() });
			return;
		}
		const currentEvent = this.getEventSnapshot(this.props.eventId);
		const events = editor.getEvents();
		const exists = events.some((evt) => evt.id === nextId && evt.id !== currentEvent.id);
		if (exists) {
			this.setState({ idError: translation.events.eventNameExists.getTrans() });
			return;
		}
		if (nextId !== currentEvent.id) {
			editor.updateEvent(currentEvent.id, { id: nextId });
		}
		this.setState({ editingId: false, idError: undefined });
	};

	private cancelIdEdit = () => {
		const event = this.getEventSnapshot(this.props.eventId);
		this.setState({ editingId: false, idValue: event.id, idError: undefined });
	};

	private commitFolder = () => {
		const nextFolder = this.state.folderValue.trim();
		if (!EVENT_FOLDER_REGEX.test(nextFolder)) {
			this.setState({ folderError: translation.events.folderNameInvalid.getTrans() });
			return;
		}
		editor.updateEvent(this.props.eventId, { folder: nextFolder });
		this.setState({ editingFolder: false, folderError: undefined, folderValue: nextFolder });
	};

	private cancelFolderEdit = () => {
		const event = this.getEventSnapshot(this.props.eventId);
		this.setState({ editingFolder: false, folderValue: event.folder ?? '', folderError: undefined });
	};

	private handleEdit = () => {
		this.props.onEdit();
		this.closeContextMenu();
	}

	private handleDuplicate = () => {
		editor.duplicateEvent(this.props.eventId);
		this.closeContextMenu();
	}

	private handleToggleDisabled = () => {
		editor.toggleEventDisabled(this.props.eventId);
		this.closeContextMenu();
	};

	private handleRemove = () => {
		editor.removeEvent(this.props.eventId);
		this.closeContextMenu();
	};

	private handleToggleCollapseAction = () => {
		this.props.onToggleCollapse(!this.props.collapsed);
		this.closeContextMenu();
	};

	renderContextMenu() {
		if (!this.state.contextMenuOpen) return null;
		const { contextMenuX, contextMenuY } = this.state;
		const event = this.getEventSnapshot(this.props.eventId);

		return (
			<ContextMenuPortal
				open
				anchorX={contextMenuX}
				anchorY={contextMenuY}
				width={220}
				className="dropdown-menu show"
				onClose={this.closeContextMenu}
			>
				<button type="button" className="dropdown-item" onClick={this.handleDuplicate}>
					{translation.common.duplicate.getTrans()} (D)
				</button>
				<button type="button" className="dropdown-item" onClick={this.handleEdit}>
					{translation.common.edit.getTrans()} (E)
				</button>
				<button
					type="button"
					className="dropdown-item"
					onClick={this.handleToggleCollapseAction}
				>
					{this.props.collapsed ? translation.list.expand.getTrans() : translation.list.collapse.getTrans()} (C)
				</button>
				<button type="button" className="dropdown-item" onClick={this.handleToggleDisabled}>
					{event.disabled ? translation.state.enable.getTrans() : translation.state.disable.getTrans()} (A)
				</button>
				<button type="button" className="dropdown-item text-danger" onClick={this.handleRemove}>
					{translation.common.remove.getTrans()} (R)
				</button>
			</ContextMenuPortal>
		);
	}

	render() {
		const { collapsed, triggerCount, checkCount, actionCount, onToggleCollapse, onEdit } = this.props;
		const event = this.getEventSnapshot(this.props.eventId);
		const DEFAULTS = {
			startTime: 0,
			checkInterval: 10,
			repeats: 0,
			repeatInterval: 0,
			devOnly: false,
		};
		const startTime = event.startTime ?? DEFAULTS.startTime;
		const checkInterval = event.checkInterval ?? DEFAULTS.checkInterval;
		const repeats = event.repeats ?? DEFAULTS.repeats;
		const repeatInterval = event.repeatInterval ?? DEFAULTS.repeatInterval;
		const showStart = startTime !== DEFAULTS.startTime;
		const showCheck = checkInterval !== DEFAULTS.checkInterval;
		const showInterval = repeatInterval !== DEFAULTS.repeatInterval;
		const showDev = event.devOnly === true;
		const repeatDisplay = repeats === -1 ? '∞' : repeats;
		const repeatChipOff = repeats === 0;
		const repeatParts: string[] = repeats === 0 ? [] : [`x ${repeatDisplay}`];
		if (repeats !== 0 && showInterval) repeatParts.push(`${repeatInterval}ms`);
		const repeatSummary = repeatParts.join(' / ');
		const repeatTitle = repeatChipOff ? `${translation.events.chips.repeat.getTrans()}: ${translation.events.status.disabled.getTrans()}` : `${translation.events.chips.repeat.getTrans()}: ${repeatSummary}`;
		const startSummary = formatClockTimeSeconds(startTime);
		const checkSummary = `${checkInterval}ms`;
		const showFolder = true;
		const folderText = (this.state.editingFolder ? this.state.folderValue : (event.folder ?? '')).trim();
		const folderBadgeClassName = [
			'badge',
			'd-inline-flex',
			'align-items-center',
			'gap-1',
			'cgenh-event-card__folder-badge',
			folderText ? 'cgenh-event-card__folder-badge--has-folder' : 'opacity-50 fst-italic',
		].join(' ');
		return (
			<header
				ref={this.setHeaderRef}
				className="card-header cgenh-event-card__header py-1 ps-2 pe-2"
				onContextMenu={this.handleHeaderContextMenu}
			>
				{/* Row 1: collapse button + event name + folder + counts */}
				<button
					type="button"
					className="btn btn-sm btn-outline-secondary flex-shrink-0"
					title={collapsed ? translation.events.expandEvent.getTrans() : translation.events.collapseEvent.getTrans()}
					onClick={() => onToggleCollapse(!collapsed)}
					onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
				>
					{collapsed ? (
						<SvgPlusStroke aria-hidden="true" />
					) : (
						<SvgMinusStroke aria-hidden="true" />
					)}
				</button>
				{this.state.editingId ? (
					<input
						autoFocus
						className="form-control form-control-sm cgenh-event-card__id-input"
						value={this.state.idValue}
						onChange={(e) => this.setState({ idValue: e.target.value })}
						onBlur={this.cancelIdEdit}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								this.commitId();
							}
							if (e.key === 'Escape') {
								e.preventDefault();
								this.cancelIdEdit();
							}
						}}
					/>
				) : (
					<span
						className="cgenh-event-card__id"
						onDoubleClick={this.startEditId}
						title={`${event.id} (${translation.events.renameEventNameHint.getTrans()})`}
					>
						{event.id}
					</span>
				)}
				{(showFolder || this.state.editingFolder) && (
					this.state.editingFolder ? (
						<input
							autoFocus
							className="form-control form-control-sm cgenh-event-card__folder-input"
							value={this.state.folderValue}
							onChange={(e) => this.setState({ folderValue: e.target.value })}
							onBlur={this.cancelFolderEdit}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									this.commitFolder();
								}
								if (e.key === 'Escape') {
									e.preventDefault();
									this.cancelFolderEdit();
								}
							}}
						/>
					) : (
						<span
							role="button"
							className={folderBadgeClassName}
							onDoubleClick={this.startEditFolder}
							title={`${folderText ? folderText + ' ' : ''}(${translation.events.renameFolderHint.getTrans()})`}
						>
							<span className="cgenh-event-card__folder-icon" aria-hidden="true">
								{folderText ? (
									<SvgFolderFilled aria-hidden="true" />
								) : (
									<SvgFolderOutline aria-hidden="true" />
								)}
							</span>
							<span>{folderText || translation.events.noFolder.getTrans()}</span>
						</span>
					)
				)}
				<span
					className="badge cgenh-event-card__count-badge"
					title={`${translation.logic.blocks.trigger.getTrans()}: ${triggerCount}, ${translation.logic.blocks.check.getTrans()}: ${checkCount}, ${translation.logic.blocks.action.getTrans()}: ${actionCount}`}
				>
					<span>{triggerCount}</span>
					{'/'}
					<span>{checkCount}</span>
					{'/'}
					<span>{actionCount}</span>
				</span>

				{/* Summary chips (hidden when overflow) */}
				<div className="cgenh-event-card__chips">
					<span
						className={`cgenh-event-chip cgenh-event-chip--repeat${repeatChipOff ? ' cgenh-event-chip--repeat-off' : ''}`}
						title={repeatTitle}
					>
						<span className="cgenh-event-chip__icon" aria-hidden="true">
							<SvgRepeat aria-hidden="true" />
						</span>
						{!repeatChipOff && <span className="cgenh-event-chip__text">{repeatSummary}</span>}
					</span>
					{showStart && (
						<span
							className="cgenh-event-chip cgenh-event-chip--start"
							title={`${translation.events.chips.start.getTrans()}: ${startSummary}`}
						>
							<span className="cgenh-event-chip__icon" aria-hidden="true">
								<SvgPlayCircle aria-hidden="true" />
							</span>
							<span className="cgenh-event-chip__text">{startSummary}</span>
						</span>
					)}
					{showCheck && (
						<span
							className="cgenh-event-chip cgenh-event-chip--check"
							title={`${translation.events.chips.check.getTrans()}: ${checkSummary}`}
						>
							<span className="cgenh-event-chip__icon" aria-hidden="true">
								<SvgRefresh aria-hidden="true" />
							</span>
							<span className="cgenh-event-chip__text">{checkSummary}</span>
						</span>
					)}
					{showDev && (
						<span
							className="cgenh-event-chip cgenh-event-chip--dev"
							title={translation.events.chips.dev.getTrans()}
						>
							<span className="cgenh-event-chip__icon" aria-hidden="true">
								<SvgCodeBracketsStroke width={14} height={14} aria-hidden="true" />
							</span>
							<span className="cgenh-event-chip__text">{translation.events.chips.dev.getTrans()}</span>
						</span>
					)}
					{event.referenceOnly && (
						<span className="cgenh-event-chip cgenh-event-chip--reference" title={translation.events.flags.referenceOnly.getTrans()}>
							<span className="cgenh-event-chip__icon" aria-hidden="true">
								<SvgLink aria-hidden="true" />
							</span>
							<span className="cgenh-event-chip__text">{translation.events.flags.referenceOnly.getTrans()}</span>
						</span>
					)}
				</div>

				{/* Action buttons - always at right */}
				<div className="btn-group btn-group-sm cgenh-event-card__actions cgenh-card-actions" role="group" aria-label={translation.events.eventActions.getTrans()}>
					<button
						type="button"
						className="btn cgenh-action-btn cgenh-action-btn--edit"
						onClick={onEdit}
						title={translation.common.edit.getTrans()}
						aria-label={translation.common.edit.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
					>
						<SvgEdit aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={() => editor.toggleEventDisabled(event.id)}
						onDoubleClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
						}}
						className="btn cgenh-action-btn cgenh-action-btn--toggle"
						aria-pressed={event.disabled}
						title={event.disabled ? translation.state.enable.getTrans() : translation.state.disable.getTrans()}
						aria-label={event.disabled ? translation.state.enable.getTrans() : translation.state.disable.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
					>
						<span className="cgenh-action-icon-stack" aria-hidden="true">
							<span className="cgenh-action-icon cgenh-action-icon--active">
								<SvgCircleCheck aria-hidden="true" />
							</span>
							<span className="cgenh-action-icon cgenh-action-icon--disabled">
								<SvgCircleSlash aria-hidden="true" />
							</span>
						</span>
					</button>
					<button
						type="button"
						onClick={() => editor.removeEvent(event.id)}
						title={translation.common.remove.getTrans()}
						aria-label={translation.common.remove.getTrans()}
						className="btn cgenh-action-btn cgenh-action-btn--danger"
						onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
					>
						<SvgTrashOutline aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={() => editor.moveEvent(event.id, -1)}
						title={translation.list.moveUp.getTrans()}
						aria-label={translation.list.moveUp.getTrans()}
						className="btn cgenh-action-btn cgenh-action-btn--move"
					disabled={this.props.isFirst}
					onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
				>
						<SvgMoveUpTriangle aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={() => editor.moveEvent(event.id, 1)}
						title={translation.list.moveDown.getTrans()}
						aria-label={translation.list.moveDown.getTrans()}
						className="btn cgenh-action-btn cgenh-action-btn--move"
					disabled={this.props.isLast}
					onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
				>
						<SvgMoveDownTriangle aria-hidden="true" />
					</button>
					<button
						type="button"
						className="btn cgenh-action-btn cgenh-action-btn--more"
						onClick={this.openContextMenu}
						title={translation.common.moreActions.getTrans()}
						aria-label={translation.common.moreActions.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
					>
						<SvgMoreVertical aria-hidden="true" />
					</button>
				</div>
				{this.renderContextMenu()}
			</header>
		);
	}
}

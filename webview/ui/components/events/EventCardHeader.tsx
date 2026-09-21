import { ICgEvent } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { translation } from '../../../trans/Trans';
import { winEE } from '../../../msg/WindowEventEmitter';
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
import { ContextMenuPortal } from './ContextMenuPortal';
import {
	ResponsiveCompactObserver,
	isHorizontallyOverflowing,
	reconcileCompactLevel,
} from './ResponsiveLayout';
import { contextMenuStateManager } from './ContextMenuState';
import { getEventIdentityValidationMessage, validateEventFolder, validateEventId } from './EventIdentityValidation';
import { buildEventHeaderSummary } from './EventHeaderSummary';

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
	private keydownAttached = false;
	private headerElement: HTMLElement | null = null;
	private readonly compactObserver = new ResponsiveCompactObserver(() => this.applyCompactLevel());

	constructor(props: EventCardHeaderProps) {
		super(props);
		const event = props.event;
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

	componentDidMount(): void {
		contextMenuStateManager.on('change', this.handleContextMenuStateChange);
		this.compactObserver.schedule();
	}

	componentDidUpdate(prevProps: EventCardHeaderProps, prevState: EventCardHeaderState) {
		if (!prevState.contextMenuOpen && this.state.contextMenuOpen && !this.keydownAttached) {
			winEE.on('keydown', this.handleEventHeaderMenuKeyDown);
			this.keydownAttached = true;
		}
		if (prevState.contextMenuOpen && !this.state.contextMenuOpen && this.keydownAttached) {
			winEE.off('keydown', this.handleEventHeaderMenuKeyDown);
			this.keydownAttached = false;
		}
		const eventIdChanged = prevProps.eventId !== this.props.eventId;
		const eventChanged = prevProps.event !== this.props.event;

		if (eventIdChanged) {
			contextMenuStateManager.closeContextMenu(this.getMenuId(prevProps.eventId));
			const nextEvent = this.props.event;
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

		this.compactObserver.schedule();
	}

	componentWillUnmount(): void {
		contextMenuStateManager.off('change', this.handleContextMenuStateChange);
		if (this.keydownAttached) {
			winEE.off('keydown', this.handleEventHeaderMenuKeyDown);
			this.keydownAttached = false;
		}
		this.compactObserver.dispose();
	}

	private setHeaderRef = (element: HTMLElement | null) => {
		this.headerElement = element;
		this.compactObserver.observe(element);
	};

	private applyCompactLevel() {
		const header = this.headerElement;
		if (!header) return;

		const maxLevel = 4;
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
		const needsCompaction = () =>
			isHorizontallyOverflowing(header) ||
			isHorizontallyOverflowing(idTarget) ||
			isHorizontallyOverflowing(folderTarget) ||
			isHorizontallyOverflowing(chipsTarget);
		const setLevel = (level: number) => {
			if (level <= 0) header.removeAttribute('data-cgenh-compact-level');
			else header.setAttribute('data-cgenh-compact-level', String(level));
		};

		reconcileCompactLevel(
			header.getAttribute('data-cgenh-compact-level'),
			maxLevel,
			setLevel,
			needsCompaction,
		);
	}

	private openContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		// If already open and the click is inside the menu, do nothing (don't close or reopen)
		const menuId = this.getMenuId();
		contextMenuStateManager.openContextMenu(menuId);
		this.setState({
			contextMenuOpen: true,
			contextMenuX: e.clientX,
			contextMenuY: e.clientY,
		});
	};

	private closeContextMenu = () => {
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

	private getMenuId(eventId = this.props.eventId) {
		return `event-${eventId}`;
	}

	private handleContextMenuStateChange = () => {
		if (this.state.contextMenuOpen) {
			const id = this.getMenuId();
			if (contextMenuStateManager.shouldClose(id)) {
				this.closeContextMenu();
			}
		}
	};

	private handleEventHeaderMenuKeyDown = (event: KeyboardEvent) => {
		if (!this.state.contextMenuOpen || event.isComposing) return;
		if (event.repeat) return;
		if (event.key !== 'Escape' && (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) return;
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


	private startEditId = () => {
		const event = this.props.event;
		this.setState({ editingId: true, idValue: event.id, idError: undefined });
	};

	private startEditFolder = () => {
		const event = this.props.event;
		this.setState({ editingFolder: true, folderValue: event.folder ?? '', folderError: undefined });
	};

	private commitId = () => {
		const currentEvent = this.props.event;
		const validation = validateEventId(
			this.state.idValue,
			currentEvent.id,
			(eventId) => Boolean(editor.getEventById(eventId)),
		);
		if (validation.error) {
			this.setState({ idError: getEventIdentityValidationMessage(validation.error) });
			return;
		}
		if (validation.value !== currentEvent.id) {
			editor.updateEvent(currentEvent.id, { id: validation.value });
		}
		this.setState({ editingId: false, idError: undefined });
	};

	private cancelIdEdit = () => {
		const event = this.props.event;
		this.setState({ editingId: false, idValue: event.id, idError: undefined });
	};

	private commitFolder = () => {
		const validation = validateEventFolder(this.state.folderValue);
		if (validation.error) {
			this.setState({ folderError: getEventIdentityValidationMessage(validation.error) });
			return;
		}
		editor.updateEvent(this.props.eventId, { folder: validation.value });
		this.setState({ editingFolder: false, folderError: undefined, folderValue: validation.value });
	};

	private cancelFolderEdit = () => {
		const event = this.props.event;
		this.setState({ editingFolder: false, folderValue: event.folder ?? '', folderError: undefined });
	};

	private handleEdit = () => {
		this.props.onEdit();
		this.closeContextMenu();
	};

	private handleDuplicate = () => {
		editor.duplicateEvent(this.props.eventId);
		this.closeContextMenu();
	};

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
		const event = this.props.event;

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
		const { collapsed, triggerCount, checkCount, actionCount, onToggleCollapse } = this.props;
		const event = this.props.event;
		const {
			showStart,
			showCheck,
			showDev,
			repeatChipOff,
			repeatSummary,
			startSummary,
			checkSummary,
		} = buildEventHeaderSummary(event);
		const repeatTitle = repeatChipOff
			? `${translation.events.chips.repeat.getTrans()}: ${translation.events.status.disabled.getTrans()}`
			: `${translation.events.chips.repeat.getTrans()}: ${repeatSummary}`;
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
							if (e.nativeEvent.isComposing) return;
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
				{this.state.editingFolder ? (
					<input
							autoFocus
							className="form-control form-control-sm cgenh-event-card__folder-input"
							value={this.state.folderValue}
							onChange={(e) => this.setState({ folderValue: e.target.value })}
							onBlur={this.cancelFolderEdit}
							onKeyDown={(e) => {
								if (e.nativeEvent.isComposing) return;
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
						onClick={this.handleEdit}
						title={translation.common.edit.getTrans()}
						aria-label={translation.common.edit.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
					>
						<SvgEdit aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={this.handleToggleDisabled}
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
						onClick={this.handleRemove}
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
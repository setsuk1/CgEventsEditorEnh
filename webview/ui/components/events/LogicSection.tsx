import React from 'react';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SvgCodeBrackets } from '../../svg/SvgCodeBrackets';
import { SvgChevronDown } from '../../svg/SvgChevronDown';
import { SvgChevronRight } from '../../svg/SvgChevronRight';
import { SvgPlusStroke } from '../../svg/SvgPlusStroke';
import { ContextMenuPortal } from './ContextMenuPortal';
import { contextMenuStateManager, createLogicContextMenuId } from './ContextMenuState';
import { resolveLogicListShortcut } from './LogicItemsListShortcuts';

interface LogicSectionProps {
	title: string;
	blockType: EventBlockType;
	count: number;
	collapsed: boolean;
	onToggle(blockType: EventBlockType): void;
	children: React.ReactNode;
	onAdd?: () => void;
	onEditListAsJson?: () => void;
	addLabel?: string;
	eventId?: string;
	onCopyList?: () => void;
	onCutList?: () => void;
	onPasteList?: () => void;
	onToggleDisableList?: () => void;
	onRemoveList?: () => void;
	onSelectAllList?: () => void;
	getToggleDisableListLabel?: () => string;
}

interface LogicSectionState {
	contextMenu?: { x: number; y: number };
}

export class LogicSection extends React.PureComponent<LogicSectionProps, LogicSectionState> {
	private keydownAttached = false;

	state: LogicSectionState = {
		contextMenu: undefined,
	};

	private closeContextMenu = () => {
		if (!this.state.contextMenu) return;
		contextMenuStateManager.closeContextMenu(this.getMenuId());
		this.setState({ contextMenu: undefined });
	};

	private toggleSectionCollapsed = () => {
		this.closeContextMenu();
		this.props.onToggle(this.props.blockType);
	};

	private runMenuAction(action?: () => void) {
		this.closeContextMenu();
		if (action) {
			action();
		}
	}

	private handleAdd = () => {
		if (!this.props.onAdd) return;
		this.closeContextMenu();
		this.props.onAdd();
	};

	private handleEditListAsJson = () => {
		if (!this.props.onEditListAsJson) return;
		this.closeContextMenu();
		this.props.onEditListAsJson();
	};

	private handleHeaderContextMenu = (event: React.MouseEvent) => {
		if (document.body.classList.contains('cgenh-has-modal-open')) {
			return;
		}
		event.preventDefault();

		event.stopPropagation();
		contextMenuStateManager.openContextMenu(this.getMenuId());
		this.setState({ contextMenu: { x: event.clientX, y: event.clientY } });
	};

	private getMenuId() {
		return createLogicContextMenuId('section-header', this.props.eventId ?? 'event', this.props.blockType);
	}

	private handleContextMenuStateChange = () => {
		if (!this.state.contextMenu) return;
		if (contextMenuStateManager.shouldClose(this.getMenuId())) {
			this.closeContextMenu();
		}
	};

	private handleKeyDown = (event: KeyboardEvent) => {
		if (!this.state.contextMenu || event.isComposing) return;
		const shortcut = resolveLogicListShortcut({
			key: event.key,
			repeat: event.repeat,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
			shiftKey: event.shiftKey,
			modalOpen: document.body.classList.contains('cgenh-has-modal-open'),
			interactiveTarget: false,
			contextMode: 'section',
			hasActiveIndex: false,
		});
		if (!shortcut) return;
		if (shortcut.consume || shortcut.action === 'escape') {
			event.preventDefault();
			event.stopPropagation();
		}

		switch (shortcut.action) {
			case 'escape':
				this.closeContextMenu();
				return;
			case 'section-copy':
				this.runMenuAction(this.props.onCopyList);
				return;
			case 'section-cut':
				this.runMenuAction(this.props.onCutList);
				return;
			case 'section-paste':
				this.runMenuAction(this.props.onPasteList);
				return;
			case 'section-toggle':
				this.toggleSectionCollapsed();
				return;
			case 'section-add':
				this.handleAdd();
				return;
			case 'section-toggle-disabled':
				this.runMenuAction(this.props.onToggleDisableList);
				return;
			case 'section-remove':
				this.runMenuAction(this.props.onRemoveList);
				return;
		}
	};

	componentDidUpdate(_: LogicSectionProps, prevState: LogicSectionState): void {
		if (!prevState.contextMenu && this.state.contextMenu) {
			if (!this.keydownAttached) {
				winEE.on('keydown', this.handleKeyDown);
				this.keydownAttached = true;
			}
		}
		if (prevState.contextMenu && !this.state.contextMenu) {
			if (this.keydownAttached) {
				winEE.off('keydown', this.handleKeyDown);
				this.keydownAttached = false;
			}
		}
	}

	componentDidMount(): void {
		contextMenuStateManager.on('change', this.handleContextMenuStateChange);
	}

	componentWillUnmount(): void {
		contextMenuStateManager.off('change', this.handleContextMenuStateChange);
		if (this.keydownAttached) {
			winEE.off('keydown', this.handleKeyDown);
			this.keydownAttached = false;
		}
	}

	private renderContextMenu() {
		const ctx = this.state.contextMenu;
		if (!ctx) return null;
		const { collapsed, blockType } = this.props;
		const toggleListLabel = collapsed
			? translation.logic.expandTypeList.getTrans()
			: translation.logic.collapseTypeList.getTrans();
		const toggleDisableLabel = this.props.getToggleDisableListLabel?.() ?? translation.state.enableDisableList.getTrans();
		const addLabel = translation.logic.add[blockType].getTrans();

		return (
			<ContextMenuPortal
				open
				anchorX={ctx.x}
				anchorY={ctx.y}
				width={220}
				className="dropdown-menu show"
				onClose={this.closeContextMenu}
			>
				<button
					type="button"
					className="dropdown-item"
					onClick={this.toggleSectionCollapsed}
				>
					{toggleListLabel} (C)
				</button>
				<button
					type="button"
					className="dropdown-item"
					onClick={() => this.runMenuAction(this.props.onSelectAllList)}
				>
					{translation.list.selectAllList.getTrans()}
				</button>
				{this.props.onAdd && (
					<button
						type="button"
						className="dropdown-item"
						onClick={this.handleAdd}
					>
						{addLabel} (N)
					</button>
				)}
				<button
					type="button"
					className="dropdown-item"
					onClick={() => this.runMenuAction(this.props.onCopyList)}
				>
					{translation.list.copyList.getTrans()} (Ctrl+C)
				</button>
				<button
					type="button"
					className="dropdown-item"
					onClick={() => this.runMenuAction(this.props.onCutList)}
				>
					{translation.list.cutList.getTrans()} (Ctrl+X)
				</button>
				<button
					type="button"
					className="dropdown-item"
					onClick={() => this.runMenuAction(this.props.onPasteList)}
				>
					{translation.list.pasteHere.getTrans()} (Ctrl+V)
				</button>
				<button
					type="button"
					className="dropdown-item"
					onClick={() => this.runMenuAction(this.props.onToggleDisableList)}
				>
					{toggleDisableLabel} (A)
				</button>
				<button
					type="button"
					className="dropdown-item text-danger"
					onClick={() => this.runMenuAction(this.props.onRemoveList)}
				>
					{translation.list.removeList.getTrans()} (R)
				</button>
			</ContextMenuPortal>
		);
	}

	render() {
		const { title, blockType, collapsed, onToggle, children, count, onAdd, addLabel, eventId, onEditListAsJson } = this.props;
		const sectionName = translation.logic.blocks[blockType].getTrans();
		const toggleTitle = translation.logic.toggleSectionBlock.getTrans().replace('{type}', sectionName);
		return (
			<div
				className="card cgenh-event-section"
				data-event-id={eventId}
				data-block-type={blockType}
			>
				<div
					className="card-header cgenh-event-section__header ps-2 pe-2"
					onContextMenu={this.handleHeaderContextMenu}
				>
					<div className="cgenh-event-section__meta">
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary"
							onClick={this.toggleSectionCollapsed}
							title={toggleTitle}
							onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
						>
							{collapsed ? <SvgChevronRight aria-hidden="true" /> : <SvgChevronDown aria-hidden="true" />}
						</button>
						<h3 className="h6 mb-0 text-truncate">{title}</h3>
					</div>
					<span
						className="cgenh-event-section__count badge rounded-pill"
						title={`${count} ${translation.logic.blocks[blockType].getTrans()}`}
					>
						{count}
					</span>
					{(onAdd || onEditListAsJson) && (
						<div className="cgenh-event-section__add d-flex align-items-center justify-content-end gap-1">
							{onEditListAsJson && (
								<button
									type="button"
									className="btn btn-sm btn-outline-secondary"
									onClick={this.handleEditListAsJson}
									title={translation.editor.editAsJson.getTrans()}
									aria-label={translation.editor.editAsJson.getTrans()}
									onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
								>
									<SvgCodeBrackets aria-hidden="true" />
								</button>
							)}
							{onAdd && (
								<button
									type="button"
									className="btn btn-sm btn-outline-secondary"
									onClick={this.handleAdd}
									title={addLabel || translation.common.add.getTrans()}
									onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
								>
									<SvgPlusStroke aria-hidden="true" />
								</button>
							)}
						</div>
					)}
				</div>
				{collapsed ? null : <div className="card-body p-2">{children}</div>}
				{this.renderContextMenu()}
			</div>
		);
	}
}

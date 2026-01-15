import React from 'react';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { translation } from '../../../trans/Trans';
import { ContextMenuPortal } from './ContextMenuPortal';
import type { SelectedItem } from './SelectionState';

export type ContextMenuState =
	| {
		mode: 'section';
		x: number;
		y: number;
		targetEventId?: string;
		blockType?: EventBlockType;
	}
	| {
		mode: 'item';
		x: number;
		y: number;
		index: number;
		targetEventId?: string;
		targetIndex?: string;
		blockType?: EventBlockType;
	};

interface LogicItemsListContextMenuProps {
	ctx: ContextMenuState;
	blockType: EventBlockType;
	itemsLength: number;
	sectionCollapsed: boolean;
	canPaste: boolean;
	menuSelection: SelectedItem[];
	toggleDisableListLabel: string;
	toggleDisableItemLabel: string;
	onClose(): void;
	onToggleSectionCollapsed(): void;
	onSelectAllListItems(): void;
	onRequestAddAt(targetIndex: number): void;
	onDuplicateAt(index: number): void;
	onCopyEntries(entries: SelectedItem[], options?: { removeAfterCopy?: boolean }): void;
	onPasteAt(targetIndex: number): void;
	onToggleDisabledForEntries(entries: SelectedItem[]): void;
	onRemoveEntries(entries: SelectedItem[]): void;
	onEdit(index: number): void;
	onMoveSelectionToTop(index: number): void;
	onMoveSelectionToBottom(index: number): void;
}

export class LogicItemsListContextMenu extends React.PureComponent<LogicItemsListContextMenuProps> {
	render() {
		const { ctx, blockType, itemsLength } = this.props;
		const menuSelection = this.props.menuSelection;
		const hasMenuSelection = menuSelection.length > 0;
		const MENU_WIDTH = 220;
		const addLabel = translation.logic.add[blockType].getTrans();
		const toggleListLabel = this.props.sectionCollapsed
			? translation.logic.expandTypeList.getTrans()
			: translation.logic.collapseTypeList.getTrans();

		if (ctx.mode === 'section') {
			return (
				<ContextMenuPortal
					open
					anchorX={ctx.x}
					anchorY={ctx.y}
					width={MENU_WIDTH}
					className="dropdown-menu show"
					onClose={this.props.onClose}
				>
					<button type="button" className="dropdown-item" onClick={this.props.onToggleSectionCollapsed}>
						{toggleListLabel} (C)
					</button>
					<button type="button" className="dropdown-item" onClick={this.props.onSelectAllListItems}>
						{translation.list.selectAllList.getTrans()}
					</button>
					<button type="button" className="dropdown-item" onClick={() => this.props.onRequestAddAt(itemsLength)}>
						{addLabel} (N)
					</button>
					<button
						type="button"
						className="dropdown-item"
						onClick={() => this.props.onCopyEntries(menuSelection)}
						disabled={!hasMenuSelection}
					>
						{translation.list.copyList.getTrans()} (Ctrl+C)
					</button>
					<button
						type="button"
						className="dropdown-item"
						onClick={() => this.props.onCopyEntries(menuSelection, { removeAfterCopy: true })}
						disabled={!hasMenuSelection}
					>
						{translation.list.cutList.getTrans()} (Ctrl+X)
					</button>
					<button
						type="button"
						className="dropdown-item"
						onClick={() => this.props.onPasteAt(itemsLength)}
						disabled={!this.props.canPaste}
					>
						{translation.list.pasteHere.getTrans()} (Ctrl+V)
					</button>
					<button
						type="button"
						className="dropdown-item"
						onClick={() => this.props.onToggleDisabledForEntries(menuSelection)}
						disabled={!hasMenuSelection}
					>
						{this.props.toggleDisableListLabel} (A)
					</button>
					<button
						type="button"
						className="dropdown-item text-danger"
						onClick={() => this.props.onRemoveEntries(menuSelection)}
						disabled={!hasMenuSelection}
					>
						{translation.list.removeList.getTrans()} (R)
					</button>
				</ContextMenuPortal>
			);
		}

		const hasCurrentItem = ctx.index >= 0 && ctx.index < itemsLength;
		return (
			<ContextMenuPortal
				open
				anchorX={ctx.x}
				anchorY={ctx.y}
				width={MENU_WIDTH}
				className="dropdown-menu show"
				onClose={this.props.onClose}
			>
				<button type="button" className="dropdown-item" onClick={this.props.onToggleSectionCollapsed}>
					{toggleListLabel} (C)
				</button>
				<button type="button" className="dropdown-item" onClick={this.props.onSelectAllListItems}>
					{translation.list.selectAllList.getTrans()}
				</button>
				<button type="button" className="dropdown-item" onClick={() => this.props.onRequestAddAt(ctx.index)}>
					{addLabel} (N)
				</button>
				{hasCurrentItem && (
					<button type="button" className="dropdown-item" onClick={() => this.props.onDuplicateAt(ctx.index)}>
						{translation.common.duplicate.getTrans()} (D)
					</button>
				)}
				{hasCurrentItem && (
					<button type="button" className="dropdown-item" onClick={() => this.props.onCopyEntries(menuSelection)}>
						{translation.common.copy.getTrans()} (Ctrl+C)
					</button>
				)}
				{hasCurrentItem && (
					<button
						type="button"
						className="dropdown-item"
						onClick={() => this.props.onCopyEntries(menuSelection, { removeAfterCopy: true })}
					>
						{translation.common.cut.getTrans()} (Ctrl+X)
					</button>
				)}
				<button
					type="button"
					className="dropdown-item"
					onClick={() => this.props.onPasteAt(ctx.index + 1)}
					disabled={!this.props.canPaste}
				>
					{translation.list.pasteHere.getTrans()} (Ctrl+V)
				</button>
				<button type="button" className="dropdown-item" onClick={() => this.props.onEdit(ctx.index)}>
					{translation.common.edit.getTrans()} (E)
				</button>
				<button type="button" className="dropdown-item" onClick={() => this.props.onMoveSelectionToTop(ctx.index)}>
					{translation.list.moveToTop.getTrans()} (T)
				</button>
				<button type="button" className="dropdown-item" onClick={() => this.props.onMoveSelectionToBottom(ctx.index)}>
					{translation.list.moveToBottom.getTrans()} (B)
				</button>
				<button type="button" className="dropdown-item" onClick={() => this.props.onToggleDisabledForEntries(menuSelection)}>
					{this.props.toggleDisableItemLabel} (A)
				</button>
				<button type="button" className="dropdown-item text-danger" onClick={() => this.props.onRemoveEntries(menuSelection)}>
					{translation.common.remove.getTrans()} (R)
				</button>
			</ContextMenuPortal>
		);
	}
}


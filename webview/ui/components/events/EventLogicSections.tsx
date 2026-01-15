import { ICgEvent } from '@shared';
import React from 'react';
import { ebtConv, EventBlockType, eventBlockTypes } from '../../../editor/eventBlockTypes';
import { translation } from '../../../trans/Trans';
import { LogicItemsList } from './LogicItemsList';
import {
	copyEntriesToClipboard,
	getLogicMenuEntriesForSection,
	getToggleDisableLabel,
	pasteAt,
	removeLogicEntries,
	selectAllListItems,
	toggleDisabledForEntries,
} from './LogicItemsListMenuActions';
import { LogicSection } from './LogicSection';

interface EventLogicSectionsProps {
	event: ICgEvent;
	schemaVersion: number;
	blockCollapsed: Record<EventBlockType, boolean>;
	logicListRefs: Record<EventBlockType, React.RefObject<LogicItemsList>>;
	onToggleSection(blockType: EventBlockType): void;
	onOpenAdd(blockType: EventBlockType, insertIndex?: number): void;
	onEditListAsJson(blockType: EventBlockType): void;
}

export class EventLogicSections extends React.PureComponent<EventLogicSectionsProps> {
	render() {
		const blocks = eventBlockTypes.map((blockType) => ({
			type: blockType,
			items: this.props.event[ebtConv.COMPLEX[blockType]] ?? [],
		}));

		return (
			<div className="card-body cgenh-event-card__body">
				<div className="d-flex flex-column gap-2 cgenh-event-card__sections">
					{blocks.map((block) => {
						const listRef = this.props.logicListRefs[block.type];
						const collapsed = this.props.blockCollapsed[block.type];

						return (
							<LogicSection
								key={block.type}
								blockType={block.type}
								eventId={this.props.event.id}
								title={translation.logic.blocks[block.type].getTrans()}
								count={block.items.length}
								collapsed={collapsed}
								onToggle={this.props.onToggleSection}
								addLabel={translation.logic.add[block.type].getTrans()}
								onAdd={() => this.props.onOpenAdd(block.type)}
								onEditListAsJson={() => this.props.onEditListAsJson(block.type)}
								onCopyList={() => {
									const list = listRef.current;
									if (list) {
										list.copyFromListMenu();
										return;
									}
									const entries = getLogicMenuEntriesForSection(this.props.event.id, block.type);
									void copyEntriesToClipboard(block.type, entries);
								}}
								onCutList={() => {
									const list = listRef.current;
									if (list) {
										list.cutFromListMenu();
										return;
									}
									const entries = getLogicMenuEntriesForSection(this.props.event.id, block.type);
									void copyEntriesToClipboard(block.type, entries, { removeAfterCopy: true });
								}}
								onPasteList={() => {
									const list = listRef.current;
									if (list) {
										list.pasteFromListMenu();
										return;
									}
									void pasteAt(this.props.event.id, block.type, block.items.length);
								}}
								onToggleDisableList={() => {
									const list = listRef.current;
									if (list) {
										list.toggleDisableFromListMenu();
										return;
									}
									const entries = getLogicMenuEntriesForSection(this.props.event.id, block.type);
									toggleDisabledForEntries(block.type, entries);
								}}
								getToggleDisableListLabel={() => {
									const list = listRef.current;
									if (list) {
										return list.getToggleDisableListLabel();
									}
									const entries = getLogicMenuEntriesForSection(this.props.event.id, block.type);
									return getToggleDisableLabel(entries, true);
								}}
								onRemoveList={() => {
									const list = listRef.current;
									if (list) {
										list.removeFromListMenu();
										return;
									}
									const entries = getLogicMenuEntriesForSection(this.props.event.id, block.type);
									removeLogicEntries(block.type, entries);
								}}
								onSelectAllList={() => {
									const list = listRef.current;
									if (list) {
										list.selectAllListItems();
										return;
									}
									selectAllListItems(this.props.event.id, block.type);
								}}
							>
								<LogicItemsList
									ref={listRef}
									eventId={this.props.event.id}
									blockType={block.type}
									schemaVersion={this.props.schemaVersion}
									sectionCollapsed={collapsed}
									onToggleSectionCollapsed={() => this.props.onToggleSection(block.type)}
									onRequestAddAt={(targetIndex) => this.props.onOpenAdd(block.type, targetIndex)}
								/>
							</LogicSection>
						);
					})}
				</div>
			</div>
		);
	}
}

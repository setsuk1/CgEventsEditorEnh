import { ICgEventLogicBlock } from '@shared';
import React from 'react';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import type { LoopIndicatorState } from './LogicItemsListCheckMeta';
import { LogicEntryComponent } from './LogicEntryComponent';
import { LogicRowControls } from './LogicRowControls';

interface LogicItemsListEntryProps {
	item: ICgEventLogicBlock;
	eventId: string;
	blockType: EventBlockType;
	index: number;
	disabled: boolean;
	schemaVersion?: number;
	openDetailNonce?: number;
	isFirst?: boolean;
	isLast?: boolean;
	loopIndicator?: LoopIndicatorState;
	onOpenMenu(index: number): void;
	onEdit(index: number): void;
}

export class LogicItemsListEntry extends React.PureComponent<LogicItemsListEntryProps> {
	render() {
		const {
			eventId,
			blockType,
			index,
			disabled,
			openDetailNonce,
			isFirst,
			isLast,
			loopIndicator,
			schemaVersion,
		} = this.props;

		const controls = (
			<LogicRowControls
				eventId={eventId}
				blockType={blockType}
				index={index}
				disabled={disabled}
				onOpenMenu={this.props.onOpenMenu}
				onEdit={this.props.onEdit}
				showLoopIcon={loopIndicator?.isLoop}
				showLoopSigma={loopIndicator?.showSigma}
				isFirst={isFirst}
				isLast={isLast}
			/>
		);

		return (
			<LogicEntryComponent
				controls={controls}
				openDetailNonce={openDetailNonce}
				eventId={eventId}
				blockType={blockType}
				index={index}
				schemaVersion={schemaVersion}
			/>
		);
	}
}

import React from 'react';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { LogicCard } from './LogicCard';

export interface LogicEntryComponentProps {
	controls?: React.ReactNode;
	eventId: string;
	blockType: EventBlockType;
	index: number;
	openDetailNonce?: number;
	schemaVersion?: number;
}

export class LogicEntryComponent extends React.PureComponent<LogicEntryComponentProps> {
	render() {
		const { controls, openDetailNonce, eventId, blockType, index, schemaVersion } = this.props;
		return (
			<LogicCard
				controls={controls}
				showEditButton={!controls}
				eventId={eventId}
				blockType={blockType}
				logicIndex={index}
				openDetailNonce={openDetailNonce}
				schemaVersion={schemaVersion}
			/>
		);
	}
}

import { ICgEventLogicBlock } from '@shared';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { EventEmitter } from '../../../utils/EventEmitter';

export interface DraggedItem {
	eventId: string;
	blockType: EventBlockType;
	index: number;
	block: ICgEventLogicBlock;
}

export interface DragState {
	isDragging: boolean;
	eventId: string | null;
	blockType: EventBlockType | null;
	draggedItems: DraggedItem[];
}

class DragStateManager extends EventEmitter {
	private state: DragState = {
		isDragging: false,
		eventId: null,
		blockType: null,
		draggedItems: [],
	};

	startDrag(eventId: string, blockType: EventBlockType, draggedItems: DraggedItem[]): void {
		this.state = {
			isDragging: true,
			eventId,
			blockType,
			draggedItems,
		};
		this.emit('change', this.state);
	}

	endDrag(): void {
		if (!this.state.isDragging) return;
		this.state = {
			isDragging: false,
			eventId: null,
			blockType: null,
			draggedItems: [],
		};
		this.emit('change', this.state);
	}

	getState(): Readonly<DragState> {
		return this.state;
	}

	isDraggingFrom(eventId: string, blockType: EventBlockType): boolean {
		return this.state.isDragging && this.state.eventId === eventId && this.state.blockType === blockType;
	}

	canDropTo(blockType: EventBlockType): boolean {
		return this.state.isDragging && this.state.blockType === blockType;
	}
}

export const dragStateManager = new DragStateManager();

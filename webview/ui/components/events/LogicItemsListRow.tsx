import { ICgEventLogicBlock } from '@shared';
import React from 'react';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { translation } from '../../../trans/Trans';
import { SvgIndentLeft } from '../../svg/SvgIndentLeft';
import { SvgIndentRight } from '../../svg/SvgIndentRight';
import type { LoopIndicatorState } from './LogicItemsListCheckMeta';
import { LogicItemsListEntry } from './LogicItemsListEntry';

const CHECK_INDENT_PX = 24;
const CHECK_RAIL_BASE_PX = 40;

interface CommonLogicItemsListRowProps {
	eventId: string;
	blockType: EventBlockType;
	index: number;
	item: ICgEventLogicBlock;
	schemaVersion?: number;
	openDetailNonce?: number;
	isFirst: boolean;
	isLast: boolean;
	disabled: boolean;
	isSelected: boolean;
	selectedPrev: boolean;
	selectedNext: boolean;
	isDraggedItem: boolean;
	showDropIndicator: boolean;
	indicatorBorderClass: string;
	rowRef: React.RefObject<HTMLDivElement>;
	onContextMenu(index: number, event: React.MouseEvent): void;
	onMouseDown(index: number, event: React.MouseEvent): void;
	onMouseUp(index: number, event: React.MouseEvent): void;
	onMouseLeave(index: number): void;
	onOpenMenu(index: number): void;
	onEdit(index: number): void;
}

interface NonCheckLogicItemsListRowProps extends CommonLogicItemsListRowProps {
	isCheckSection: false;
}

interface CheckLogicItemsListRowProps extends CommonLogicItemsListRowProps {
	isCheckSection: true;
	hasHierarchy: boolean;
	level: number;
	breaks: number;
	loopDisabled: boolean;
	loopIndicator: LoopIndicatorState;
	joinTop: boolean;
	joinBottom: boolean;
	currentElseEventId?: string;
	andLineLevels: number[];
	andStart: boolean;
	andEnd: boolean;
	showOr: boolean;
	hasNot: boolean;
	getCheckRailClass(width: number): string;
	getAndLineClass(offset: number): string;
	onIndentLeft(index: number): void;
	onIndentRight(index: number, currentBreaks: number): void;
	onJumpToEvent(eventId: string): void;
}

export type LogicItemsListRowProps = NonCheckLogicItemsListRowProps | CheckLogicItemsListRowProps;

export class LogicItemsListRow extends React.PureComponent<LogicItemsListRowProps> {
	private handleContextMenu = (event: React.MouseEvent) => {
		this.props.onContextMenu(this.props.index, event);
	};

	private handleMouseDown = (event: React.MouseEvent) => {
		this.props.onMouseDown(this.props.index, event);
	};

	private handleMouseUp = (event: React.MouseEvent) => {
		this.props.onMouseUp(this.props.index, event);
	};

	private handleMouseLeave = () => {
		this.props.onMouseLeave(this.props.index);
	};

	private handleJumpToEvent = (event: React.MouseEvent, eventId: string) => {
		event.preventDefault();
		event.stopPropagation();
		if (!this.props.isCheckSection) return;
		this.props.onJumpToEvent(eventId);
	};

	private handleIndentLeft = () => {
		if (!this.props.isCheckSection) return;
		this.props.onIndentLeft(this.props.index);
	};

	private handleIndentRight = () => {
		if (!this.props.isCheckSection) return;
		this.props.onIndentRight(this.props.index, this.props.breaks);
	};

	render() {
		const { eventId, blockType, index, disabled, openDetailNonce, isFirst, isLast } = this.props;
		const logicCard = (
			<LogicItemsListEntry
				item={this.props.item}
				eventId={eventId}
				blockType={blockType}
				index={index}
				disabled={disabled}
				schemaVersion={this.props.schemaVersion}
				openDetailNonce={openDetailNonce}
				isFirst={isFirst}
				isLast={isLast}
				loopIndicator={this.props.isCheckSection ? this.props.loopIndicator : undefined}
				onOpenMenu={this.props.onOpenMenu}
				onEdit={this.props.onEdit}
			/>
		);

		const dropIndicator = (
			<div className={`border-top border-3 ${this.props.indicatorBorderClass} my-2`} />
		);

		let rowContent: React.ReactNode = logicCard;
		const rowProps = this.props;
		if (rowProps.isCheckSection) {
			const railSize = CHECK_RAIL_BASE_PX + rowProps.level * CHECK_INDENT_PX;
			const railClassName = ['cgenh-check-rail', rowProps.getCheckRailClass(railSize)].join(' ');
			const canIndentLeft = rowProps.level > 0;
			const canIndentRight = rowProps.breaks > 0;
			const showIndentLeft = rowProps.hasHierarchy && canIndentLeft;
			const showIndentRight = rowProps.hasHierarchy && canIndentRight;
			const hasIndentButtons = showIndentLeft || showIndentRight;

			const indentButtons = hasIndentButtons ? (
				<div className="cgenh-check-rail__controls">
					<div
						className="btn-group btn-group-sm cgenh-card-actions cgenh-check-rail__control-group flex-shrink-0"
						role="group"
						aria-label={translation.logic.actionsLabel.getTrans()}
					>
						{showIndentLeft && (
							<button
								type="button"
								className="btn cgenh-action-btn cgenh-action-btn--move"
								onClick={this.handleIndentLeft}
								onMouseEnter={playMouseHoverAudio}
								onMouseDown={playMouseDownAudio}
								title={translation.list.moveLeft.getTrans()}
								aria-label={translation.list.moveLeft.getTrans()}
							>
								<SvgIndentLeft aria-hidden="true" />
							</button>
						)}
						{showIndentRight && (
							<button
								type="button"
								className="btn cgenh-action-btn cgenh-action-btn--move"
								onClick={this.handleIndentRight}
								onMouseEnter={playMouseHoverAudio}
								onMouseDown={playMouseDownAudio}
								title={translation.list.moveRight.getTrans()}
								aria-label={translation.list.moveRight.getTrans()}
							>
								<SvgIndentRight aria-hidden="true" />
							</button>
						)}
					</div>
				</div>
			) : null;

			const checkCardClassName = rowProps.loopDisabled
				? 'cgenh-check-card cgenh-check-card--loop-disabled'
				: 'cgenh-check-card';
			const checkBodyClassName = [
				'cgenh-check-body',
				rowProps.isSelected ? 'border border-2 border-primary cgenh-logic-row--selected' : '',
				rowProps.joinTop ? 'border-top-0 cgenh-logic-row--selected-join-top' : '',
				rowProps.joinBottom ? 'border-bottom-0 cgenh-logic-row--selected-join-bottom' : '',
			].filter(Boolean).join(' ');

			const showAndLines = rowProps.andLineLevels.length > 0;
			const showLogicMarker = showAndLines || rowProps.showOr || rowProps.hasNot;
			const andLines = showAndLines ? (
				<div className="cgenh-check-rail__and-lines" aria-hidden="true">
					{rowProps.andLineLevels.map((lineLevel) => {
						const offset = rowProps.level > lineLevel ? (rowProps.level - lineLevel) * CHECK_INDENT_PX : 0;
						const lineClassName = [
							'cgenh-check-rail__and-line',
							lineLevel === rowProps.level && rowProps.andStart ? 'cgenh-check-rail__and--start' : '',
							lineLevel === rowProps.level && rowProps.andEnd ? 'cgenh-check-rail__and--end' : '',
						].filter(Boolean).join(' ');
						const showTailStart = lineLevel === rowProps.level && rowProps.andStart;
						const showTailEnd = lineLevel === rowProps.level && rowProps.andEnd;
						return (
							<span
								key={`and-${index}-${lineLevel}`}
								className={[lineClassName, rowProps.getAndLineClass(offset)].join(' ')}
							>
								{showTailStart && <span className="cgenh-check-rail__and-tail cgenh-check-rail__and-tail--start" />}
								{showTailEnd && <span className="cgenh-check-rail__and-tail cgenh-check-rail__and-tail--end" />}
							</span>
						);
					})}
				</div>
			) : null;

			const elseAndLineLevels = showAndLines
				? (rowProps.andEnd
					? rowProps.andLineLevels.filter((lineLevel) => lineLevel !== rowProps.level)
					: rowProps.andLineLevels)
				: [];

			const elseAndLines = elseAndLineLevels.length > 0 ? (
				<div className="cgenh-check-rail__and-lines" aria-hidden="true">
					{elseAndLineLevels.map((lineLevel) => {
						const offset = rowProps.level > lineLevel ? (rowProps.level - lineLevel) * CHECK_INDENT_PX : 0;
						return (
							<span
								key={`and-else-${index}-${lineLevel}`}
								className={['cgenh-check-rail__and-line', rowProps.getAndLineClass(offset)].join(' ')}
							/>
						);
					})}
				</div>
			) : null;

			const logicMarker = showLogicMarker ? (
				<>
					{andLines}
					{(rowProps.showOr || rowProps.hasNot) && (
						<div className="cgenh-check-rail__stack" aria-hidden="true">
							{rowProps.showOr && (
								<span className="cgenh-check-rail__or">
									<span>O</span>
									<span>R</span>
								</span>
							)}
							{rowProps.hasNot && <span className="cgenh-check-rail__not">!</span>}
						</div>
					)}
				</>
			) : null;

			const mainRow = (
				<div className="d-flex align-items-stretch gap-0">
					<div className={railClassName}>
						{logicMarker}
					</div>
					<div className="d-flex flex-column flex-grow-1 min-w-0 cgenh-check-column">
						<div className={checkBodyClassName}>
							{indentButtons}
							<div className={checkCardClassName}>
								{logicCard}
							</div>
						</div>
					</div>
				</div>
			);

			const elseRail = elseAndLines ? (
				<div className={railClassName} aria-hidden="true">
					{elseAndLines}
				</div>
			) : (
				<div
					className={['cgenh-check-rail', 'cgenh-check-rail--spacer', rowProps.getCheckRailClass(railSize)].join(' ')}
					aria-hidden="true"
				/>
			);

			const elseRow = rowProps.currentElseEventId ? (
				<div className="d-flex align-items-center gap-2 cgenh-else-row">
					{elseRail}
					<div className="d-flex align-items-center gap-2 ps-3 pb-1">
						<span className="badge text-bg-warning cgenh-else-badge">
							{translation.logic.elseTrigger.getTrans()}
						</span>
						<button
							type="button"
							className="btn btn-sm px-1 py-1 btn-outline-warning cgenh-else-link"
							onClick={(event) => this.handleJumpToEvent(event, rowProps.currentElseEventId ?? '')}
							onMouseEnter={playMouseHoverAudio}
							onMouseDown={playMouseDownAudio}
						>
							{rowProps.currentElseEventId}
						</button>
					</div>
				</div>
			) : null;

			rowContent = (
				<>
					{mainRow}
					{elseRow}
				</>
			);
		}

		const rowClassName = [
			'cgenh-logic-row',
			disabled ? 'cgenh-logic-row--disabled' : '',
			this.props.isCheckSection ? 'p-0' : 'p-1',
			'rounded',
			this.props.isCheckSection ? 'd-flex flex-column' : '',
			!this.props.isCheckSection && this.props.isSelected ? 'border border-2 border-primary cgenh-logic-row--selected' : '',
			!this.props.isCheckSection && this.props.selectedPrev ? 'border-top-0 cgenh-logic-row--selected-join-top' : '',
			!this.props.isCheckSection && this.props.selectedNext ? 'cgenh-logic-row--selected-join-bottom' : '',
			this.props.isDraggedItem ? 'opacity-50' : '',
		].filter(Boolean).join(' ');

		return (
			<div className="d-flex flex-column">
				{this.props.showDropIndicator && dropIndicator}
				<div
					className={rowClassName}
					data-logic-index={index}
					onContextMenu={this.handleContextMenu}
					onMouseDown={this.handleMouseDown}
					onMouseUp={this.handleMouseUp}
					onMouseLeave={this.handleMouseLeave}
					ref={this.props.rowRef}
				>
					{rowContent}
				</div>
			</div>
		);
	}
}

import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SvgCircleCheck } from '../../svg/SvgCircleCheck';
import { SvgCircleSlash } from '../../svg/SvgCircleSlash';
import { SvgEdit } from '../../svg/SvgEdit';
import { SvgLoopIndicator } from '../../svg/SvgLoopIndicator';
import { SvgMoreVertical } from '../../svg/SvgMoreVertical';
import { SvgMoveDownTriangle } from '../../svg/SvgMoveDownTriangle';
import { SvgMoveUpTriangle } from '../../svg/SvgMoveUpTriangle';
import { SvgTrashOutline } from '../../svg/SvgTrashOutline';

export interface LogicRowControlsProps {
	eventId: string;
	blockType: EventBlockType;
	index: number;
	disabled?: boolean;
	onOpenMenu?(index: number): void;
	onEdit?(index: number): void;
	showLoopIcon?: boolean;
	showLoopSigma?: boolean;
	isFirst?: boolean;
	isLast?: boolean;
}

export class LogicRowControls extends React.PureComponent<LogicRowControlsProps, {}> {
	private groupElement: HTMLDivElement | null = null;
	private headerElement: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resizeFallbackAttached = false;
	private compactUpdateFrame: number | null = null;

	componentDidMount() {
		this.syncHeaderElement();
		this.observeHeader();
		this.scheduleCompactUpdate();
	}

	componentDidUpdate() {
		this.syncHeaderElement();
		this.observeHeader();
		this.scheduleCompactUpdate();
	}

	componentWillUnmount() {
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

	private setGroupRef = (element: HTMLDivElement | null) => {
		this.groupElement = element;
	};

	private syncHeaderElement() {
		this.headerElement = this.groupElement?.closest<HTMLElement>('.cgenh-logic-card__header') ?? null;
	}

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

		const maxLevel = 5;
		const titleElement = header.querySelector('.cgenh-logic-card__title');
		const subtitleElement = header.querySelector('.cgenh-logic-card__subtitle');
		const title = titleElement instanceof HTMLElement ? titleElement : null;
		const subtitle = subtitleElement instanceof HTMLElement ? subtitleElement : null;
		const isOverflowing = () => header.scrollWidth > header.clientWidth + 1;
		const isTruncated = (element: HTMLElement | null) => element ? element.scrollWidth > element.clientWidth + 1 : false;
		const needsCompaction = () => isOverflowing() || isTruncated(title) || isTruncated(subtitle);
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

	render() {
		const {
			eventId,
			blockType,
			index,
			disabled,
			onOpenMenu,
			onEdit,
			showLoopIcon,
			showLoopSigma,
			isFirst,
			isLast
		} =
			this.props;
		const showLoopIndicator = Boolean(showLoopIcon) || Boolean(showLoopSigma);
		return (
			<div ref={this.setGroupRef} className="btn-group btn-group-sm cgenh-card-actions flex-shrink-0" role="group" aria-label={translation.logic.actionsLabel.getTrans()}>
				{showLoopIndicator && (
					<span className="cgenh-loop-indicator" aria-hidden="true">
						{showLoopSigma && <span className="cgenh-loop-indicator__sigma">Σ</span>}
						{showLoopIcon && (
							<SvgLoopIndicator className="cgenh-loop-indicator__icon" aria-hidden="true" />
						)}
					</span>
				)}
				{onEdit && (
					<button
						type="button"
						className="btn cgenh-action-btn cgenh-action-btn--edit"
						onClick={() => onEdit(index)}
						title={translation.common.edit.getTrans()}
						aria-label={translation.common.edit.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
					>
						<SvgEdit aria-hidden="true" />
					</button>
				)}
				<button
					type="button"
					className="btn cgenh-action-btn cgenh-action-btn--toggle"
					onClick={() => editor.toggleLogicDisabled(eventId, blockType, index)}
					onDoubleClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					aria-pressed={Boolean(disabled)}
					title={disabled ? translation.state.enable.getTrans() : translation.state.disable.getTrans()}
					aria-label={disabled ? translation.state.enable.getTrans() : translation.state.disable.getTrans()}
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
					className="btn cgenh-action-btn cgenh-action-btn--danger"
					onClick={() => editor.removeLogic(eventId, blockType, index)}
					title={translation.common.remove.getTrans()}
					aria-label={translation.common.remove.getTrans()}
					onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
				>
					<SvgTrashOutline aria-hidden="true" />
				</button>
				<button
					type="button"
					className="btn cgenh-action-btn cgenh-action-btn--move"
					onClick={() => editor.moveLogic(eventId, blockType, index, -1)}
					title={translation.list.moveUp.getTrans()}
					aria-label={translation.list.moveUp.getTrans()}
					disabled={isFirst}
					onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
				>
					<SvgMoveUpTriangle aria-hidden="true" />
				</button>
				<button
					type="button"
					className="btn cgenh-action-btn cgenh-action-btn--move"
					onClick={() => editor.moveLogic(eventId, blockType, index, 1)}
					title={translation.list.moveDown.getTrans()}
					aria-label={translation.list.moveDown.getTrans()}
					disabled={isLast}
					onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
				>
					<SvgMoveDownTriangle aria-hidden="true" />
				</button>
				{onOpenMenu && (
					<button
						type="button"
						className="btn cgenh-action-btn cgenh-action-btn--more"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onOpenMenu(index);
						}}
						title={translation.common.moreActions.getTrans()}
						aria-label={translation.common.moreActions.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={playMouseDownAudio}
					>
						<SvgMoreVertical aria-hidden="true" />
					</button>
				)}
			</div>
		);
	}
}

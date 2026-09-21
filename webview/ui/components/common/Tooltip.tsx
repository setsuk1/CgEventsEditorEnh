import React from 'react';
import { createPortal } from 'react-dom';
import { CAPTURED_SCROLL_EVENT, winEE } from '../../../msg/WindowEventEmitter';
import { clampViewportCoordinate } from '../../utils/viewportPosition';

interface TooltipProps {
	content: string;
	children: React.ReactNode;
}

interface TooltipState {
	hovered: boolean;
	focused: boolean;
}

export class Tooltip extends React.PureComponent<TooltipProps, TooltipState> {
	private targetRef = React.createRef<HTMLDivElement>();

	state: TooltipState = { hovered: false, focused: false };

	private setVisibilitySource(source: 'hover' | 'focus', active: boolean): void {
		this.setState((previous) => {
			if (source === 'hover') {
				return previous.hovered === active ? null : { ...previous, hovered: active };
			}
			return previous.focused === active ? null : { ...previous, focused: active };
		});
	}

	private handleMouseEnter = () => this.setVisibilitySource('hover', true);
	private handleMouseLeave = () => this.setVisibilitySource('hover', false);
	private handleFocus = () => this.setVisibilitySource('focus', true);
	private handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
		this.setVisibilitySource('focus', false);
	};

	render() {
		return (
			<>
				<div
					ref={this.targetRef}
					onMouseEnter={this.handleMouseEnter}
					onMouseLeave={this.handleMouseLeave}
					onFocus={this.handleFocus}
					onBlur={this.handleBlur}
					className="cgenh-tooltip-target"
				>
					{this.props.children}
				</div>
				{(this.state.hovered || this.state.focused) && <TooltipPortal content={this.props.content} targetRef={this.targetRef} />}
			</>
		);
	}
}

interface TooltipPortalProps {
	content: string;
	targetRef: React.RefObject<HTMLDivElement>;
}

class TooltipPortal extends React.PureComponent<TooltipPortalProps> {
	private tooltipRef = React.createRef<HTMLDivElement>();
	private rafId: number | null = null;
	private topVar = '';
	private leftVar = '';
	private opacityVar = '';

	componentDidMount(): void {
		this.updateOpacityVar('0');
		winEE.on('resize', this.schedulePositionUpdate);
		winEE.on(CAPTURED_SCROLL_EVENT, this.schedulePositionUpdate);
		this.schedulePositionUpdate();
	}

	componentDidUpdate(prevProps: TooltipPortalProps): void {
		if (prevProps.content !== this.props.content || prevProps.targetRef !== this.props.targetRef) {
			this.schedulePositionUpdate();
		}
	}

	componentWillUnmount(): void {
		winEE.off('resize', this.schedulePositionUpdate);
		winEE.off(CAPTURED_SCROLL_EVENT, this.schedulePositionUpdate);
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	private schedulePositionUpdate = () => {
		if (this.rafId !== null) return;
		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			this.updatePosition();
		});
	};

	private updatePosition() {
		const target = this.props.targetRef.current;
		const tooltip = this.tooltipRef.current;
		if (!target || !tooltip) return;

		const targetRect = target.getBoundingClientRect();
		const tooltipRect = tooltip.getBoundingClientRect();
		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;
		const gap = 6;
		let top = targetRect.top - tooltipRect.height - gap;
		let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;

		if (top < 0) top = targetRect.bottom + gap;
		const padding = 8;
		left = clampViewportCoordinate(left, tooltipRect.width, padding, viewportW);
		top = clampViewportCoordinate(top, tooltipRect.height, padding, viewportH);

		this.updatePositionVars(`${top}px`, `${left}px`);
		this.updateOpacityVar('1');
	}

	private updatePositionVars(top: string, left: string) {
		const tooltip = this.tooltipRef.current;
		if (!tooltip) return;
		if (this.topVar !== top) {
			this.topVar = top;
			tooltip.style.setProperty('--cgenh-tooltip-top', top);
		}
		if (this.leftVar !== left) {
			this.leftVar = left;
			tooltip.style.setProperty('--cgenh-tooltip-left', left);
		}
	}

	private updateOpacityVar(value: string) {
		if (this.opacityVar === value) return;
		const tooltip = this.tooltipRef.current;
		if (!tooltip) return;
		this.opacityVar = value;
		tooltip.style.setProperty('--cgenh-tooltip-opacity', value);
	}

	render() {
		return createPortal(
			<div className="tooltip bs-tooltip-auto show cgenh-tooltip" ref={this.tooltipRef} role="tooltip">
				<div className="tooltip-inner">{this.props.content}</div>
			</div>,
			document.body
		);
	}
}

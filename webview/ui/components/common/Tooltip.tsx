import React from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
	content: string;
	children: React.ReactNode;
}

interface TooltipState {
	visible: boolean;
}

export class Tooltip extends React.PureComponent<TooltipProps, TooltipState> {
	private targetRef = React.createRef<HTMLDivElement>();

	state: TooltipState = { visible: false };

	private show = () => {
		if (!this.state.visible) {
			this.setState({ visible: true });
		}
	};

	private hide = () => {
		if (this.state.visible) {
			this.setState({ visible: false });
		}
	};

	render() {
		return (
			<>
				<div
					ref={this.targetRef}
					onMouseEnter={this.show}
					onMouseLeave={this.hide}
					className="cgenh-tooltip-target"
				>
					{this.props.children}
				</div>
				{this.state.visible && (
					<TooltipPortal content={this.props.content} targetRef={this.targetRef} />
				)}
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
		this.schedulePositionUpdate();
	}

	componentDidUpdate(prevProps: TooltipPortalProps): void {
		if (
			prevProps.content !== this.props.content ||
			prevProps.targetRef !== this.props.targetRef
		) {
			this.schedulePositionUpdate();
		}
	}

	componentWillUnmount(): void {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	private schedulePositionUpdate() {
		if (this.rafId !== null) {
			return;
		}
		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			this.updatePosition();
		});
	}

	private updatePosition() {
		const target = this.props.targetRef.current;
		const tooltip = this.tooltipRef.current;
		if (!target || !tooltip) {
			return;
		}

		const targetRect = target.getBoundingClientRect();
		const tooltipRect = tooltip.getBoundingClientRect();
		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;

		const gap = 6;
		let top = targetRect.top - tooltipRect.height - gap;
		let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;

		if (top < 0) {
			top = targetRect.bottom + gap;
		}

		const padding = 8;
		if (left < padding) left = padding;
		if (left + tooltipRect.width > viewportW - padding) {
			left = viewportW - tooltipRect.width - padding;
		}

		if (top + tooltipRect.height > viewportH - padding) {
			top = Math.min(top, viewportH - tooltipRect.height - padding);
		}

		this.updatePositionVars(`${top}px`, `${left}px`);
		this.updateOpacityVar('1');
	}

	private updatePositionVars(top: string, left: string) {
		const tooltip = this.tooltipRef.current;
		if (!tooltip) {
			return;
		}
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
		if (this.opacityVar === value) {
			return;
		}
		const tooltip = this.tooltipRef.current;
		if (!tooltip) {
			return;
		}
		this.opacityVar = value;
		tooltip.style.setProperty('--cgenh-tooltip-opacity', value);
	}

	render() {
		const className = [
			'tooltip',
			'bs-tooltip-auto',
			'show',
			'cgenh-tooltip',
		].filter(Boolean).join(' ');
		return createPortal(
			<div className={className} ref={this.tooltipRef} role="tooltip">
				<div className="tooltip-inner">{this.props.content}</div>
			</div>,
			document.body
		);
	}
}

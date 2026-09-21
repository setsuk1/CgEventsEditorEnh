import React from 'react';
import { createPortal } from 'react-dom';
import { CAPTURED_SCROLL_EVENT, winEE } from '../../../msg/WindowEventEmitter';
import { DynamicStyle } from '../../utils/dynamicStyles';
import { computeContextMenuPosition } from './ContextMenuPosition';

interface ContextMenuPortalProps {
	open: boolean;
	anchorX: number;
	anchorY: number;
	width?: number;
	className?: string;
	children: React.ReactNode;
	onClose(): void;
}

interface ContextMenuPortalState {
	menuHeight: number;
	viewportWidth: number;
	viewportHeight: number;
}

export class ContextMenuPortal extends React.PureComponent<ContextMenuPortalProps, ContextMenuPortalState> {
	private menuRef = React.createRef<HTMLDivElement>();
	private positionStyle = new DynamicStyle('cgenh-context-menu');
	private cssText = '';
	private listenersAttached = false;

	state: ContextMenuPortalState = {
		menuHeight: 0,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight,
	};

	componentDidMount(): void {
		if (this.props.open) {
			this.attachListeners();
			this.updateMenuHeight();
			this.updatePositionCss();
		}
	}

	componentDidUpdate(prevProps: ContextMenuPortalProps): void {
		if (this.props.open && !prevProps.open) {
			this.attachListeners();
			this.updateMenuHeight();
		}
		if (!this.props.open && prevProps.open) {
			this.detachListeners();
		}
		if (this.props.open) {
			if (prevProps.children !== this.props.children || prevProps.width !== this.props.width) {
				this.updateMenuHeight();
			}
			this.updatePositionCss();
		}
	}

	componentWillUnmount(): void {
		this.detachListeners();
		this.positionStyle.dispose();
	}

	private attachListeners() {
		if (this.listenersAttached) return;
		this.listenersAttached = true;
		winEE.on('resize', this.handleResize);
		winEE.on('mousedown', this.handleMouseDown);
		winEE.on('blur', this.handleBlur);
		winEE.on(CAPTURED_SCROLL_EVENT, this.handleScroll);
	}

	private detachListeners() {
		if (!this.listenersAttached) return;
		this.listenersAttached = false;
		winEE.off('resize', this.handleResize);
		winEE.off('mousedown', this.handleMouseDown);
		winEE.off('blur', this.handleBlur);
		winEE.off(CAPTURED_SCROLL_EVENT, this.handleScroll);
	}

	private handleResize = () => {
		const nextWidth = window.innerWidth;
		const nextHeight = window.innerHeight;
		if (nextWidth === this.state.viewportWidth && nextHeight === this.state.viewportHeight) {
			return;
		}
		this.setState({ viewportWidth: nextWidth, viewportHeight: nextHeight });
	};

	private handleMouseDown = (event: MouseEvent) => {
		const menu = this.menuRef.current;
		if (!menu) {
			return;
		}
		if (event.target instanceof Node && menu.contains(event.target)) {
			return;
		}
		this.props.onClose();
	};

	private handleBlur = () => {
		this.props.onClose();
	};

	private handleScroll = (event: Event) => {
		const menu = this.menuRef.current;
		if (menu && event.target instanceof Node && menu.contains(event.target)) return;
		this.props.onClose();
	};

	private updateMenuHeight() {
		const el = this.menuRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		if (rect.height && rect.height !== this.state.menuHeight) {
			this.setState({ menuHeight: rect.height });
		}
	}

	private updatePositionCss() {
		const { open, anchorX, anchorY, width = 220 } = this.props;
		if (!open) {
			return;
		}
		const viewportPadding = 8;
		const effectiveWidth = Math.max(0, Math.min(width, this.state.viewportWidth - viewportPadding * 2));
		const effectiveMaxHeight = Math.max(0, this.state.viewportHeight - viewportPadding * 2);
		const position = computeContextMenuPosition(
			anchorX,
			anchorY,
			effectiveWidth,
			this.state.menuHeight,
			viewportPadding,
			this.state.viewportWidth,
			this.state.viewportHeight,
		);
		const nextCss = [
			'position: fixed;',
			`top: ${position.top}px;`,
			`left: ${position.left}px;`,
			`width: ${effectiveWidth}px;`,
			`max-height: ${effectiveMaxHeight}px;`,
			'overflow-y: auto;',
			'z-index: 10001;',
		].join(' ');
		if (this.cssText !== nextCss) {
			this.cssText = nextCss;
			this.positionStyle.update(nextCss);
		}
	}

	render() {
		if (!this.props.open) {
			return null;
		}

		const className = [
			this.props.className ?? 'dropdown-menu show',
			'cgenh-logic-context-menu',
			this.positionStyle.className,
		].filter(Boolean).join(' ');

		return createPortal(
			<div
				ref={this.menuRef}
				className={className}
				onClick={(e) => e.stopPropagation()}
				onContextMenu={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			>
				{this.props.children}
			</div>,
			document.body,
		);
	}
}

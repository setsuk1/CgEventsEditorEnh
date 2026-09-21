import React from 'react';
import { translation } from '../../../trans/Trans';
import { acquireModalLock } from '../../utils/modalLock';

interface SelectorPanelProps {
	open: boolean;
	onClose(): void;
	onConfirm?(): void;
	children: React.ReactNode;
	footer?: React.ReactNode;
	showHeader?: boolean;
	cancelLabel?: string;
	confirmLabel?: string;
	showConfirm?: boolean;
	width?: string;
	height?: string;
}

export class SelectorPanel extends React.PureComponent<SelectorPanelProps, {}> {
	private releaseModalLock: (() => void) | null = null;

	componentDidMount(): void {
		if (this.props.open) this.releaseModalLock = acquireModalLock();
	}

	componentDidUpdate(prevProps: SelectorPanelProps): void {
		if (prevProps.open === this.props.open) return;
		if (this.props.open) {
			this.releaseModalLock = this.releaseModalLock ?? acquireModalLock();
			return;
		}
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	componentWillUnmount(): void {
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	render() {
		if (!this.props.open) return null;
		const { children, footer, onClose, onConfirm, width, height } = this.props;
		const dialogStyle: React.CSSProperties = {};
		if (width) {
			dialogStyle.width = width;
			dialogStyle.maxWidth = width;
		}
		if (height) dialogStyle.height = height;
		const showConfirm = this.props.showConfirm !== false && !!onConfirm;

		return (
			<>
				<div
					className="modal show d-block"
					role="dialog"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) onClose();
					}}
					onContextMenu={(e) => e.preventDefault()}
				>
					<div
						className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable cgenh-modal-dialog"
						role="document"
						style={dialogStyle}
						onMouseDown={(e) => e.stopPropagation()}
						onMouseUp={(e) => e.stopPropagation()}
						onMouseMove={(e) => e.stopPropagation()}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-content d-flex flex-column h-100">
							{this.props.showHeader !== false ? <div className="modal-header py-2" /> : null}
							<div className="modal-body cgenh-modal-body cgenh-modal-body--flex cgenh-modal-body--scroll">
								{children}
							</div>
							<div className="modal-footer">
								{showConfirm && (
									<button type="button" className="btn btn-sm btn-outline-secondary" onClick={onConfirm}>
										{this.props.confirmLabel ?? translation.common.confirm.getTrans()}
									</button>
								)}
								<button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
									{this.props.cancelLabel ?? translation.common.cancel.getTrans()}
								</button>
								{footer}
							</div>
						</div>
					</div>
				</div>
				<div className="modal-backdrop show" />
			</>
		);
	}
}

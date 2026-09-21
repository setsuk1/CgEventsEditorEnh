import React from 'react';
import { translation } from '../../../trans/Trans';
import { acquireModalLock } from '../../utils/modalLock';

interface LanguageSyncDialogProps {
	open: boolean;
	dontAskAgainChecked: boolean;
	onDontAskAgainChange(checked: boolean): void;
	onConfirm(sync: boolean): void;
}

export class LanguageSyncDialog extends React.Component<LanguageSyncDialogProps> {
	private releaseModalLock: (() => void) | null = null;

	private readonly handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
		if (event.target === event.currentTarget) this.props.onConfirm(false);
	};

	private readonly handleDialogMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	};

	private readonly handleDontAskAgainChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		this.props.onDontAskAgainChange(event.target.checked);
	};

	private readonly handleConfirmYes = () => {
		this.props.onConfirm(true);
	};

	private readonly handleConfirmNo = () => {
		this.props.onConfirm(false);
	};

	componentDidMount(): void {
		if (this.props.open) this.releaseModalLock = acquireModalLock();
	}

	componentDidUpdate(prevProps: LanguageSyncDialogProps): void {
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

		return (
			<>
				<div className="modal show d-block" role="dialog" onMouseDown={this.handleBackdropMouseDown}>
					<div className="modal-dialog modal-dialog-centered" role="document" onMouseDown={this.handleDialogMouseDown}>
						<div className="modal-content">
							<div className="modal-header">
								<h5 className="modal-title">{translation.app.syncLanguage.title.getTrans()}</h5>
							</div>
							<div className="modal-body">
								<p className="mb-3">{translation.app.syncLanguage.message.getTrans()}</p>
								<div className="form-check">
									<input
										type="checkbox"
										className="form-check-input"
										id="dontAskAgainCheckbox"
										checked={this.props.dontAskAgainChecked}
										onChange={this.handleDontAskAgainChange}
									/>
									<label className="form-check-label" htmlFor="dontAskAgainCheckbox">
										{translation.app.syncLanguage.dontAskAgain.getTrans()}
									</label>
								</div>
							</div>
							<div className="modal-footer">
								<button type="button" className="btn btn-outline-secondary" onClick={this.handleConfirmNo}>
									{translation.common.no.getTrans()}
								</button>
								<button type="button" className="btn btn-primary" onClick={this.handleConfirmYes}>
									{translation.common.yes.getTrans()}
								</button>
							</div>
						</div>
					</div>
				</div>
				<div className="modal-backdrop show" />
			</>
		);
	}
}

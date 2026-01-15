import React from 'react';
import { translation } from '../../../trans/Trans';

interface LanguageSyncDialogProps {
	open: boolean;
	dontAskAgainChecked: boolean;
	onDontAskAgainChange(checked: boolean): void;
	onConfirm(sync: boolean): void;
}

export class LanguageSyncDialog extends React.Component<LanguageSyncDialogProps> {
	private readonly handleBackdropMouseDown = this.handleBackdropMouseDownInternal.bind(this);
	private readonly handleDialogMouseDown = this.handleDialogMouseDownInternal.bind(this);
	private readonly handleDontAskAgainChange = this.handleDontAskAgainChangeInternal.bind(this);
	private readonly handleConfirmYes = this.handleConfirmYesInternal.bind(this);
	private readonly handleConfirmNo = this.handleConfirmNoInternal.bind(this);

	private handleBackdropMouseDownInternal(event: React.MouseEvent<HTMLDivElement>) {
		if (event.target === event.currentTarget) {
			this.props.onConfirm(false);
		}
	}

	private handleDialogMouseDownInternal(event: React.MouseEvent<HTMLDivElement>) {
		event.stopPropagation();
	}

	private handleDontAskAgainChangeInternal(event: React.ChangeEvent<HTMLInputElement>) {
		this.props.onDontAskAgainChange(event.target.checked);
	}

	private handleConfirmYesInternal() {
		this.props.onConfirm(true);
	}

	private handleConfirmNoInternal() {
		this.props.onConfirm(false);
	}

	render() {
		if (!this.props.open) {
			return null;
		}

		return (
			<>
				<div
					className="modal show d-block"
					role="dialog"
					onMouseDown={this.handleBackdropMouseDown}
				>
					<div
						className="modal-dialog modal-dialog-centered"
						role="document"
						onMouseDown={this.handleDialogMouseDown}
					>
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
								<button
									type="button"
									className="btn btn-outline-secondary"
									onClick={this.handleConfirmNo}
								>
									{translation.common.no.getTrans()}
								</button>
								<button
									type="button"
									className="btn btn-primary"
									onClick={this.handleConfirmYes}
								>
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


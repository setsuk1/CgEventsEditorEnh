import React from 'react';
import { translation } from '../../../trans/Trans';
import { SvgChevronLeft } from '../../svg/SvgChevronLeft';
import { SvgClose } from '../../svg/SvgClose';

interface ConfigsPanelHeaderProps {
	title: string;
	description?: string;
	onClose(): void;
	className?: string;
	onBack?(): void;
	backTitle?: string;
	controls?: React.ReactNode;
	showClose?: boolean;
}

export class ConfigsPanelHeader extends React.PureComponent<ConfigsPanelHeaderProps, {}> {
	render() {
		const { title, description, className, onBack, backTitle, controls, showClose = true } = this.props;
		return (
			<div className={`modal-header ${className ?? ''}`}>
				<div className="d-flex align-items-start gap-2 min-w-0 flex-grow-1">
					{onBack && (
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary"
							onClick={onBack}
							title={backTitle ?? translation.common.back.getTrans()}
						>
							<SvgChevronLeft aria-hidden="true" />
						</button>
					)}
					<div className="min-w-0">
						<h5 className="modal-title mb-0 text-truncate">{title}</h5>
						{description && <p className="mb-0 mt-1 text-body-secondary small">{description}</p>}
					</div>
				</div>
				<div className="d-flex align-items-center gap-2 flex-shrink-0">
					{controls}
					{showClose && (
						<button type="button" className="btn btn-sm btn-outline-secondary" onClick={this.props.onClose} aria-label={translation.common.close.getTrans()}>
							<SvgClose aria-hidden="true" />
						</button>
					)}
				</div>
			</div>
		);
	}
}

import React from 'react';
import { translation } from '../../../trans/Trans';
import { SvgTrash } from '../../svg/SvgTrash';
import { Tooltip } from '../common/Tooltip';

interface DefinitionCardProps {
	title: string;
	onRemove(): void;
	children: React.ReactNode;
}

export class DefinitionCard extends React.PureComponent<DefinitionCardProps, {}> {
	render() {
		return (
			<div className="card">
				<div className="card-header d-flex align-items-center justify-content-between gap-2 py-1">
					<span className="small fw-semibold text-truncate">{this.props.title}</span>
					<Tooltip content={translation.common.remove.getTrans()}>
						<button type="button" className="btn btn-sm btn-outline-danger p-1" onClick={this.props.onRemove}>
							<SvgTrash aria-hidden="true" />
						</button>
					</Tooltip>
				</div>
				<div className="card-body p-2">{this.props.children}</div>
			</div>
		);
	}
}

import React from 'react';
import { translation } from '../../../trans/Trans';
import { SvgSparkle } from '../../svg/SvgSparkle';
import { Tooltip } from '../common/Tooltip';

interface HelperActionBarProps {
	selectionEnabled: boolean;
	onOpen(): void;
}

export class HelperActionBar extends React.PureComponent<HelperActionBarProps, {}> {
	render() {
		if (!this.props.selectionEnabled) return null;
		return (
			<div>
				<Tooltip content={translation.common.openHelper.getTrans()}>
					<button
						type="button"
						className="btn btn-sm btn-outline-warning p-1"
						onClick={(e) => {
							e.stopPropagation();
							this.props.onOpen();
						}}
						onMouseDown={(e) => e.stopPropagation()}
						onMouseUp={(e) => e.stopPropagation()}
					>
						<SvgSparkle aria-hidden="true" />
					</button>
				</Tooltip>
			</div>
		);
	}
}

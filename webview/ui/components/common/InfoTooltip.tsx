import React from 'react';
import { playMouseHoverAudio } from '../../../helper/sound';
import { translation } from '../../../trans/Trans';
import { Tooltip } from './Tooltip';

interface InfoTooltipProps {
	description: string;
}

export class InfoTooltip extends React.PureComponent<InfoTooltipProps, {}> {
	render() {
		const { description } = this.props;
		return (
			<Tooltip content={description}>
				<button
					type="button"
					className="btn btn-sm btn-outline-secondary rounded-circle p-0 d-inline-flex align-items-center justify-content-center cgenh-info-tooltip__button"
					aria-label={translation.common.info.getTrans()}
					onMouseEnter={playMouseHoverAudio}
				>
					<span className="small fw-semibold">i</span>
				</button>
			</Tooltip>
		);
	}
}
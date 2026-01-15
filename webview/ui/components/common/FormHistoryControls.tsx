import React from 'react';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { translation } from '../../../trans/Trans';
import { SvgRedo } from '../../svg/SvgRedo';
import { SvgUndo } from '../../svg/SvgUndo';
import { Tooltip } from './Tooltip';

interface FormHistoryControlsProps {
	canUndo: boolean;
	canRedo: boolean;
	onUndo(): void;
	onRedo(): void;
}

export class FormHistoryControls extends React.PureComponent<FormHistoryControlsProps, {}> {
	private handleButtonMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		playMouseDownAudio();
	};

	render() {
		const { canUndo, canRedo, onUndo, onRedo } = this.props;
		return (
			<div className="d-flex align-items-center gap-1">
				<Tooltip content={translation.common.undo.getTrans()}>
					<button
						type="button"
						className="btn btn-sm btn-outline-secondary p-1"
						onClick={onUndo}
						disabled={!canUndo}
						aria-label={translation.common.undo.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={this.handleButtonMouseDown}
					>
						<SvgUndo aria-hidden="true" />
					</button>
				</Tooltip>
				<Tooltip content={translation.common.redo.getTrans()}>
					<button
						type="button"
						className="btn btn-sm btn-outline-secondary p-1"
						onClick={onRedo}
						disabled={!canRedo}
						aria-label={translation.common.redo.getTrans()}
						onMouseEnter={playMouseHoverAudio} onMouseDown={this.handleButtonMouseDown}
					>
						<SvgRedo aria-hidden="true" />
					</button>
				</Tooltip>
			</div>
		);
	}
}

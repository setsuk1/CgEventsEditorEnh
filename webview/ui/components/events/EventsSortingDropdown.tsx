import React from 'react';
import { playMouseHoverAudio } from '../../../helper/sound';
import { translation } from '../../../trans/Trans';
import { SvgSorting } from '../../svg/SvgSorting';

interface EventsSortingDropdownProps {
	open: boolean;
	displayName: string;
	dropdownRef: React.RefObject<HTMLDivElement>;
	onBlur(event: React.FocusEvent<HTMLDivElement>): void;
	onToggle(): void;
	onOpenEdit(): void;
	onOpenSave(): void;
	onOpenLoad(): void;
}

export class EventsSortingDropdown extends React.PureComponent<EventsSortingDropdownProps> {
	private handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.nativeEvent.isComposing || event.key !== 'Escape' || !this.props.open) return;
		event.preventDefault();
		event.stopPropagation();
		this.props.onToggle();
	};

	render() {
		const rootClassName = `dropdown${this.props.open ? ' show' : ''}`;
		const menuClassName = `dropdown-menu${this.props.open ? ' show' : ''}`;

		return (
			<div
				className={rootClassName}
				tabIndex={0}
				onBlur={this.props.onBlur}
				onKeyDown={this.handleKeyDown}
				ref={this.props.dropdownRef}
			>
				<button
					type="button"
					className="btn btn-sm btn-outline-secondary dropdown-toggle"
					onClick={this.props.onToggle}
					aria-expanded={this.props.open}
					aria-haspopup="menu"
					title={translation.events.sorting.title.getTrans()}
					aria-label={translation.events.sorting.title.getTrans()}
					onMouseEnter={playMouseHoverAudio}
				>
					<SvgSorting aria-hidden="true" />
					<span className="ms-1">{this.props.displayName}</span>
				</button>
				<div className={menuClassName} role="menu">
					<button className="dropdown-item" type="button" onClick={this.props.onOpenEdit}>
						{translation.events.sorting.editPreset.getTrans()}
					</button>
					<button className="dropdown-item" type="button" onClick={this.props.onOpenSave}>
						{translation.events.sorting.savePreset.getTrans()}
					</button>
					<button className="dropdown-item" type="button" onClick={this.props.onOpenLoad}>
						{translation.events.sorting.loadPreset.getTrans()}
					</button>
				</div>
			</div>
		);
	}
}

import React from 'react';
import { translation } from '../../../trans/Trans';
import { SvgFolderOutline } from '../../svg/SvgFolderOutline';
import { decodeEventFolderFilterValue, encodeEventFolderFilterValue } from './EventsDisplay';

interface EventsFolderDropdownProps {
	open: boolean;
	folderFilter: string[];
	options: string[];
	allFoldersValue: string;
	noFolderValue: string;
	dropdownRef: React.RefObject<HTMLDivElement>;
	buttonRef: React.RefObject<HTMLButtonElement>;
	onBlur(event: React.FocusEvent<HTMLDivElement>): void;
	onToggle(): void;
	onToggleFolder(value: string): void;
}

export class EventsFolderDropdown extends React.PureComponent<EventsFolderDropdownProps> {
	private handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.nativeEvent.isComposing || event.key !== 'Escape' || !this.props.open) return;
		event.preventDefault();
		event.stopPropagation();
		this.props.onToggle();
		this.props.buttonRef.current?.focus();
	};

	render() {
		const selectedFolders = new Set(this.props.folderFilter);
		let selectedText: string;
		if (selectedFolders.has(this.props.allFoldersValue) || selectedFolders.size === 0) {
			selectedText = translation.events.allFolders.getTrans();
		} else {
			selectedText = this.props.folderFilter.map((value) =>
				value === this.props.noFolderValue
					? translation.events.noFolder.getTrans()
					: (decodeEventFolderFilterValue(value) ?? value)
			).join(', ');
		}

		const rootClassName = `dropdown${this.props.open ? ' show' : ''}`;
		const menuClassName = `dropdown-menu dropdown-menu-end cgenh-folder-dropdown-menu${this.props.open ? ' show' : ''}`;
		const buttonLabel = `${translation.events.folder.getTrans()}: ${selectedText}`;

		return (
			<div
				className={rootClassName}
				tabIndex={0}
				onBlur={this.props.onBlur}
				onKeyDown={this.handleKeyDown}
				ref={this.props.dropdownRef}
			>
				<button
					ref={this.props.buttonRef}
					type="button"
					className="btn btn-sm btn-outline-secondary dropdown-toggle cgenh-folder-filter-button"
					onClick={this.props.onToggle}
					aria-expanded={this.props.open}
					aria-haspopup="menu"
					title={buttonLabel}
					aria-label={buttonLabel}
				>
					<span className="cgenh-folder-filter-button__icon" aria-hidden="true">
						<SvgFolderOutline aria-hidden="true" />
					</span>
					<span className="cgenh-folder-filter-button__text">{selectedText}</span>
				</button>
				<div className={menuClassName} role="menu">
					<div className="px-3 py-2 d-flex flex-column gap-2">
						<label className="form-check cgenh-folder-option">
							<input
								className="form-check-input"
								type="checkbox"
								checked={selectedFolders.has(this.props.allFoldersValue)}
								onChange={() => this.props.onToggleFolder(this.props.allFoldersValue)}
							/>
							<span className="form-check-label">{translation.events.allFolders.getTrans()}</span>
						</label>
						<label className="form-check cgenh-folder-option">
							<input
								className="form-check-input"
								type="checkbox"
								checked={selectedFolders.has(this.props.noFolderValue)}
								onChange={() => this.props.onToggleFolder(this.props.noFolderValue)}
							/>
							<span className="form-check-label">{translation.events.noFolder.getTrans()}</span>
						</label>
						{this.props.options.map((folder) => {
							const filterValue = encodeEventFolderFilterValue(folder);
							return (
								<label key={folder} className="form-check cgenh-folder-option">
									<input
										className="form-check-input"
										type="checkbox"
										checked={selectedFolders.has(filterValue)}
										onChange={() => this.props.onToggleFolder(filterValue)}
									/>
									<span className="form-check-label">{folder}</span>
								</label>
							);
						})}
					</div>
				</div>
			</div>
		);
	}
}
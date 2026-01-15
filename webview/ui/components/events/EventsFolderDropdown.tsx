import React from 'react';
import { translation } from '../../../trans/Trans';
import { SvgFolderOutline } from '../../svg/SvgFolderOutline';

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
	render() {
		let selectedText: string;
		if (this.props.folderFilter.includes(this.props.allFoldersValue) || this.props.folderFilter.length === 0) {
			selectedText = translation.events.allFolders.getTrans();
		} else {
			const names = this.props.folderFilter.map((value: string) => {
				if (value === this.props.noFolderValue) {
					return translation.events.noFolder.getTrans();
				}
				return value;
			});
			selectedText = names.join(', ');
		}

		const rootClassName = `dropdown${this.props.open ? ' show' : ''}`;
		const menuClassName = `dropdown-menu dropdown-menu-end cgenh-folder-dropdown-menu${this.props.open ? ' show' : ''}`;
		const buttonLabel = `${translation.events.folder.getTrans()}: ${selectedText}`;

		return (
			<div className={rootClassName} tabIndex={0} onBlur={this.props.onBlur} ref={this.props.dropdownRef}>
				<button
					ref={this.props.buttonRef}
					type="button"
					className="btn btn-sm btn-outline-secondary dropdown-toggle cgenh-folder-filter-button"
					onClick={this.props.onToggle}
					aria-expanded={this.props.open}
					title={buttonLabel}
					aria-label={buttonLabel}
				>
					<span className="cgenh-folder-filter-button__icon" aria-hidden="true">
						<SvgFolderOutline aria-hidden="true" />
					</span>
					<span className="cgenh-folder-filter-button__text">{selectedText}</span>
				</button>
				<div className={menuClassName}>
					<div className="px-3 py-2 d-flex flex-column gap-2">
						<label className="form-check cgenh-folder-option">
							<input
								id={`cgenh-folder-filter-${this.props.allFoldersValue}`}
								className="form-check-input"
								type="checkbox"
								checked={this.props.folderFilter.includes(this.props.allFoldersValue)}
								onChange={() => this.props.onToggleFolder(this.props.allFoldersValue)}
							/>
							<span className="form-check-label">{translation.events.allFolders.getTrans()}</span>
						</label>
						<label className="form-check cgenh-folder-option">
							<input
								id={`cgenh-folder-filter-${this.props.noFolderValue}`}
								className="form-check-input"
								type="checkbox"
								checked={this.props.folderFilter.includes(this.props.noFolderValue)}
								onChange={() => this.props.onToggleFolder(this.props.noFolderValue)}
							/>
							<span className="form-check-label">{translation.events.noFolder.getTrans()}</span>
						</label>
						{this.props.options.map((folder) => (
							<label key={folder} className="form-check cgenh-folder-option">
								<input
									id={`cgenh-folder-filter-${folder}`}
									className="form-check-input"
									type="checkbox"
									checked={this.props.folderFilter.includes(folder)}
									onChange={() => this.props.onToggleFolder(folder)}
								/>
								<span className="form-check-label">{folder}</span>
							</label>
						))}
					</div>
				</div>
			</div>
		);
	}
}

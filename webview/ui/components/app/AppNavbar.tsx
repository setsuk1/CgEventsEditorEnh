import { editorLangs, ExternalUrlCode, getByCode } from '@shared';
import type { IEditorLanguageSetting } from '@shared';
import React from 'react';
import { playMouseDownAudio, playMouseHoverAudio } from '../../../helper/sound';
import { translation } from '../../../trans/Trans';
import { SvgCodeBracketsStroke } from '../../svg/SvgCodeBracketsStroke';
import { SvgVisualMode } from '../../svg/SvgVisualMode';
import { SvgVolumeHigh } from '../../svg/SvgVolumeHigh';
import { SvgVolumeLow } from '../../svg/SvgVolumeLow';
import { SvgVolumeMuted } from '../../svg/SvgVolumeMuted';

interface AppNavbarProps {
	headerRef: React.RefObject<HTMLElement>;
	extraClassName?: string;
	mode: 'visual' | 'json';
	formatValue: 'json' | 'lz';
	eventsCount: number;
	language: IEditorLanguageSetting;
	audioVolume: number;
	audioMuted: boolean;
	onSetMode(mode: 'visual' | 'json'): void;
	onSave(): void;
	onSetFormat(format: 'json' | 'lz'): void;
	onSelectLanguage(language: IEditorLanguageSetting): void;
	onOpenExternalUrl(url: ExternalUrlCode): void;
	onOpenVSCodeSettings(): void;
	onVolumeMuteToggle(): void;
	onVolumeChange(event: React.ChangeEvent<HTMLInputElement>): void;
}

const LANGUAGE_OPTIONS: IEditorLanguageSetting[] = ['auto', ...editorLangs.map((lang) => lang.code)];

export class AppNavbar extends React.Component<AppNavbarProps> {
	private helpDropdownRef = React.createRef<HTMLDivElement>();

	private closeHelpDropdown = () => {
		this.helpDropdownRef.current?.blur();
		const activeElement = document.activeElement;
		if (activeElement instanceof HTMLElement && this.helpDropdownRef.current?.contains(activeElement)) {
			activeElement.blur();
		}
	};

	private handleHelpKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		this.closeHelpDropdown();
	};

	private renderExternalLink(code: ExternalUrlCode, label: string) {
		return (
			<button
				key={code}
				type="button"
				className="dropdown-item"
				onClick={() => {
					this.props.onOpenExternalUrl(code);
					this.closeHelpDropdown();
				}}
			>
				{label}
			</button>
		);
	}

	private getLanguageLabel(language: IEditorLanguageSetting): string {
		if (language === 'auto') {
			return translation.app.languageAuto.getTrans();
		}
		const lang = getByCode(language);
		const nativeName = lang?.nativeName?.trim();
		return nativeName ? nativeName : language;
	}

	render() {
		const formatValue = this.props.formatValue;
		const oldEditorLinks: Array<[ExternalUrlCode, string]> = [
			[ExternalUrlCode.OLD_EDITOR_BASIC_TUTORIAL, translation.app.basicTutorial.getTrans()],
			[ExternalUrlCode.OLD_EDITOR_TUTORIAL_SECTION, translation.app.tutorialSection.getTrans()],
			[ExternalUrlCode.OLD_EDITOR_DISCUSSION, translation.app.discussionSection.getTrans()],
			[ExternalUrlCode.OLD_EDITOR_SAMPLE_DOWNLOAD, translation.app.sampleDownload.getTrans()],
		];
		const originalEditorLinks: Array<[ExternalUrlCode, string]> = [
			[ExternalUrlCode.ORIGINAL_EDITOR_BASIC_TUTORIAL, translation.app.basicTutorial.getTrans()],
			[ExternalUrlCode.ORIGINAL_EDITOR_TUTORIAL_SECTION, translation.app.tutorialSection.getTrans()],
			[ExternalUrlCode.ORIGINAL_EDITOR_DISCUSSION, translation.app.discussionSection.getTrans()],
			[ExternalUrlCode.ORIGINAL_EDITOR_SAMPLE_DOWNLOAD, translation.app.sampleDownload.getTrans()],
		];
		return (
			<nav
				ref={this.props.headerRef}
				className={[
					'navbar',
					'navbar-expand',
					'border-bottom',
					'px-3',
					'py-2',
					'cgenh-app-header',
					this.props.extraClassName ?? ''
				].filter(Boolean).join(' ')}
				aria-label={translation.app.eventsExplorerTitle.getTrans()}
			>
				<div className="container-fluid px-0 gap-3">
					<div className="me-auto min-w-0">
						<h1 className="h5 mb-0 text-truncate">{translation.app.eventsExplorerTitle.getTrans()}</h1>
						<p className="text-body-secondary small mb-0 text-truncate">
							{translation.app.formatLabel.getTrans()}: {formatValue.toUpperCase()}, {this.props.eventsCount} {translation.app.eventsLabel.getTrans()}
						</p>
					</div>
					<div className="d-flex flex-wrap align-items-center gap-2">
						<div className="btn-group btn-group-sm" role="group" aria-label={translation.app.editorMode.getTrans()}>
							<button
								type="button"
								className={`btn btn-outline-secondary d-flex align-items-center justify-content-center${this.props.mode === 'visual' ? ' active' : ''}`}
								onClick={() => this.props.onSetMode('visual')}
								title={translation.editor.visualEditor.getTrans()}
								aria-label={translation.editor.visualEditor.getTrans()}
								onMouseDown={playMouseDownAudio}
							>
								<SvgVisualMode aria-hidden="true" />
							</button>
							<button
								type="button"
								className={`btn btn-outline-secondary d-flex align-items-center justify-content-center${this.props.mode === 'json' ? ' active' : ''}`}
								onClick={() => this.props.onSetMode('json')}
								title={translation.editor.jsonEditor.getTrans()}
								aria-label={translation.editor.jsonEditor.getTrans()}
								onMouseDown={playMouseDownAudio}
							>
								<SvgCodeBracketsStroke aria-hidden="true" />
							</button>
						</div>
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary"
							onClick={this.props.onSave}
							onMouseEnter={playMouseHoverAudio}
							onMouseDown={playMouseDownAudio}
						>
							{translation.common.save.getTrans()}
						</button>
						<div
							className="dropdown cgenh-hover-dropdown"
							ref={this.helpDropdownRef}
							tabIndex={-1}
							onKeyDown={this.handleHelpKeyDown}
						>
							<button
								type="button"
								className="btn btn-sm btn-outline-secondary dropdown-toggle"
								onMouseEnter={playMouseHoverAudio}
								aria-haspopup="menu"
							>
								{translation.app.help.getTrans()}
							</button>
							<ul className="dropdown-menu dropdown-menu-end cgenh-help-dropdown">
								<li className="cgenh-submenu-container">
									<span className="dropdown-item" tabIndex={0} role="button" aria-haspopup="menu" onMouseEnter={playMouseHoverAudio}>
										<span>{translation.app.formatLabel.getTrans()}: {formatValue.toUpperCase()}</span>
										<span className="cgenh-submenu-arrow">◀</span>
									</span>
									<div className="cgenh-submenu">
										<button
											type="button"
											className={`dropdown-item${formatValue === 'json' ? ' active' : ''}`}
											onClick={() => { this.props.onSetFormat('json'); this.closeHelpDropdown(); }}
										>
											JSON
										</button>
										<button
											type="button"
											className={`dropdown-item${formatValue === 'lz' ? ' active' : ''}`}
											onClick={() => { this.props.onSetFormat('lz'); this.closeHelpDropdown(); }}
										>
											LZ
										</button>
									</div>
								</li>
								<li className="cgenh-submenu-container">
									<span className="dropdown-item" tabIndex={0} role="button" aria-haspopup="menu" onMouseEnter={playMouseHoverAudio}>
										<span>{translation.app.languageLabel.getTrans()}: {this.getLanguageLabel(this.props.language)}</span>
										<span className="cgenh-submenu-arrow">◀</span>
									</span>
									<div className="cgenh-submenu">
										{LANGUAGE_OPTIONS.map((language) => (
											<button
												key={language}
												type="button"
												className={`dropdown-item${this.props.language === language ? ' active' : ''}`}
												onClick={() => { this.props.onSelectLanguage(language); this.closeHelpDropdown(); }}
											>
												{this.getLanguageLabel(language)}
											</button>
										))}
									</div>
								</li>
								<li><hr className="dropdown-divider" /></li>
								<li className="cgenh-submenu-container">
									<span className="dropdown-item" tabIndex={0} role="button" aria-haspopup="menu" onMouseEnter={playMouseHoverAudio}>
										<span>{translation.app.oldEditor.getTrans()}</span>
										<span className="cgenh-submenu-arrow">◀</span>
									</span>
									<div className="cgenh-submenu">
										{oldEditorLinks.map(([code, label]) => this.renderExternalLink(code, label))}
									</div>
								</li>
								<li className="cgenh-submenu-container">
									<span className="dropdown-item" tabIndex={0} role="button" aria-haspopup="menu" onMouseEnter={playMouseHoverAudio}>
										<span>{translation.app.originalEditor.getTrans()}</span>
										<span className="cgenh-submenu-arrow">◀</span>
									</span>
									<div className="cgenh-submenu">
										{originalEditorLinks.map(([code, label]) => this.renderExternalLink(code, label))}
									</div>
								</li>
								<li><hr className="dropdown-divider" /></li>
								<li className="cgenh-volume-container">
									<div className="cgenh-volume-item" onMouseEnter={playMouseHoverAudio}>
										<button
											type="button"
											className="cgenh-volume-icon-btn"
											onClick={this.props.onVolumeMuteToggle}
											onMouseDown={playMouseDownAudio}
											title={this.props.audioMuted ? translation.app.unmute.getTrans() : translation.app.mute.getTrans()}
										>
											{this.props.audioMuted || this.props.audioVolume === 0 ? (
												<SvgVolumeMuted aria-hidden="true" />
											) : this.props.audioVolume < 0.5 ? (
												<SvgVolumeLow aria-hidden="true" />
											) : (
												<SvgVolumeHigh aria-hidden="true" />
											)}
										</button>
										<div className="cgenh-volume-slider-wrapper">
											<input
												type="range"
												className="cgenh-volume-slider"
												min="0"
												max="1"
												step="0.01"
												value={this.props.audioMuted ? 0 : this.props.audioVolume}
												onChange={this.props.onVolumeChange}
												onMouseDown={(e) => e.stopPropagation()}
											/>
											<span className="cgenh-volume-value">{Math.round((this.props.audioMuted ? 0 : this.props.audioVolume) * 100)}</span>
										</div>
									</div>
								</li>
								<li><hr className="dropdown-divider" /></li>
								<li>
									<button
										type="button"
										className="dropdown-item"
										onClick={() => { this.props.onOpenVSCodeSettings(); this.closeHelpDropdown(); }}
										onMouseEnter={playMouseHoverAudio}
										onMouseDown={playMouseDownAudio}
									>
										{translation.app.openVSCodeSettings.getTrans()}
									</button>
								</li>
								<li>
									<button
										type="button"
										className="dropdown-item"
										onClick={() => { this.props.onOpenExternalUrl(ExternalUrlCode.ONLINE_EDITOR); this.closeHelpDropdown(); }}
										onMouseEnter={playMouseHoverAudio}
										onMouseDown={playMouseDownAudio}
									>
										{translation.app.openOnlineEditor.getTrans()}
									</button>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</nav>
		);
	}
}

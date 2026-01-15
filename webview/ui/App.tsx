import { editorLangs, ExternalUrlCode, getByCode, getSelectedLanguage, IEditorLanguageCode, IEditorLanguageSetting, IIncomingMessageLanguageSyncData, IncomingMessageType, IOutgoingMessageLanguageSyncData, ISyncLanguageOptions, ObjectUtil, offLanguageChange, onLanguageChange, OutgoingMessageType, setLanguage } from '@shared';
import React from 'react';
import { CgEventsEditor, EditorChangeEvents } from '../editor/CgEventsEditor';
import { getAudioVolume, setAudioVolume } from '../helper/sound';
import { msgHandler } from '../msg/MessageHandler';
import { winEE } from '../msg/WindowEventEmitter';
import { translation } from '../trans/Trans';
import { AppLoadingScreen } from './components/app/AppLoadingScreen';
import { AppNavbar } from './components/app/AppNavbar';
import { LanguageSyncDialog } from './components/app/LanguageSyncDialog';
import { MonacoEditorComponent } from './components/common/MonacoEditorComponent';
import { contextMenuStateManager } from './components/events/ContextMenuState';
import { EventsEditorComponent } from './components/events/EventsEditorComponent';

interface AppProps {
	editor: CgEventsEditor;
}

type EditorFormat = 'json' | 'lz' | 'error';

interface EditorSummary {
	hasDocument: boolean;
	eventsCount: number;
	format: EditorFormat;
	parseErrorText?: string;
}

interface AppState {
	language: IEditorLanguageSetting;
	syncLanguage: ISyncLanguageOptions;
	mode: 'visual' | 'json';
	jsonText: string;
	jsonError?: string;
	navCollapsed: boolean;
	showLoading: boolean;
	hasDocument: boolean;
	eventsCount: number;
	format: EditorFormat;
	parseErrorText?: string;
	showLanguageSyncDialog: boolean;
	dontAskAgainChecked: boolean;
	audioVolume: number;
	audioMuted: boolean;
}

export class App extends React.Component<AppProps, AppState> {
	private headerRef = React.createRef<HTMLElement>();
	private mainRef = React.createRef<HTMLElement>();
	private headerHeight = 0;
	private navOffsetPx = -1;
	private mainScrollbarWidth = 0;
	private headerObserver: ResizeObserver | null = null;
	private mainContentObserver: ResizeObserver | null = null;
	private mainContentElement: Element | null = null;
	private lastMainScrollTop = 0;
	private pendingMainScrollTop: number | null = null;
	private scrollRafId: number | null = null;
	private loadingRafId: number | null = null;
	private loadingRafIdSecond: number | null = null;
	private mainResizeRafId: number | null = null;
	private toolbarShiftRafId: number | null = null;
	private toolbarShiftRafIdSecond: number | null = null;
	private editorListenersAttached = false;

	constructor(props: AppProps) {
		super(props);
		const summary = this.getEditorSummary();
		this.state = {
			language: 'auto',
			syncLanguage: 'ask',
			mode: 'visual',
			jsonText: '',
			jsonError: undefined,
			navCollapsed: false,
			showLoading: true,
			hasDocument: summary.hasDocument,
			eventsCount: summary.eventsCount,
			format: summary.format,
			parseErrorText: summary.parseErrorText,
			showLanguageSyncDialog: false,
			dontAskAgainChecked: false,
			audioVolume: getAudioVolume(),
			audioMuted: false,
		};
		this.handleEditAsJson = this.handleEditAsJson.bind(this);
		this.handleSave = this.handleSave.bind(this);
	}

	componentDidMount(): void {
		msgHandler.on(IncomingMessageType.LANGUAGE_SYNC, this.handleLanguageSync, this);
		onLanguageChange(this.handleLanguageChanged);
		this.attachEditorListeners();

		msgHandler.send(OutgoingMessageType.READY, undefined);
		this.ensureHeaderObserver();
		this.ensureMainContentObserver();
		this.updateMainScrollbarWidth();
		this.syncNavOffsetFromState();
		winEE.on('resize', this.handleWindowResize, this);
		winEE.on('scroll', this.handleWindowScroll, this);
		this.scheduleLoadingReveal();
	}

	componentWillUnmount(): void {
		this.detachEditorListeners(this.props.editor);
		this.headerObserver?.disconnect();
		this.headerObserver = null;
		this.mainContentObserver?.disconnect();
		this.mainContentObserver = null;
		this.mainContentElement = null;
		if (this.scrollRafId !== null) {
			cancelAnimationFrame(this.scrollRafId);
			this.scrollRafId = null;
		}
		if (this.loadingRafId !== null) {
			cancelAnimationFrame(this.loadingRafId);
			this.loadingRafId = null;
		}
		if (this.loadingRafIdSecond !== null) {
			cancelAnimationFrame(this.loadingRafIdSecond);
			this.loadingRafIdSecond = null;
		}
		if (this.mainResizeRafId !== null) {
			cancelAnimationFrame(this.mainResizeRafId);
			this.mainResizeRafId = null;
		}
		if (this.toolbarShiftRafId !== null) {
			cancelAnimationFrame(this.toolbarShiftRafId);
			this.toolbarShiftRafId = null;
		}
		if (this.toolbarShiftRafIdSecond !== null) {
			cancelAnimationFrame(this.toolbarShiftRafIdSecond);
			this.toolbarShiftRafIdSecond = null;
		}
		winEE.off('resize', this.handleWindowResize, this);
		winEE.off('scroll', this.handleWindowScroll, this);
		offLanguageChange(this.handleLanguageChanged);
		msgHandler.off(IncomingMessageType.LANGUAGE_SYNC, this.handleLanguageSync, this);
	}

	componentDidUpdate(prevProps: AppProps, prevState: AppState): void {
		if (prevProps.editor !== this.props.editor) {
			this.detachEditorListeners(prevProps.editor);
			this.attachEditorListeners();
		}
		if (prevState.navCollapsed !== this.state.navCollapsed) {
			this.syncNavOffset(this.state.navCollapsed, !this.state.navCollapsed);
		}
		this.ensureHeaderObserver();
		this.ensureMainContentObserver();
		this.updateMainScrollbarWidth();
		if (prevState.hasDocument && !this.state.hasDocument && !this.state.showLoading) {
			this.setState({ showLoading: true });
			return;
		}
		this.scheduleLoadingReveal();
	}

	private getParseErrorText(): string | undefined {
		const error = this.props.editor.getParseError();
		if (!error) {
			return undefined;
		}
		if (error instanceof Error) {
			return error.message || String(error);
		}
		return String(error);
	}

	private getEditorSummary(): EditorSummary {
		const eventsCount = this.props.editor.getEvents().length;
		const format = this.props.editor.getEventsFormat() ?? 'json';
		const parseErrorText = this.getParseErrorText();
		const hasDocument = Boolean(this.props.editor.getEventsJson());
		return { hasDocument, eventsCount, format, parseErrorText };
	}

	private syncEditorSummary() {
		const summary = this.getEditorSummary();
		this.setState((prev) => {
			if (
				prev.hasDocument === summary.hasDocument &&
				prev.eventsCount === summary.eventsCount &&
				prev.format === summary.format &&
				prev.parseErrorText === summary.parseErrorText
			) {
				return null;
			}
			return {
				hasDocument: summary.hasDocument,
				eventsCount: summary.eventsCount,
				format: summary.format,
				parseErrorText: summary.parseErrorText,
			};
		});
	}

	private attachEditorListeners(): void {
		if (this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = true;
		const editor = this.props.editor;
		editor.on(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentUpdated, this);
		editor.on(EditorChangeEvents.FORMAT_UPDATED, this.handleFormatUpdated, this);
		editor.on(EditorChangeEvents.EVENT_ADDED, this.handleEventAdded, this);
		editor.on(EditorChangeEvents.EVENT_REMOVED, this.handleEventRemoved, this);
		editor.on(EditorChangeEvents.EVENTS_REORDERED, this.handleEventsReordered, this);
		editor.on(EditorChangeEvents.EVENTS_REPLACED, this.handleEventsReplaced, this);
	}

	private detachEditorListeners(editor: CgEventsEditor): void {
		if (!this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = false;
		editor.off(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentUpdated, this);
		editor.off(EditorChangeEvents.FORMAT_UPDATED, this.handleFormatUpdated, this);
		editor.off(EditorChangeEvents.EVENT_ADDED, this.handleEventAdded, this);
		editor.off(EditorChangeEvents.EVENT_REMOVED, this.handleEventRemoved, this);
		editor.off(EditorChangeEvents.EVENTS_REORDERED, this.handleEventsReordered, this);
		editor.off(EditorChangeEvents.EVENTS_REPLACED, this.handleEventsReplaced, this);
	}

	private handleDocumentUpdated = () => {
		this.syncEditorSummary();
	};

	private handleFormatUpdated = () => {
		this.syncEditorSummary();
	};

	private handleEventAdded = () => {
		this.syncEditorSummary();
	};

	private handleEventRemoved = () => {
		this.syncEditorSummary();
	};

	private handleEventsReordered = () => {
		this.syncEditorSummary();
	};

	private handleEventsReplaced = () => {
		this.syncEditorSummary();
	};

	private ensureHeaderObserver() {
		const header = this.headerRef.current;
		if (!header) return;

		this.updateHeaderHeight();
		this.syncNavOffsetFromState();
		if (this.headerObserver) return;
		if (typeof ResizeObserver === 'undefined') return;

		this.headerObserver = new ResizeObserver(() => {
			this.updateHeaderHeight();
			this.syncNavOffsetFromState();
		});
		this.headerObserver.observe(header);
	}

	private handleMainContentResize = () => {
		if (this.mainResizeRafId !== null) {
			return;
		}
		this.mainResizeRafId = requestAnimationFrame(() => {
			this.mainResizeRafId = null;
			this.updateMainScrollbarWidth();
		});
	};

	private detachMainContentObserver() {
		if (!this.mainContentObserver || !this.mainContentElement) {
			return;
		}
		this.mainContentObserver.unobserve(this.mainContentElement);
		this.mainContentElement = null;
	}

	private ensureMainContentObserver() {
		const main = this.mainRef.current;
		if (!main) {
			this.detachMainContentObserver();
			return;
		}
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const content = main.firstElementChild;
		if (!content) {
			this.detachMainContentObserver();
			return;
		}
		if (!this.mainContentObserver) {
			this.mainContentObserver = new ResizeObserver(this.handleMainContentResize);
		}
		if (this.mainContentElement === content) {
			return;
		}
		this.detachMainContentObserver();
		this.mainContentElement = content;
		this.mainContentObserver.observe(content);
	}

	private updateHeaderHeight() {
		const header = this.headerRef.current;
		if (!header) return;
		const next = Math.round(header.getBoundingClientRect().height);
		if (!next || next === this.headerHeight) return;
		this.headerHeight = next;
		document.documentElement.style.setProperty('--cgenh-app-header-height', `${next}px`);
	}

	private updateMainScrollbarWidth() {
		const element = document.documentElement;
		const next = Math.max(0, Math.round(window.innerWidth - element.clientWidth));
		if (next === this.mainScrollbarWidth) return;
		this.mainScrollbarWidth = next;
		document.documentElement.style.setProperty('--cgenh-main-scrollbar-width', `${next}px`);
	}

	private handleWindowResize = () => {
		this.updateHeaderHeight();
		this.syncNavOffsetFromState();
		this.updateMainScrollbarWidth();
	};

	private isEventsToolbarSticky(navOffset: number): boolean {
		if (navOffset < 0) {
			return false;
		}
		const toolbar = document.querySelector('.cgenh-events-toolbar--framed');
		if (!(toolbar instanceof HTMLElement)) {
			return false;
		}
		const rect = toolbar.getBoundingClientRect();
		const threshold = navOffset + 1;
		return rect.top <= threshold && rect.bottom > threshold;
	}

	private syncNavOffset(navCollapsed: boolean, animateToolbarShift = false) {
		let headerHeight = this.headerHeight;
		if (!navCollapsed) {
			const header = this.headerRef.current;
			const measured = header ? Math.round(header.getBoundingClientRect().height) : 0;
			if (measured) {
				headerHeight = measured;
				if (measured !== this.headerHeight) {
					this.headerHeight = measured;
					document.documentElement.style.setProperty('--cgenh-app-header-height', `${measured}px`);
				}
			}
		}
		const next = navCollapsed ? 0 : headerHeight;
		const prev = this.navOffsetPx;
		if (next === prev) {
			return;
		}
		const root = document.documentElement;
		const shouldAnimateShift = animateToolbarShift && this.isEventsToolbarSticky(prev);
		if (!shouldAnimateShift) {
			if (this.toolbarShiftRafId !== null) {
				cancelAnimationFrame(this.toolbarShiftRafId);
				this.toolbarShiftRafId = null;
			}
			if (this.toolbarShiftRafIdSecond !== null) {
				cancelAnimationFrame(this.toolbarShiftRafIdSecond);
				this.toolbarShiftRafIdSecond = null;
			}
			root.style.removeProperty('--cgenh-toolbar-shift-duration');
			root.style.setProperty('--cgenh-toolbar-shift', '0px');
		}
		if (shouldAnimateShift) {
			const delta = prev - next;
			root.style.setProperty('--cgenh-toolbar-shift-duration', '0ms');
			root.style.setProperty('--cgenh-toolbar-shift', `${delta}px`);
			if (this.toolbarShiftRafId !== null) {
				cancelAnimationFrame(this.toolbarShiftRafId);
				this.toolbarShiftRafId = null;
			}
			if (this.toolbarShiftRafIdSecond !== null) {
				cancelAnimationFrame(this.toolbarShiftRafIdSecond);
				this.toolbarShiftRafIdSecond = null;
			}
		}
		this.navOffsetPx = next;
		root.style.setProperty('--nav-offset', `${next}px`);
		if (shouldAnimateShift) {
			root.getBoundingClientRect();
			this.toolbarShiftRafId = requestAnimationFrame(() => {
				this.toolbarShiftRafId = null;
				root.style.removeProperty('--cgenh-toolbar-shift-duration');
				root.getBoundingClientRect();
				this.toolbarShiftRafIdSecond = requestAnimationFrame(() => {
					this.toolbarShiftRafIdSecond = null;
					root.style.setProperty('--cgenh-toolbar-shift', '0px');
				});
			});
		}
	}

	private syncNavOffsetFromState() {
		this.syncNavOffset(this.state.navCollapsed);
	}

	private handleLanguageChanged = () => {
		// Force re-render when language changes
		this.forceUpdate();
	};

	private syncTranslationLanguage(languageCode: IEditorLanguageCode): boolean {
		const current = getSelectedLanguage();
		const lang = getByCode(languageCode);
		if (!lang || current?.code === languageCode) {
			return false;
		}
		setLanguage(lang);
		return true;
	}

	private getSelectedLanguageCode(): IEditorLanguageCode {
		const selected = getSelectedLanguage();
		const code = typeof selected?.code === 'string' ? selected.code : '';
		const match = editorLangs.find((lang) => lang.code.toLowerCase() === code.toLowerCase());
		return match ? match.code : editorLangs[0].code;
	}

	private handleLanguageSync = (data: IIncomingMessageLanguageSyncData) => {
		if (!data) {
			return;
		}
		const updates: Partial<AppState> = {};
		const languageChanged = this.syncTranslationLanguage(data.languageCode);
		if (data.language !== undefined && data.language !== this.state.language) {
			updates.language = data.language;
		}
		if (data.syncLanguage !== undefined && data.syncLanguage !== this.state.syncLanguage) {
			updates.syncLanguage = data.syncLanguage;
		}
		if (!ObjectUtil.isEmpty(updates)) {
			this.setState((prev) => ({ ...prev, ...updates }));
		} else if (languageChanged) {
			this.forceUpdate();
		}
	};

	private handleLanguageSelect = (nextLang: IEditorLanguageSetting) => {
		const currLang = this.state.language;
		if (nextLang === currLang) {
			return;
		}

		if (nextLang !== 'auto') {
			this.syncTranslationLanguage(nextLang);
		}
		if (this.state.syncLanguage === 'ask') {
			this.setState({
				language: nextLang,
				showLanguageSyncDialog: true,
				dontAskAgainChecked: false,
			});
		} else {
			this.setState({ language: nextLang });
		}
		msgHandler.send(OutgoingMessageType.LANGUAGE_SYNC, {
			language: nextLang
		});
	};

	private handleLanguageSyncConfirm = (sync: boolean) => {
		const { dontAskAgainChecked, language } = this.state;
		const message: IOutgoingMessageLanguageSyncData = {};

		if (sync) {
			message.language = language;
			message.syncLanguage = dontAskAgainChecked ? 'auto' : 'once';
		} else if (dontAskAgainChecked) {
			message.syncLanguage = 'none';
		}

		if (!ObjectUtil.isEmpty(message)) {
			msgHandler.send(OutgoingMessageType.LANGUAGE_SYNC, message);
		}

		this.setState({
			showLanguageSyncDialog: false,
			syncLanguage: dontAskAgainChecked ? (sync ? 'auto' : 'none') : this.state.syncLanguage,
		});
	};

	private isValidJsonText(text: string): boolean {
		try {
			JSON.parse(text);
			return true;
		} catch {
			return false;
		}
	}

	private setMode(next: 'visual' | 'json') {
		if (next === this.state.mode) {
			return;
		}
		if (next === 'json') {
			const entry = this.props.editor.getCurrentEntry();
			const jsonText = entry ? JSON.stringify(entry.json, null, 2) : this.state.jsonText;
			this.setState({ mode: 'json', jsonText, jsonError: undefined, navCollapsed: false });
			return;
		}
		const currentEntry = this.props.editor.getCurrentEntry();
		const fallbackText = currentEntry ? JSON.stringify(currentEntry.json, null, 2) : this.state.jsonText;
		if (!this.isValidJsonText(this.state.jsonText)) {
			this.setState({ mode: 'visual', jsonText: fallbackText, jsonError: undefined });
			return;
		}
		const error = this.props.editor.applyJsonText(this.state.jsonText);
		if (error) {
			this.setState({ mode: 'visual', jsonText: fallbackText, jsonError: undefined });
			return;
		}
		this.setState({ mode: 'visual', jsonError: undefined });
	}

	private handleEditAsJson() {
		this.setMode('json');
	}

	private handleWindowScroll = () => {
		contextMenuStateManager.closeAllContextMenus();
		const scrollingElement = document.scrollingElement;
		const scrollTop = scrollingElement instanceof HTMLElement ? scrollingElement.scrollTop : window.scrollY;
		this.pendingMainScrollTop = scrollTop;
		if (this.scrollRafId !== null) return;
		this.scrollRafId = requestAnimationFrame(() => {
			this.scrollRafId = null;
			const nextScrollTop = this.pendingMainScrollTop ?? 0;
			this.pendingMainScrollTop = null;
			this.applyNavCollapseFromScroll(nextScrollTop);
		});
	};

	private setNavCollapsed(next: boolean) {
		if (next === this.state.navCollapsed) return;
		this.setState({ navCollapsed: next });
	}

	private applyNavCollapseFromScroll(scrollTop: number) {
		if (this.state.mode !== 'visual') return;

		if (scrollTop <= 2) {
			this.lastMainScrollTop = scrollTop;
			if (this.state.navCollapsed) {
				this.setState({ navCollapsed: false });
			}
			return;
		}

		const headerHeight = Math.max(0, this.headerHeight);
		if (scrollTop < headerHeight) {
			this.lastMainScrollTop = scrollTop;
			if (this.state.navCollapsed) {
				this.setNavCollapsed(false);
			}
			return;
		}

		const last = this.lastMainScrollTop;
		this.lastMainScrollTop = scrollTop;

		const delta = scrollTop - last;
		const hideThreshold = 6;
		const showThreshold = 1;

		if (delta > hideThreshold) {
			this.setNavCollapsed(true);
			return;
		}

		if (delta < -showThreshold) {
			this.setNavCollapsed(false);
		}
	}

	private scheduleLoadingReveal() {
		if (!this.state.showLoading || !this.state.hasDocument) {
			return;
		}
		if (this.loadingRafId !== null || this.loadingRafIdSecond !== null) {
			return;
		}
		this.loadingRafId = requestAnimationFrame(() => {
			this.loadingRafId = null;
			this.loadingRafIdSecond = requestAnimationFrame(() => {
				this.loadingRafIdSecond = null;
				if (!this.state.showLoading || !this.state.hasDocument) {
					return;
				}
				this.setState({ showLoading: false });
			});
		});
	}

	private handleSave() {
		if (this.state.mode === 'json') {
			const err = this.props.editor.applyJsonText(this.state.jsonText);
			if (err) {
				this.setState({ jsonError: err.message });
				return;
			}
		}
		const entry = this.props.editor.getCurrentEntry();
		if (!entry) {
			return;
		}
		msgHandler.send(OutgoingMessageType.SAVE, entry);
	}

	private handleSetMode = (mode: 'visual' | 'json') => {
		this.setMode(mode);
	};

	private handleSetFormat = (format: 'json' | 'lz') => {
		this.props.editor.setFormat(format);
	};

	private handleJsonTextChange = (text: string) => {
		this.setState({ jsonText: text, jsonError: undefined });
	};

	private handleDontAskAgainChange = (checked: boolean) => {
		this.setState({ dontAskAgainChecked: checked });
	};

	private handleOpenVSCodeSettings = () => {
		msgHandler.send(OutgoingMessageType.OPEN_VSCODE_SETTINGS, undefined);
	};

	private openExternalUrl = (url: ExternalUrlCode) => {
		msgHandler.send(OutgoingMessageType.OPEN_EXTERNAL_URL, url);
	};

	private handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const volume = parseFloat(event.target.value);
		this.setState({ audioVolume: volume, audioMuted: false });
		setAudioVolume(volume);
	};

	private handleVolumeMuteToggle = () => {
		this.setState((prev) => {
			const nextMuted = !prev.audioMuted;
			setAudioVolume(nextMuted ? 0 : prev.audioVolume);
			return { audioMuted: nextMuted };
		});
	};

	render() {
		const shellClassName = [
			'd-flex',
			'flex-column',
			'cgenh-app-shell',
		].filter(Boolean).join(' ');

		if (this.state.parseErrorText) {
			return (
				<div className="p-3">
					<div className="alert alert-danger mb-3" role="alert">
						{translation.app.unableToLoadEvents.getTrans()}
					</div>
					<pre className="small mb-0">{this.state.parseErrorText}</pre>
				</div>
			);
		}

		const showLoading = this.state.showLoading || !this.state.hasDocument;

		// Render the UI as soon as the events JSON is available.
		if (!this.state.hasDocument) {
			return <AppLoadingScreen overlay={false} />;
		}

		const formatValue = this.state.format === 'lz' ? 'lz' : 'json';
		const mainClassName = [
			'd-flex',
			'flex-column',
			'flex-grow-1',
			this.state.mode === 'json' ? 'overflow-hidden' : '',
			this.state.mode === 'json' ? 'cgenh-app-main--json' : '',
			'cgenh-app-main',
		].filter(Boolean).join(' ');
		const navHidden = this.state.mode === 'visual' ? this.state.navCollapsed : false;
		const navClassName = `cgenh-app-header cgenh-app-header--floating${navHidden ? ' cgenh-app-header--hidden' : ''}`;

		return (
			<div className={shellClassName}>
				<AppNavbar
					headerRef={this.headerRef}
					extraClassName={navClassName}
					mode={this.state.mode}
					formatValue={formatValue}
					eventsCount={this.state.eventsCount}
					language={this.state.language}
					audioVolume={this.state.audioVolume}
					audioMuted={this.state.audioMuted}
					onSetMode={this.handleSetMode}
					onSave={this.handleSave}
					onSetFormat={this.handleSetFormat}
					onSelectLanguage={this.handleLanguageSelect}
					onOpenExternalUrl={this.openExternalUrl}
					onOpenVSCodeSettings={this.handleOpenVSCodeSettings}
					onVolumeMuteToggle={this.handleVolumeMuteToggle}
					onVolumeChange={this.handleVolumeChange}
				/>
				<main ref={this.mainRef} className={mainClassName}>
					{this.state.mode === 'json' ? (
						<MonacoEditorComponent
							value={this.state.jsonText}
							error={this.state.jsonError}
							onChange={this.handleJsonTextChange}
							fill
						/>
					) : (
						<EventsEditorComponent
							key={this.getSelectedLanguageCode()}
							onEditAsJson={this.handleEditAsJson}
							scrollContainerRef={this.mainRef}
						/>
					)}
				</main>
				{showLoading && <AppLoadingScreen overlay />}
				<LanguageSyncDialog
					open={this.state.showLanguageSyncDialog}
					dontAskAgainChecked={this.state.dontAskAgainChecked}
					onDontAskAgainChange={this.handleDontAskAgainChange}
					onConfirm={this.handleLanguageSyncConfirm}
				/>
			</div>
		);
	}
}

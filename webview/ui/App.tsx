import { editorLangs, ExternalUrlCode, getByCode, getSelectedLanguage, IEditorLanguageCode, IEditorLanguageSetting, IIncomingMessageLanguageSyncData, IncomingMessageType, IOutgoingMessageLanguageSyncData, ISyncLanguageOptions, ObjectUtil, offLanguageChange, onLanguageChange, OutgoingMessageType, setLanguage } from '@shared';
import React from 'react';
import { CgEventsEditor, EditorChangeEvents, type EditorChangeEventType } from '../editor/CgEventsEditor';
import { getAudioVolume, setAudioVolume } from '../helper/sound';
import { msgHandler } from '../msg/MessageHandler';
import { winEE } from '../msg/WindowEventEmitter';
import { translation } from '../trans/Trans';
import { AppLoadingScreen } from './components/app/AppLoadingScreen';
import { resolveAppGlobalShortcut, resolveAppNavScrollState } from './AppInteraction';
import { AppNavbar } from './components/app/AppNavbar';
import { LanguageSyncDialog } from './components/app/LanguageSyncDialog';
import { MonacoEditorComponent } from './components/common/MonacoEditorComponent';
import { contextMenuStateManager } from './components/events/ContextMenuState';
import { AnimationFrameTask } from './utils/AnimationFrameTask';
import { ResizeObserverBinding } from './utils/ResizeObserverBinding';
import { EventsEditorComponent } from './components/events/EventsEditorComponent';

const EDITOR_SUMMARY_EVENTS: readonly EditorChangeEventType[] = [
	EditorChangeEvents.DOCUMENT_UPDATED,
	EditorChangeEvents.FORMAT_UPDATED,
	EditorChangeEvents.EVENT_ADDED,
	EditorChangeEvents.EVENT_REMOVED,
	EditorChangeEvents.EVENTS_REPLACED,
];

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
	private jsonEditorRef = React.createRef<MonacoEditorComponent>();
	private headerHeight = 0;
	private navOffsetPx = -1;
	private mainScrollbarWidth = 0;
	private readonly headerResizeBinding = new ResizeObserverBinding(() => {
		this.updateHeaderHeight();
		this.syncNavOffsetFromState();
	});
	private readonly mainContentResizeBinding = new ResizeObserverBinding(() => this.handleMainContentResize());
	private lastMainScrollTop = 0;
	private pendingMainScrollTop: number | null = null;
	private readonly scrollFrame = new AnimationFrameTask();
	private readonly mainResizeFrame = new AnimationFrameTask();
	private readonly loadingFrame = new AnimationFrameTask();
	private readonly loadingSecondFrame = new AnimationFrameTask();
	private readonly toolbarShiftFrame = new AnimationFrameTask();
	private readonly toolbarShiftSecondFrame = new AnimationFrameTask();
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
	}

	componentDidMount(): void {
		msgHandler.onIncoming(IncomingMessageType.LANGUAGE_SYNC, this.handleLanguageSync);
		onLanguageChange(this.handleLanguageChanged);
		this.attachEditorListeners();

		msgHandler.send(OutgoingMessageType.READY, undefined);
		this.ensureHeaderObserver();
		this.ensureMainContentObserver();
		this.updateMainScrollbarWidth();
		this.syncNavOffsetFromState();
		winEE.on('resize', this.handleWindowResize);
		winEE.on('scroll', this.handleWindowScroll);
		winEE.on('keydown', this.handleGlobalKeyDown);
		this.scheduleLoadingReveal();
	}

	componentWillUnmount(): void {
		this.detachEditorListeners(this.props.editor);
		this.headerResizeBinding.disconnect();
		this.mainContentResizeBinding.disconnect();
		this.scrollFrame.cancel();
		this.loadingFrame.cancel();
		this.loadingSecondFrame.cancel();
		this.mainResizeFrame.cancel();
		this.cancelToolbarShiftFrames();
		winEE.off('resize', this.handleWindowResize);
		winEE.off('scroll', this.handleWindowScroll);
		winEE.off('keydown', this.handleGlobalKeyDown);
		offLanguageChange(this.handleLanguageChanged);
		msgHandler.offIncoming(IncomingMessageType.LANGUAGE_SYNC, this.handleLanguageSync);
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
		for (const eventType of EDITOR_SUMMARY_EVENTS) {
			editor.on(eventType, this.handleEditorSummaryChange);
		}
	}

	private detachEditorListeners(editor: CgEventsEditor): void {
		if (!this.editorListenersAttached) {
			return;
		}
		this.editorListenersAttached = false;
		for (const eventType of EDITOR_SUMMARY_EVENTS) {
			editor.off(eventType, this.handleEditorSummaryChange);
		}
	}

	private handleEditorSummaryChange = () => {
		this.syncEditorSummary();
	};

	private ensureHeaderObserver() {
		const header = this.headerRef.current;
		if (!header) {
			this.headerResizeBinding.observe(null);
			return;
		}

		this.updateHeaderHeight();
		this.syncNavOffsetFromState();
		this.headerResizeBinding.observe(header);
	}

	private handleMainContentResize = () => {
		this.mainResizeFrame.schedule(() => this.updateMainScrollbarWidth());
	};

	private ensureMainContentObserver() {
		const content = this.mainRef.current?.firstElementChild ?? null;
		this.mainContentResizeBinding.observe(content);
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

	private isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) {
			return false;
		}
		if (target.isContentEditable) {
			return true;
		}
		return Boolean(target.closest('input, textarea, select, option, [contenteditable], .monaco-editor'));
	}

	private isPanelOpen(): boolean {
		return document.body.classList.contains('cgenh-has-modal-open') || document.querySelector('.modal.show, .modal-backdrop.show') !== null;
	}

	private handleGlobalKeyDown = (event: KeyboardEvent) => {
		const action = resolveAppGlobalShortcut({
			key: event.key,
			isComposing: event.isComposing,
			defaultPrevented: event.defaultPrevented,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
			shiftKey: event.shiftKey,
			panelOpen: this.isPanelOpen(),
			editableTarget: this.isEditableTarget(event.target),
		});
		if (!action) return;

		event.preventDefault();
		if (action === 'save') {
			this.handleSave();
			return;
		}
		if (action === 'undo') {
			this.props.editor.undo();
			return;
		}
		this.props.editor.redo();
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
		this.cancelToolbarShiftFrames();
		if (!shouldAnimateShift) {
			root.style.removeProperty('--cgenh-toolbar-shift-duration');
			root.style.setProperty('--cgenh-toolbar-shift', '0px');
		}
		if (shouldAnimateShift) {
			const delta = prev - next;
			root.style.setProperty('--cgenh-toolbar-shift-duration', '0ms');
			root.style.setProperty('--cgenh-toolbar-shift', `${delta}px`);
		}
		this.navOffsetPx = next;
		root.style.setProperty('--nav-offset', `${next}px`);
		if (shouldAnimateShift) {
			root.getBoundingClientRect();
			this.toolbarShiftFrame.schedule(() => {
				root.style.removeProperty('--cgenh-toolbar-shift-duration');
				root.getBoundingClientRect();
				this.toolbarShiftSecondFrame.schedule(() => {
					root.style.setProperty('--cgenh-toolbar-shift', '0px');
				});
			});
		}
	}

	private cancelToolbarShiftFrames(): void {
		this.toolbarShiftFrame.cancel();
		this.toolbarShiftSecondFrame.cancel();
	}

	private syncNavOffsetFromState() {
		this.syncNavOffset(this.state.navCollapsed);
	}

	private handleLanguageChanged = () => {
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

	private getLiveJsonText(): string {
		return this.jsonEditorRef.current?.getValue() ?? this.state.jsonText;
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
		const liveJsonText = this.getLiveJsonText();
		const error = this.props.editor.applyJsonText(liveJsonText);
		if (error) {
			this.setState({
				mode: 'json',
				jsonText: liveJsonText,
				jsonError: error.message || String(error),
			});
			return;
		}
		this.setState({
			mode: 'visual',
			jsonText: liveJsonText,
			jsonError: undefined,
		});
	}

	private handleEditAsJson = () => {
		this.setMode('json');
	};

	private handleWindowScroll = () => {
		contextMenuStateManager.closeAllContextMenus();
		const scrollingElement = document.scrollingElement;
		const scrollTop = scrollingElement instanceof HTMLElement ? scrollingElement.scrollTop : window.scrollY;
		this.pendingMainScrollTop = scrollTop;
		this.scrollFrame.schedule(() => {
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
		const next = resolveAppNavScrollState({
			mode: this.state.mode,
			scrollTop,
			lastScrollTop: this.lastMainScrollTop,
			headerHeight: this.headerHeight,
			navCollapsed: this.state.navCollapsed,
		});
		this.lastMainScrollTop = next.lastScrollTop;
		this.setNavCollapsed(next.navCollapsed);
	}

	private scheduleLoadingReveal() {
		if (!this.state.showLoading || !this.state.hasDocument) {
			return;
		}
		if (this.loadingFrame.scheduled || this.loadingSecondFrame.scheduled) {
			return;
		}
		this.loadingFrame.schedule(() => {
			this.loadingSecondFrame.schedule(() => {
				if (!this.state.showLoading || !this.state.hasDocument) {
					return;
				}
				this.setState({ showLoading: false });
			});
		});
	}

	private handleSave = () => {
		if (this.state.mode === 'json') {
			const jsonText = this.getLiveJsonText();
			const err = this.props.editor.applyJsonText(jsonText);
			if (err) {
				this.setState({ jsonText, jsonError: err.message });
				return;
			}
			if (jsonText !== this.state.jsonText || this.state.jsonError) {
				this.setState({ jsonText, jsonError: undefined });
			}
		}
		const entry = this.props.editor.getCurrentEntry();
		if (!entry) {
			return;
		}
		msgHandler.send(OutgoingMessageType.SAVE, entry);
	};

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
							ref={this.jsonEditorRef}
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
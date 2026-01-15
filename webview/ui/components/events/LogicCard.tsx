import { ObjectUtil, translateSchema } from '@shared';
import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { editor } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SvgEdit } from '../../svg/SvgEdit';
import { RJSFConfigsPanel } from '../../rjsf/RJSFConfigsPanel';
import { FormHistory } from '../../utils/formHistory';
import { handleUndoRedoShortcuts } from '../../utils/formUndoRedo';
import { acquireModalLock } from '../../utils/modalLock';
import { FormHistoryControls } from '../common/FormHistoryControls';
import { MonacoEditorComponent } from '../common/MonacoEditorComponent';

interface LogicCardProps {
	eventId: string;
	blockType: EventBlockType;
	logicIndex: number;
	schemaVersion?: number;
	children?: ReactNode;
	controls?: ReactNode;
	showEditButton?: boolean;
	openDetailNonce?: number;
}

interface LogicCardState {
	showDetail: boolean;
	draftData: any;
	jsonText: string;
	jsonError?: string;
	showJsonEditor: boolean;
}

interface LogicJsonDraft {
	jsonText: string;
	draftData: any;
}

interface PathChange {
	path: string[];
	value: any;
}

export class LogicCard extends React.PureComponent<LogicCardProps, LogicCardState> {
	private releaseModalLock: (() => void) | null = null;
	private formHistory: FormHistory<LogicJsonDraft> | null = null;
	private jsonContainerRef = React.createRef<HTMLDivElement>();
	private initialDataSnapshot: any = {};

	constructor(props: LogicCardProps) {
		super(props);
		this.state = { showDetail: false, draftData: {}, jsonText: '', jsonError: undefined, showJsonEditor: false };
	}

	componentDidMount(): void {
		winEE.on('keydown', this.handleKeyDown, this);
	}

	componentDidUpdate(prevProps: LogicCardProps, prevState: LogicCardState) {
		if (prevState.showDetail !== this.state.showDetail) {
			if (this.state.showDetail) {
				this.releaseModalLock = this.releaseModalLock ?? acquireModalLock();
			} else {
				this.releaseModalLock?.();
				this.releaseModalLock = null;
			}
		}

		if (this.props.openDetailNonce !== prevProps.openDetailNonce && this.props.openDetailNonce !== undefined) {
			this.openDetail();
		}
	}

	componentWillUnmount(): void {
		winEE.off('keydown', this.handleKeyDown, this);
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private handleKeyDown(event: KeyboardEvent) {
		const schema = editor.getSchema();
		const block = this.getBlock();
		const entryKey = block?.type ?? '';
		if (this.getCanEdit(schema, entryKey)) {
			return;
		}
		handleUndoRedoShortcuts(event, this.jsonContainerRef.current, this.handleUndo, this.handleRedo);
	}

	private cloneData(value: any): any {
		try {
			return JSON.parse(JSON.stringify(value));
		} catch {
			return value;
		}
	}

	private getCanEdit(schema: any, entryKey: string): boolean {
		return Boolean(schema && entryKey);
	}

	private getBlock() {
		return editor.getLogicBlock(this.props.eventId, this.props.blockType, this.props.logicIndex);
	}

	private getDisplayText(blockType: EventBlockType, key: string): string {
		const entry = editor.getSchema()?.[blockType]?.[key];
		if (!entry) {
			return `${translation.logic.unknownType.getTrans()} - ${key}`;
		}
		const localizedLabel = entry.label ? translateSchema(entry.label) : undefined;
		if (localizedLabel !== undefined) {
			const label = String(localizedLabel);
			if (label && entry.project) return `${entry.project} - ${label}`;
			return label;
		}
		if (entry.project) return entry.project;
		return key;
	}

	private openDetail = () => {
		const block = this.getBlock();
		if (!block) {
			return;
		}
		const data = block.data ?? {};
		const clonedData = this.cloneData(data);
		const jsonText = JSON.stringify(data, null, 2);
		const schema = editor.getSchema();
		const entryKey = block.type ?? '';
		const canEdit = this.getCanEdit(schema, entryKey);
		this.initialDataSnapshot = this.cloneData(data);
		if (!canEdit) {
			this.formHistory = new FormHistory({ jsonText, draftData: clonedData }, this.forceUpdate.bind(this));
		} else {
			this.formHistory = null;
		}
		this.setState({
			showDetail: true,
			draftData: clonedData,
			jsonText,
			jsonError: undefined,
			showJsonEditor: !canEdit,
		});
	};

	private closeDetail = () => {
		this.setState({ showDetail: false, draftData: {}, jsonError: undefined });
		this.formHistory = null;
	};

	private handleConfigPatch = (patch: any, entryKey?: string) => {
		if (!patch?.configs || !entryKey) return;
		if (!Object.prototype.hasOwnProperty.call(patch.configs, entryKey)) return;
		this.setState({ draftData: patch.configs[entryKey] || {} });
	};

	private collectChanges(previous: any, next: any, basePath: string[], changes: PathChange[]) {
		if (ObjectUtil.equals(previous, next)) {
			return;
		}
		const prevIsObject = previous && typeof previous === 'object' && !Array.isArray(previous);
		const nextIsObject = next && typeof next === 'object' && !Array.isArray(next);
		if (prevIsObject && nextIsObject) {
			const keys = new Set<string>([...Object.keys(previous), ...Object.keys(next)]);
			keys.forEach((key) => {
				this.collectChanges(previous[key], next[key], [...basePath, key], changes);
			});
			return;
		}
		changes.push({ path: basePath, value: next });
	}

	private commitDataUpdate(next: any) {
		const { eventId, blockType, logicIndex } = this.props;
		const changes: PathChange[] = [];
		this.collectChanges(this.initialDataSnapshot, next, [], changes);
		if (changes.length === 0) {
			return;
		}
		changes.forEach((change) => {
			editor.updateLogicField(eventId, blockType, logicIndex, change.path, change.value);
		});
	}

	private handleJsonChange = (text: string) => {
		const currentDraft = this.state.draftData;
		let nextDraft = currentDraft;
		let jsonError: string | undefined;
		try {
			const parsed = JSON.parse(text || '{}');
			nextDraft = parsed;
			jsonError = undefined;
		} catch (err) {
			jsonError = err instanceof Error ? err.message : String(err);
		}
		this.setState({ jsonText: text, jsonError, draftData: nextDraft });
	};

	private handleUndo = () => {
		this.commitJsonDraft();
		const snapshot = this.formHistory?.undo();
		if (!snapshot) return;
		this.setState({ jsonText: snapshot.jsonText, draftData: snapshot.draftData, jsonError: undefined });
	};

	private handleRedo = () => {
		this.commitJsonDraft();
		const snapshot = this.formHistory?.redo();
		if (!snapshot) return;
		this.setState({ jsonText: snapshot.jsonText, draftData: snapshot.draftData, jsonError: undefined });
	};

	private commitJsonDraft = () => {
		if (!this.formHistory) {
			return;
		}
		if (this.state.jsonError) {
			return;
		}
		this.formHistory.push({ jsonText: this.state.jsonText, draftData: this.state.draftData });
	};

	private handleJsonSave = () => {
		if (this.state.jsonError) {
			return;
		}
		this.commitDataUpdate(this.state.draftData);
		this.closeDetail();
	};

	render() {
		const { blockType: accent, controls, children, showEditButton = true } = this.props;
		const block = this.getBlock();
		if (!block) {
			return null;
		}
		const entryKey = block.type || '';
		const title = this.getDisplayText(accent, entryKey);
		const subtitle = '';
		const titleSeparator = ' - ';
		const titleSeparatorIndex = title.indexOf(titleSeparator);
		const titleContent: ReactNode = titleSeparatorIndex > 0 ? (
			<>
				<span className="cgenh-logic-card__project">{title.slice(0, titleSeparatorIndex)}</span>
				<span className="cgenh-logic-card__title-separator">{titleSeparator}</span>
				<span>{title.slice(titleSeparatorIndex + titleSeparator.length)}</span>
			</>
		) : title;
		const data = block.data;
		const disabled = data ? data['disabled'] === true : false;
		const schema = editor.getSchema();
		const canEdit = this.getCanEdit(schema, entryKey);
		const accentBorderClass =
			accent === 'trigger'
				? 'border-success'
				: accent === 'check'
					? 'border-warning'
					: accent === 'action'
						? 'border-info'
						: 'border-secondary';
		const cardClassName = [
			'card',
			'border-2',
			'cgenh-logic-card',
			accentBorderClass,
			disabled ? 'cgenh-logic-card--disabled' : '',
		].filter(Boolean).join(' ');
		const canUndo = this.formHistory?.canUndo() ?? false;
		const canRedo = this.formHistory?.canRedo() ?? false;
		const saveDisabled = !!this.state.jsonError;
		const resolvedEntryKey = entryKey;
		return (
			<>
				<div
					className={cardClassName}
					onDoubleClick={(e) => {
						const target = e.target;
						if (target instanceof Element && target.closest('button, a, input, textarea, select, option, [contenteditable]')) {
							return;
						}
						this.openDetail();
					}}
				>
					<div className="card-header py-0 ps-2 d-flex align-items-center justify-content-between gap-2 cgenh-logic-card__header">
						<div className="d-flex align-items-center gap-2 min-w-0 cgenh-logic-card__meta">
							<span className="fw-semibold text-truncate cgenh-logic-card__title">{titleContent}</span>
							{subtitle ? <span className="text-body-secondary small text-truncate cgenh-logic-card__subtitle">{subtitle}</span> : null}
							{disabled ? <span className="badge text-bg-secondary cgenh-disabled-badge">{translation.events.status.disabled.getTrans()}</span> : null}
						</div>
						<div className="d-flex align-items-center gap-1 flex-shrink-0 cgenh-card-actions">
							{controls}
							{showEditButton && (
								<button
									type="button"
									className="btn btn-sm cgenh-action-btn cgenh-action-btn--edit"
									onClick={this.openDetail}
									title={translation.common.edit.getTrans()}
									aria-label={translation.common.edit.getTrans()}
								>
									<SvgEdit aria-hidden="true" />
								</button>
							)}
						</div>
					</div>
					{children && (
						<div className="card-body p-2">
							{children}
						</div>
					)}
				</div>
				{this.state.showDetail && canEdit && resolvedEntryKey && createPortal(
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.closeDetail();
								}
							}}
						>
							<div
								className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable cgenh-modal-dialog"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<RJSFConfigsPanel
									schema={schema}
									schemaSection={this.props.blockType}
									configs={{ [resolvedEntryKey]: this.state.draftData }}
									configKey={resolvedEntryKey}
									onUpdate={(patch) => {
										this.handleConfigPatch(patch, resolvedEntryKey);
										if (patch?.configs && Object.prototype.hasOwnProperty.call(patch.configs, resolvedEntryKey)) {
											this.commitDataUpdate(patch.configs[resolvedEntryKey]);
											this.closeDetail();
										}
									}}
									onClose={this.closeDetail}
								/>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>,
					document.body,
				)}
				{this.state.showDetail && !canEdit && createPortal(
					<>
						<div
							className="modal show d-block"
							role="dialog"
							onMouseDown={(e) => {
								if (e.target === e.currentTarget) {
									this.closeDetail();
								}
							}}
						>
							<div
								className="modal-dialog modal-lg modal-dialog-centered cgenh-modal-dialog"
								role="document"
								onMouseDown={(e) => e.stopPropagation()}
							>
								<div ref={this.jsonContainerRef} className="modal-content d-flex flex-column h-100">
									<div className="modal-header d-flex align-items-center justify-content-between">
										<div className="min-w-0">
											<h5 className="modal-title mb-0 text-truncate">{title}</h5>
											{subtitle ? <p className="mb-0 mt-1 text-body-secondary small text-truncate">{subtitle}</p> : null}
										</div>
										<FormHistoryControls
											canUndo={canUndo}
											canRedo={canRedo}
											onUndo={this.handleUndo}
											onRedo={this.handleRedo}
										/>
									</div>
									<div
										className={[
											'modal-body',
											'flex-grow-1',
											'd-flex',
											'flex-column',
											'cgenh-modal-body',
											this.state.showJsonEditor ? 'cgenh-modal-body--flush' : '',
											this.state.showJsonEditor ? 'cgenh-modal-body--no-scroll' : 'cgenh-modal-body--scroll',
										].join(' ')}
									>
										{this.state.showJsonEditor ? (
											<MonacoEditorComponent
												className="flex-grow-1"
												value={this.state.jsonText}
												error={this.state.jsonError}
												onChange={this.handleJsonChange}
												onCommit={this.commitJsonDraft}
												compact
												fill
											/>
										) : (
											<pre className="mb-0 small font-monospace text-break">{this.state.jsonText}</pre>
										)}
									</div>
									<div className="modal-footer d-flex align-items-center justify-content-between">
										<button
											type="button"
											className="btn btn-sm btn-outline-secondary"
											onClick={() =>
												this.setState({
													showJsonEditor: !this.state.showJsonEditor,
													jsonError: undefined,
													jsonText: JSON.stringify(this.state.draftData ?? {}, null, 2),
												})
											}
										>
											{this.state.showJsonEditor ? translation.editor.backToVisual.getTrans() : translation.editor.editAsJson.getTrans()}
										</button>
										<div className="d-flex gap-2">
											<button type="button" className="btn btn-sm btn-outline-secondary" onClick={this.handleJsonSave} disabled={saveDisabled}>
												{translation.common.save.getTrans()}
											</button>
											<button type="button" className="btn btn-secondary" onClick={this.closeDetail}>
												{translation.common.close.getTrans()}
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div className="modal-backdrop show" />
					</>,
					document.body,
				)}
			</>
		);
	}
}

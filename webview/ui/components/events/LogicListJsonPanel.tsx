import { ICgEventLogicBlock } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { ebtConv, EventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { FormHistory } from '../../utils/formHistory';
import { handleUndoRedoShortcuts } from '../../utils/formUndoRedo';
import { cloneDraftSnapshot } from '../../utils/draftSnapshot';
import { acquireModalLock } from '../../utils/modalLock';
import { FormHistoryControls } from '../common/FormHistoryControls';
import { MonacoEditorComponent } from '../common/MonacoEditorComponent';
import { isLogicListSnapshotCurrent } from './LogicDataDraft';
import { normalizeLogicBlockList } from './LogicBlockData';
import { selectionStateManager } from './SelectionState';

interface LogicListJsonPanelProps {
	eventId: string;
	blockType: EventBlockType;
	onClose(): void;
}

interface LogicListJsonPanelState {
	jsonText: string;
	jsonError?: string;
}

interface LogicListJsonDraft {
	jsonText: string;
}

function parseBlocks(text: string): { blocks?: ICgEventLogicBlock[]; error?: string } {
	const rawText = text && text.trim() ? text : '[]';
	try {
		const parsed: unknown = JSON.parse(rawText);
		const blocks = normalizeLogicBlockList(parsed);
		return blocks
			? { blocks }
			: { error: translation.validation.invalidJson.getTrans() };
	} catch (err) {
		return { error: err instanceof Error ? err.message : translation.validation.invalidJson.getTrans() };
	}
}

export class LogicListJsonPanel extends React.PureComponent<LogicListJsonPanelProps, LogicListJsonPanelState> {
	private releaseModalLock: (() => void) | null = null;
	private formHistory: FormHistory<LogicListJsonDraft>;
	private containerRef = React.createRef<HTMLDivElement>();
	private jsonEditorRef = React.createRef<MonacoEditorComponent>();
	private initialBlocksSnapshot: ICgEventLogicBlock[];

	constructor(props: LogicListJsonPanelProps) {
		super(props);
		const initialBlocks = cloneDraftSnapshot(editor.getLogicBlocks(props.eventId, props.blockType));
		const jsonText = JSON.stringify(initialBlocks, null, 2);
		this.initialBlocksSnapshot = cloneDraftSnapshot(initialBlocks);
		this.formHistory = new FormHistory({ jsonText }, this.forceUpdate.bind(this));
		this.state = {
			jsonText,
			jsonError: undefined,
		};
	}

	componentDidMount(): void {
		this.releaseModalLock = acquireModalLock();
		winEE.on('keydown', this.handleKeyDown);
	}

	componentDidUpdate(prevProps: LogicListJsonPanelProps): void {
		if (prevProps.eventId === this.props.eventId && prevProps.blockType === this.props.blockType) {
			return;
		}

		const nextBlocks = cloneDraftSnapshot(editor.getLogicBlocks(this.props.eventId, this.props.blockType));
		const jsonText = JSON.stringify(nextBlocks, null, 2);
		this.initialBlocksSnapshot = cloneDraftSnapshot(nextBlocks);
		this.formHistory.reset({ jsonText });
		this.setState({ jsonText, jsonError: undefined });
	}

	componentWillUnmount(): void {
		winEE.off('keydown', this.handleKeyDown);
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private handleKeyDown = (event: KeyboardEvent) => {
		handleUndoRedoShortcuts(event, this.containerRef.current, this.handleUndo, this.handleRedo);
	};

	private getLiveJsonText(): string {
		return this.jsonEditorRef.current?.getValue() ?? this.state.jsonText;
	}

	private commitDraft = (text?: string) => {
		const jsonText = text ?? this.getLiveJsonText();
		const parsed = parseBlocks(jsonText);
		if (parsed.error) {
			return;
		}
		this.formHistory.push({ jsonText });
		if (jsonText !== this.state.jsonText) {
			this.setState({ jsonText, jsonError: undefined });
		}
	};

	private handleUndo = () => {
		this.commitDraft();
		const snapshot = this.formHistory.undo();
		if (!snapshot) {
			return;
		}
		this.setState({
			jsonText: snapshot.jsonText,
			jsonError: undefined,
		});
	};

	private handleRedo = () => {
		this.commitDraft();
		const snapshot = this.formHistory.redo();
		if (!snapshot) {
			return;
		}
		this.setState({
			jsonText: snapshot.jsonText,
			jsonError: undefined,
		});
	};

	private handleJsonChange = (text: string) => {
		const parsed = parseBlocks(text);
		if (parsed.error) {
			this.setState({ jsonText: text, jsonError: parsed.error });
			return;
		}
		this.setState({
			jsonText: text,
			jsonError: undefined,
		});
	};

	private handleSave = () => {
		const jsonText = this.getLiveJsonText();
		const parsed = parseBlocks(jsonText);
		if (parsed.error) {
			this.setState({ jsonText, jsonError: parsed.error });
			return;
		}
		const draftBlocks = parsed.blocks ?? [];
		const currentBlocks = editor.getLogicBlocks(this.props.eventId, this.props.blockType);
		if (!isLogicListSnapshotCurrent(this.initialBlocksSnapshot, currentBlocks)) {
			this.setState({ jsonText, jsonError: translation.validation.dataChanged.getTrans() });
			return;
		}
		this.formHistory.push({ jsonText });
		const blockKey = ebtConv.COMPLEX[this.props.blockType];
		editor.updateEvent(this.props.eventId, { [blockKey]: draftBlocks });
		selectionStateManager.clearSection(this.props.blockType);
		this.props.onClose();
	};

	render() {
		const canUndo = this.formHistory.canUndo();
		const canRedo = this.formHistory.canRedo();
		const title = translation.logic.blocks[this.props.blockType].getTrans();
		const saveDisabled = !!this.state.jsonError;

		return (
			<>
				<div
					className="modal show d-block"
					role="dialog"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) {
							this.props.onClose();
						}
					}}
				>
					<div
						className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable cgenh-modal-dialog"
						role="document"
						onMouseDown={(e) => e.stopPropagation()}
					>
						<div ref={this.containerRef} className="modal-content d-flex flex-column h-100">
							<div className="modal-header d-flex align-items-center justify-content-between">
								<div className="me-auto min-w-0">
									<div className="text-body-secondary small">{this.props.eventId}</div>
									<h5 className="modal-title mb-0 text-truncate">{title}</h5>
								</div>
								<FormHistoryControls
									canUndo={canUndo}
									canRedo={canRedo}
									onUndo={this.handleUndo}
									onRedo={this.handleRedo}
								/>
							</div>
							<div className="modal-body cgenh-modal-body cgenh-modal-body--no-scroll cgenh-modal-body--flush flex-grow-1 d-flex flex-column">
								<MonacoEditorComponent
									ref={this.jsonEditorRef}
									className="flex-grow-1"
									value={this.state.jsonText}
									error={this.state.jsonError}
									onChange={this.handleJsonChange}
									onCommit={this.commitDraft}
									fill
								/>
							</div>
							<div className="modal-footer d-flex align-items-center justify-content-end gap-2">
								<button type="button" className="btn btn-outline-secondary" onClick={this.handleSave} disabled={saveDisabled}>
									{translation.common.save.getTrans()}
								</button>
								<button type="button" className="btn btn-outline-secondary" onClick={this.props.onClose}>
									{translation.common.close.getTrans()}
								</button>
							</div>
						</div>
					</div>
				</div>
				<div className="modal-backdrop show" />
			</>
		);
	}
}

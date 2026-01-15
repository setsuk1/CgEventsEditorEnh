import { ICgEventLogicBlock } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { ebtConv, EventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { isRecord } from '../../rjsf/utils/rjsfUtils';
import { FormHistory } from '../../utils/formHistory';
import { handleUndoRedoShortcuts } from '../../utils/formUndoRedo';
import { acquireModalLock } from '../../utils/modalLock';
import { FormHistoryControls } from '../common/FormHistoryControls';
import { MonacoEditorComponent } from '../common/MonacoEditorComponent';

interface LogicListJsonPanelProps {
	eventId: string;
	blockType: EventBlockType;
	onClose(): void;
}

interface LogicListJsonPanelState {
	draftBlocks: ICgEventLogicBlock[];
	jsonText: string;
	jsonError?: string;
}

interface LogicListJsonDraft {
	draftBlocks: ICgEventLogicBlock[];
	jsonText: string;
}

function cloneBlocks(value: ICgEventLogicBlock[]): ICgEventLogicBlock[] {
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return Array.isArray(value) ? [...value] : [];
	}
}

function parseBlocks(text: string): { blocks?: ICgEventLogicBlock[]; error?: string } {
	const rawText = text && text.trim() ? text : '[]';
	try {
		const parsed: unknown = JSON.parse(rawText);
		if (!Array.isArray(parsed)) {
			return { error: translation.validation.invalidJson.getTrans() };
		}

		const blocks: ICgEventLogicBlock[] = [];
		for (const entry of parsed) {
			if (!isRecord(entry)) {
				return { error: translation.validation.invalidJson.getTrans() };
			}
			const type = typeof entry.type === 'string' ? entry.type.trim() : '';
			if (!type) {
				return { error: translation.validation.invalidJson.getTrans() };
			}

			const rawData = entry.data;
			if (rawData === undefined) {
				blocks.push({ type });
				continue;
			}
			if (!isRecord(rawData)) {
				return { error: translation.validation.invalidJson.getTrans() };
			}
			blocks.push({ type, data: rawData });
		}

		return { blocks };
	} catch (err) {
		return { error: err instanceof Error ? err.message : translation.validation.invalidJson.getTrans() };
	}
}

export class LogicListJsonPanel extends React.PureComponent<LogicListJsonPanelProps, LogicListJsonPanelState> {
	private releaseModalLock: (() => void) | null = null;
	private formHistory: FormHistory<LogicListJsonDraft>;
	private containerRef = React.createRef<HTMLDivElement>();

	constructor(props: LogicListJsonPanelProps) {
		super(props);
		const initialBlocks = cloneBlocks(editor.getLogicBlocks(props.eventId, props.blockType));
		const jsonText = JSON.stringify(initialBlocks, null, 2);
		this.formHistory = new FormHistory({ draftBlocks: initialBlocks, jsonText }, this.forceUpdate.bind(this));
		this.state = {
			draftBlocks: initialBlocks,
			jsonText,
			jsonError: undefined,
		};
	}

	componentDidMount(): void {
		this.releaseModalLock = acquireModalLock();
		winEE.on('keydown', this.handleKeyDown, this);
	}

	componentDidUpdate(prevProps: LogicListJsonPanelProps): void {
		if (prevProps.eventId === this.props.eventId && prevProps.blockType === this.props.blockType) {
			return;
		}

		const nextBlocks = cloneBlocks(editor.getLogicBlocks(this.props.eventId, this.props.blockType));
		const jsonText = JSON.stringify(nextBlocks, null, 2);
		this.formHistory.reset({ draftBlocks: nextBlocks, jsonText });
		this.setState({ draftBlocks: nextBlocks, jsonText, jsonError: undefined });
	}

	componentWillUnmount(): void {
		winEE.off('keydown', this.handleKeyDown, this);
		this.releaseModalLock?.();
		this.releaseModalLock = null;
	}

	private handleKeyDown(event: KeyboardEvent) {
		handleUndoRedoShortcuts(event, this.containerRef.current, this.handleUndo, this.handleRedo);
	}

	private commitDraft = (_text?: string) => {
		if (this.state.jsonError) {
			return;
		}
		this.formHistory.push({ draftBlocks: this.state.draftBlocks, jsonText: this.state.jsonText });
	};

	private handleUndo = () => {
		this.commitDraft();
		const snapshot = this.formHistory.undo();
		if (!snapshot) {
			return;
		}
		this.setState({
			draftBlocks: snapshot.draftBlocks,
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
			draftBlocks: snapshot.draftBlocks,
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
			draftBlocks: parsed.blocks ?? [],
		});
	};

	private handleSave = () => {
		if (this.state.jsonError) {
			return;
		}
		this.commitDraft();
		const blockKey = ebtConv.COMPLEX[this.props.blockType];
		editor.updateEvent(this.props.eventId, { [blockKey]: this.state.draftBlocks });
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

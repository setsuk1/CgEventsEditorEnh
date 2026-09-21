import { getSelectedLanguage } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SelectorPanel } from '../helpers/SelectorPanel';
import { AnimationFrameTask } from '../../utils/AnimationFrameTask';
import {
	appendLogicLibraryHistory,
	buildLogicLibraryBreadcrumbModel,
	buildLogicLibraryTree,
	getLogicLibraryChildNamesAtPathIndex,
	getLogicLibraryHistoryTarget,
	isLogicLibraryDropdownTarget,
	type LogicLibraryFolderNode,
	logicLibraryPathsEqual,
	resolveLogicLibraryBreadcrumbStep,
	resolveLogicLibraryPath,
	searchLogicLibraryFolders,
	searchLogicLibraryItems,
} from './LogicLibraryModel';

interface LogicLibraryPanelProps {
	open: boolean;
	title: string;
	blockType: EventBlockType;
	schemaVersion?: number;
	onSelect(type: string): void;
	onClose(): void;
}

interface LogicLibraryPanelState {
	search: string;
	path: string[];
	dropdownIdx: number | null;
	history: string[][];
	historyIdx: number;
	breadcrumbStartIndex: number;
}

export class LogicLibraryPanel extends React.PureComponent<LogicLibraryPanelProps, LogicLibraryPanelState> {
	state: LogicLibraryPanelState = {
		search: '',
		path: [],
		dropdownIdx: null,
		history: [[]],
		historyIdx: 0,
		breadcrumbStartIndex: 0,
	};

	private breadcrumbRef = React.createRef<HTMLDivElement>();
	private readonly breadcrumbFrame = new AnimationFrameTask();
	private lastBreadcrumbWidth = 0;
	private listenersAttached = false;
	private cachedTree?: LogicLibraryFolderNode;
	private cachedSchemaRef = editor.getSchema();
	private cachedSchemaVersion?: number;
	private cachedBlockType?: EventBlockType;
	private cachedLanguageCode?: string;

	private attachListeners(): void {
		if (this.listenersAttached) return;
		this.listenersAttached = true;
		document.addEventListener('mousedown', this.handleClickOutside, true);
		winEE.on('resize', this.handleWindowResize);
	}

	private detachListeners(): void {
		if (!this.listenersAttached) return;
		this.listenersAttached = false;
		document.removeEventListener('mousedown', this.handleClickOutside, true);
		winEE.off('resize', this.handleWindowResize);
	}

	private scheduleBreadcrumbMeasurement = () => {
		if (!this.props.open || typeof window === 'undefined') return;
		this.breadcrumbFrame.schedule(() => this.updateBreadcrumbVisibility());
	};

	private handleWindowResize = () => {
		this.scheduleBreadcrumbMeasurement();
	};

	componentDidMount() {
		if (this.props.open) {
			this.attachListeners();
			this.scheduleBreadcrumbMeasurement();
		}
	}

	componentWillUnmount() {
		this.detachListeners();
		this.breadcrumbFrame.cancel();
	}

	componentDidUpdate(prevProps: LogicLibraryPanelProps) {
		if (prevProps.open !== this.props.open) {
			if (this.props.open) {
				this.attachListeners();
			} else {
				this.detachListeners();
				this.breadcrumbFrame.cancel();
			}
		}
		if (prevProps.schemaVersion !== this.props.schemaVersion || prevProps.blockType !== this.props.blockType) {
			const resolved = resolveLogicLibraryPath(this.getTree(), this.state.path);
			this.setState({
				path: resolved.path,
				dropdownIdx: null as number | null,
				history: [resolved.path],
				historyIdx: 0,
				breadcrumbStartIndex: 0,
			});
		}
		this.scheduleBreadcrumbMeasurement();
	}

	private handleClickOutside = (event: MouseEvent) => {
		if (this.state.dropdownIdx === null) return;
		if (!isLogicLibraryDropdownTarget(event.target)) {
			this.setState({ dropdownIdx: null });
		}
	};

	private updateBreadcrumbVisibility() {
		if (!this.props.open) return;
		const container = this.breadcrumbRef.current;
		if (!container) return;

		const totalSegments = this.state.path.length + 1;
		const clientWidth = container.clientWidth;
		if (totalSegments <= 1) {
			if (this.state.breadcrumbStartIndex !== 0) {
				this.setState({ breadcrumbStartIndex: 0 });
			}
			this.lastBreadcrumbWidth = clientWidth;
			return;
		}

		const step = resolveLogicLibraryBreadcrumbStep({
			totalSegments,
			currentStartIndex: this.state.breadcrumbStartIndex,
			overflow: container.scrollWidth > clientWidth,
			clientWidth,
			lastMeasuredWidth: this.lastBreadcrumbWidth,
		});
		this.lastBreadcrumbWidth = step.nextMeasuredWidth;
		if (step.nextStartIndex !== this.state.breadcrumbStartIndex) {
			this.setState({ breadcrumbStartIndex: step.nextStartIndex });
		}
	}

	private getTree(): LogicLibraryFolderNode {
		const schemaRef = editor.getSchema();
		const languageCode = getSelectedLanguage().code;
		if (
			!this.cachedTree ||
			this.cachedSchemaRef !== schemaRef ||
			this.cachedSchemaVersion !== this.props.schemaVersion ||
			this.cachedBlockType !== this.props.blockType ||
			this.cachedLanguageCode !== languageCode
		) {
			this.cachedTree = buildLogicLibraryTree(schemaRef?.[this.props.blockType]);
			this.cachedSchemaRef = schemaRef;
			this.cachedSchemaVersion = this.props.schemaVersion;
			this.cachedBlockType = this.props.blockType;
			this.cachedLanguageCode = languageCode;
		}
		return this.cachedTree;
	}

	private renderFolderList(folders: Array<{ name: string; path: string[] }>) {
		if (!folders.length) return null;
		return (
			<div className="d-flex flex-wrap gap-2">
				{folders.map((f) => (
					<button
						key={f.path.join('/')}
						title={f.path.join('/')}
						type="button"
						className="btn btn-sm btn-outline-secondary"
						onClick={() => this.navigateTo(f.path)}
					>
						<span className="me-1">📁</span>
						{f.name}
					</button>
				))}
			</div>
		);
	}

	private navigateTo(newPath: string[]) {
		if (logicLibraryPathsEqual(this.state.path, newPath)) {
			this.setState({ dropdownIdx: null as number | null });
			return;
		}
		this.setState((prev) => ({
			path: newPath,
			...appendLogicLibraryHistory(prev, newPath),
			dropdownIdx: null as number | null,
			breadcrumbStartIndex: 0,
		}));
	}

	private getPathDisplayName(path: string[] | null): string {
		if (!path) return '';
		if (path.length === 0) return translation.navigation.root.getTrans();
		return path[path.length - 1];
	}

	private moveHistory(delta: -1 | 1): void {
		const target = getLogicLibraryHistoryTarget(this.state, delta);
		if (!target) return;
		this.setState({ ...target, dropdownIdx: null as number | null, breadcrumbStartIndex: 0 });
	}

	private toggleDropdown(idx: number) {
		this.setState((prev) => ({ dropdownIdx: prev.dropdownIdx === idx ? null : idx }));
	}

	private selectFromDropdown(idx: number, name: string) {
		const newPath = [...this.state.path.slice(0, idx), name];
		this.navigateTo(newPath);
	}

	private renderEllipsis(hiddenSegments: Array<{ label: string; path: string[] }>) {
		const isOpen = this.state.dropdownIdx === -1;
		return (
			<div key="ellipsis" className={`breadcrumb-item-custom dropdown ${isOpen ? 'show' : ''}`} data-index="-1">
				<span
					className="breadcrumb-segment"
					onClick={(e) => {
						e.stopPropagation();
						this.toggleDropdown(-1);
					}}
				>
					⋯
				</span>
				{isOpen && (
					<div className="dropdown-menu show position-absolute breadcrumb-dropdown-menu" onClick={(e) => e.stopPropagation()}>
						{hiddenSegments.map((seg, i) => (
							<button key={seg.label + '-' + i} type="button" className="dropdown-item" onClick={() => this.navigateTo(seg.path)}>
								📁 {seg.label}
							</button>
						))}
					</div>
				)}
			</div>
		);
	}

	private renderBreadcrumbSegment(
		tree: LogicLibraryFolderNode,
		idx: number,
		label: string,
		onClick: () => void,
		isCurrentFolder: boolean
	) {
		const children = getLogicLibraryChildNamesAtPathIndex(tree, this.state.path, idx);
		const hasChildren = children.length > 0;
		const isOpen = this.state.dropdownIdx === idx;

		return (
			<div
				key={`seg-${idx}`}
				className={`breadcrumb-item-custom dropdown ${isOpen ? 'show' : ''} ${isCurrentFolder ? 'current' : ''}`}
				data-index={idx}
			>
				<span
					className={`breadcrumb-segment ${isCurrentFolder ? 'current' : ''}`}
					onClick={(e) => {
						e.stopPropagation();
						onClick();
					}}
				>
					{label}
				</span>
				{hasChildren && (
					<span
						className="breadcrumb-separator"
						onClick={(e) => {
							e.stopPropagation();
							this.toggleDropdown(idx);
						}}
					>
						&gt;
					</span>
				)}
				{isOpen && hasChildren && (
					<div className="dropdown-menu show position-absolute breadcrumb-dropdown-menu" onClick={(e) => e.stopPropagation()}>
						{children.map((name) => (
							<button key={name} type="button" className="dropdown-item" onClick={() => this.selectFromDropdown(idx, name)}>
								📁 {name}
							</button>
						))}
					</div>
				)}
			</div>
		);
	}


	render() {
		if (!this.props.open) return null;

		const tree = this.getTree();
		const current = resolveLogicLibraryPath(tree, this.state.path).node;
		const isSearching = this.state.search.trim().length > 0;
		const currentFolders = Object.keys(current.children)
			.sort()
			.map((name) => ({ name, path: [...this.state.path, name] }));

		const searchFolders = isSearching ? searchLogicLibraryFolders(current, this.state.path, this.state.search) : [];
		const items = searchLogicLibraryItems(current, this.state.search);
		const breadcrumb = buildLogicLibraryBreadcrumbModel(
			this.state.path,
			this.state.breadcrumbStartIndex,
			translation.navigation.root.getTrans(),
		);
		const backTarget = getLogicLibraryHistoryTarget(this.state, -1);
		const forwardTarget = getLogicLibraryHistoryTarget(this.state, 1);
		const upPath = this.state.path.length > 0 ? this.state.path.slice(0, -1) : null;

		return (
			<SelectorPanel
				open
				onClose={this.props.onClose}
				cancelLabel={translation.common.close.getTrans()}
				confirmLabel={translation.common.close.getTrans()}
				onConfirm={this.props.onClose}
				showConfirm={false}
				showHeader={false}
				width="90vw"
				height="80vh"
			>
				<div className="d-flex flex-column gap-2 h-100">
					<div className="d-flex align-items-center gap-1">
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary border-0 px-2"
							onClick={() => this.moveHistory(-1)}
							disabled={!backTarget}
							title={backTarget ? translation.navigation.goBackTo.getTrans({ name: this.getPathDisplayName(backTarget.path) }) : undefined}
						>
							←
						</button>
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary border-0 px-2"
							onClick={() => this.moveHistory(1)}
							disabled={!forwardTarget}
							title={forwardTarget ? translation.navigation.goForwardTo.getTrans({ name: this.getPathDisplayName(forwardTarget.path) }) : undefined}
						>
							→
						</button>
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary border-0 px-2"
							onClick={() => upPath && this.navigateTo(upPath)}
							disabled={!upPath}
							title={upPath ? translation.navigation.goUpTo.getTrans({ name: this.getPathDisplayName(upPath) }) : undefined}
						>
							↑
						</button>
						<div className="d-flex align-items-center flex-grow-1 form-control form-control-sm cgenh-breadcrumb-bar" onClick={() => this.setState({ dropdownIdx: null as number | null })} ref={this.breadcrumbRef}>
							{breadcrumb.displayStartIndex > 0 && this.renderEllipsis(breadcrumb.hiddenSegments)}
							{breadcrumb.visibleSegments.map((segment) =>
								this.renderBreadcrumbSegment(
									tree,
									segment.index,
									segment.label,
									() => this.navigateTo(segment.path),
									segment.isCurrent,
								)
							)}
						</div>
						<input type="text" className="form-control form-control-sm ms-2 cgenh-breadcrumb-search" placeholder={translation.navigation.search.getTrans()} value={this.state.search} onChange={(e) => this.setState({ search: e.target.value })} />
					</div>

					{this.renderFolderList(currentFolders)}
					{isSearching && (
						<div className="d-flex align-items-center my-2">
							<div className="flex-grow-1 border-bottom border-secondary" />
							<span className="px-2 text-secondary small">{translation.navigation.searchResults.getTrans()}</span>
							<div className="flex-grow-1 border-bottom border-secondary" />
						</div>
					)}
					{isSearching && this.renderFolderList(searchFolders)}

					<div className="logic-library-grid overflow-auto flex-grow-1 align-content-start">
						{items.map((item) => (
							<div key={item.key} className="logic-library-cell">
								<button title={item.label || item.key} type="button" className="logic-library-item btn btn-outline-secondary w-100 text-start" onClick={() => this.props.onSelect(item.key)}>
									<span className="logic-library-text">{item.label || item.key}</span>
								</button>
							</div>
						))}
						{!items.length && <div className="logic-library-empty text-body-secondary small p-2">{translation.validation.noMatches.getTrans()}</div>}
					</div>
				</div>
			</SelectorPanel>
		);
	}
}

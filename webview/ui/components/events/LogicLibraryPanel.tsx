import { ICgEventsSchemaEntry, translateSchema } from '@shared';
import React from 'react';
import { editor } from '../../../editor/CgEventsEditor';
import { EventBlockType } from '../../../editor/eventBlockTypes';
import { winEE } from '../../../msg/WindowEventEmitter';
import { translation } from '../../../trans/Trans';
import { SelectorPanel } from '../helpers/SelectorPanel';

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

interface FolderNode {
	name: string;
	children: Record<string, FolderNode>;
	items: Array<{ key: string; label: string; path: string[] }>;
}

export class LogicLibraryPanel extends React.PureComponent<LogicLibraryPanelProps, LogicLibraryPanelState> {
	constructor(props: LogicLibraryPanelProps) {
		super(props);
		this.state = { search: '', path: [], dropdownIdx: null, history: [[]], historyIdx: 0, breadcrumbStartIndex: 0 };
		this.handleClickOutside = this.handleClickOutside.bind(this);
	}

	private breadcrumbRef = React.createRef<HTMLDivElement>();
	private breadcrumbMeasureScheduled = false;
	private lastBreadcrumbWidth = 0;

	private scheduleBreadcrumbMeasurement = () => {
		if (!this.props.open || this.breadcrumbMeasureScheduled || typeof window === 'undefined') return;
		this.breadcrumbMeasureScheduled = true;
		window.requestAnimationFrame(() => {
			this.breadcrumbMeasureScheduled = false;
			this.updateBreadcrumbVisibility();
		});
	};

	private handleWindowResize = () => {
		this.scheduleBreadcrumbMeasurement();
	};

	componentDidMount() {
		document.addEventListener('mousedown', this.handleClickOutside, true);
		winEE.on('resize', this.handleWindowResize, this);
		this.scheduleBreadcrumbMeasurement();
	}

	componentWillUnmount() {
		document.removeEventListener('mousedown', this.handleClickOutside, true);
		winEE.off('resize', this.handleWindowResize, this);
	}

	componentDidUpdate() {
		this.scheduleBreadcrumbMeasurement();
	}

	private handleClickOutside(e: MouseEvent) {
		if (this.state.dropdownIdx !== null) {
			if (e.target instanceof HTMLElement) {
				const closest = e.target.closest('.breadcrumb-item-custom.dropdown');
				if (!closest) {
					this.setState({ dropdownIdx: null });
				}
			}
		}
	}

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

		const overflow = container.scrollWidth > clientWidth;
		let nextStart = this.state.breadcrumbStartIndex;
		let changed = false;
		if (overflow && nextStart < totalSegments - 1) {
			nextStart += 1;
			changed = true;
		} else if (!overflow && nextStart > 0 && clientWidth > this.lastBreadcrumbWidth) {
			nextStart -= 1;
			changed = true;
		}

		this.lastBreadcrumbWidth = clientWidth;
		if (changed) {
			this.setState({ breadcrumbStartIndex: nextStart });
		}
	}

	private buildLabel(entry: ICgEventsSchemaEntry): string | undefined {
		const localized = translateSchema(entry.label);
		if (localized !== undefined) {
			return localized;
		}
		const fallback = entry?.className;
		return fallback !== undefined ? String(fallback) : undefined;
	}

	private getFolderPath(entry: ICgEventsSchemaEntry): string[] {
		const rawAllpaths = entry.allpaths;

		// allpaths can be a locale map or a string[] of path strings
		const parseFirstPath = (value: unknown): string[] | undefined => {
			if (!Array.isArray(value) || !value.length) return undefined;

			// allpaths locale value can be an array of arrays of strings or array of path strings
			// Prefer first sub-array if present; otherwise first string path
			const firstArray = value.find((v) => Array.isArray(v) && v.every((s) => typeof s === 'string'));
			if (firstArray && firstArray.length) {
				return firstArray.filter(Boolean);
			}
			const firstString = value.find((v) => typeof v === 'string' && v.trim());
			if (firstString) {
				return firstString.split('/').filter(Boolean);
			}
			return undefined;
		};

		if (rawAllpaths && typeof rawAllpaths === 'object' && !Array.isArray(rawAllpaths)) {
			const allpathsMap: Record<string, string[]> = {};
			for (const [key, value] of Object.entries(rawAllpaths)) {
				const parsed = parseFirstPath(value);
				if (parsed && parsed.length) {
					allpathsMap[key] = parsed;
				}
			}
			const preferred = Object.keys(allpathsMap).length > 0 ? translateSchema(allpathsMap) : undefined;
			if (preferred && preferred.length) {
				return preferred;
			}
			const fallbackAny = Object.values(allpathsMap).find((p) => p.length);
			if (fallbackAny) {
				return fallbackAny;
			}
		}

		const directPath = parseFirstPath(rawAllpaths);
		if (directPath) return directPath;
		if (entry.project) return [entry.project];
		return ['root'];
	}

	private getEntries() {
		const entries = editor.getSchema()?.[this.props.blockType];
		if (!entries) {
			return []
		};
		return Object.entries(entries)
			.map(([key, entry]) => !entry.deprecated && { key, entry })
			.filter(Boolean);
	}

	private buildTree() {
		const root: FolderNode = { name: 'root', children: {}, items: [] };
		this.getEntries().forEach(({ key, entry }) => {
			const path = this.getFolderPath(entry);
			const label = this.buildLabel(entry) ?? key;
			let node = root;
			path.forEach((segment) => {
				if (!node.children[segment]) {
					node.children[segment] = { name: segment, children: {}, items: [] };
				}
				node = node.children[segment];
			});
			node.items.push({ key, label, path });
		});
		return root;
	}

	private getCurrentNode(tree: FolderNode) {
		let node = tree;
		for (const seg of this.state.path) {
			if (node.children[seg]) {
				node = node.children[seg];
			}
		}
		return node;
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

	private arraysEqual(a: string[], b: string[]): boolean {
		return a.length === b.length && a.every((v, i) => v === b[i]);
	}

	private navigateTo(newPath: string[]) {
		// Don't record history if navigating to the same path
		if (this.arraysEqual(this.state.path, newPath)) {
			this.setState({ dropdownIdx: null });
			return;
		}
		this.setState((prev) => {
			const newHistory = [...prev.history.slice(0, prev.historyIdx + 1), newPath];
			return {
				path: newPath,
				history: newHistory,
				historyIdx: newHistory.length - 1,
				dropdownIdx: null,
				breadcrumbStartIndex: 0,
			};
		});
	}

	private enterFolder(name: string) {
		this.navigateTo([...this.state.path, name]);
	}

	private goUp() {
		if (this.state.path.length > 0) {
			this.navigateTo(this.state.path.slice(0, -1));
		}
	}

	private canGoBack() {
		return this.state.historyIdx > 0;
	}

	private canGoForward() {
		return this.state.historyIdx < this.state.history.length - 1;
	}

	private getBackPath(): string[] | null {
		if (!this.canGoBack()) return null;
		return this.state.history[this.state.historyIdx - 1];
	}

	private getForwardPath(): string[] | null {
		if (!this.canGoForward()) return null;
		return this.state.history[this.state.historyIdx + 1];
	}

	private getUpPath(): string[] | null {
		if (this.state.path.length === 0) return null;
		return this.state.path.slice(0, -1);
	}

	private getPathDisplayName(path: string[] | null): string {
		if (!path) return '';
		if (path.length === 0) return translation.navigation.root.getTrans();
		return path[path.length - 1];
	}

	private goBack() {
		if (!this.canGoBack()) return;
		const newIdx = this.state.historyIdx - 1;
		this.setState({ path: this.state.history[newIdx], historyIdx: newIdx, dropdownIdx: null, breadcrumbStartIndex: 0 });
	}

	private goForward() {
		if (!this.canGoForward()) return;
		const newIdx = this.state.historyIdx + 1;
		this.setState({ path: this.state.history[newIdx], historyIdx: newIdx, dropdownIdx: null, breadcrumbStartIndex: 0 });
	}

	private getChildrenAtPathIndex(tree: FolderNode, idx: number): string[] {
		let node = tree;
		for (let i = 0; i < idx; i++) {
			const seg = this.state.path[i];
			if (node.children[seg]) {
				node = node.children[seg];
			}
		}
		return Object.keys(node.children).sort();
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
			<div
				key="ellipsis"
				className={`breadcrumb-item-custom dropdown ${isOpen ? 'show' : ''}`}
				data-index="-1"
			>
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
					<div
						className="dropdown-menu show position-absolute breadcrumb-dropdown-menu"
						onClick={(e) => e.stopPropagation()}
					>
						{hiddenSegments.map((seg, i) => (
							<button
								key={seg.label + '-' + i}
								type="button"
								className="dropdown-item"
								onClick={() => this.navigateTo(seg.path)}
							>
								📁 {seg.label}
							</button>
						))}
					</div>
				)}
			</div>
		);
	}

	private renderBreadcrumbSegment(
		tree: FolderNode,
		idx: number,
		label: string,
		onClick: () => void,
		isCurrentFolder: boolean
	) {
		const children = this.getChildrenAtPathIndex(tree, idx);
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
					<div
						className="dropdown-menu show position-absolute breadcrumb-dropdown-menu"
						onClick={(e) => e.stopPropagation()}
					>
						{children.map((name) => (
							<button
								key={name}
								type="button"
								className="dropdown-item"
								onClick={() => this.selectFromDropdown(idx, name)}
							>
								📁 {name}
							</button>
						))}
					</div>
				)}
			</div>
		);
	}

	private filteredFolders(node: FolderNode) {
		const term = this.state.search.trim().toLowerCase();
		if (!term) return [];

		const visited = new Set<FolderNode>();
		const results: Array<{ name: string; path: string[] }> = [];
		const traverse = (n: FolderNode, currentPath: string[]) => {
			if (visited.has(n)) return;
			visited.add(n);

			if (n.name !== 'root' && n.name.toLowerCase().includes(term)) {
				results.push({ name: n.name, path: currentPath });
			}
			Object.entries(n.children).forEach(([name, child]) => {
				traverse(child, [...currentPath, name]);
			});
		};

		Object.entries(node.children).forEach(([name, child]) => {
			traverse(child, [...this.state.path, name]);
		});

		return results;
	}

	private filteredItems(node: FolderNode) {
		const term = this.state.search.trim().toLowerCase();
		const items = [...node.items];
		const visited = new Set<FolderNode>();
		visited.add(node);

		const collect = (child: FolderNode) => {
			if (visited.has(child)) return;
			visited.add(child);

			items.push(...child.items);
			Object.values(child.children).forEach((c) => collect(c));
		};
		Object.values(node.children).forEach((c) => collect(c));
		return term ? items.filter((it) => it.label.toLowerCase().includes(term) || it.key.toLowerCase().includes(term)) : items;
	}

	render() {
		if (!this.props.open) return null;

		const tree = this.buildTree();
		const current = this.getCurrentNode(tree);
		const isSearching = this.state.search.trim().length > 0;

		const currentFolders = Object.keys(current.children)
			.sort()
			.map((name) => ({
				name,
				path: [...this.state.path, name],
			}));

		let searchFolders: Array<{ name: string; path: string[] }> = [];
		let items: Array<any> = [];

		if (isSearching) {
			searchFolders = this.filteredFolders(current);
		}
		items = this.filteredItems(current);

		const pathLen = this.state.path.length;
		const totalSegments = pathLen + 1;
		const maxStartIdx = Math.max(0, totalSegments - 1);
		const displayStartIdx = Math.min(Math.max(this.state.breadcrumbStartIndex, 0), maxStartIdx);
		const hiddenSegments: Array<{ label: string; path: string[] }> = [];
		for (let idx = 0; idx < displayStartIdx; idx++) {
			hiddenSegments.push({
				label: idx === 0 ? translation.navigation.root.getTrans() : this.state.path[idx - 1],
				path: idx === 0 ? [] : this.state.path.slice(0, idx),
			});
		}
		const visibleIndexes: number[] = [];
		const firstVisibleIdx = displayStartIdx === 0 ? 0 : displayStartIdx;
		for (let idx = firstVisibleIdx; idx < totalSegments; idx++) {
			visibleIndexes.push(idx);
		}

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
						{/* Navigation buttons */}
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary border-0 px-2"
							onClick={() => this.goBack()}
							disabled={!this.canGoBack()}
							title={this.canGoBack() ? translation.navigation.goBackTo.getTrans({ name: this.getPathDisplayName(this.getBackPath()) }) : undefined}
						>
							←
						</button>
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary border-0 px-2"
							onClick={() => this.goForward()}
							disabled={!this.canGoForward()}
							title={this.canGoForward() ? translation.navigation.goForwardTo.getTrans({ name: this.getPathDisplayName(this.getForwardPath()) }) : undefined}
						>
							→
						</button>
						<button
							type="button"
							className="btn btn-sm btn-outline-secondary border-0 px-2"
							onClick={() => this.goUp()}
							disabled={this.state.path.length === 0}
							title={this.state.path.length > 0 ? translation.navigation.goUpTo.getTrans({ name: this.getPathDisplayName(this.getUpPath()) }) : undefined}
						>
							↑
						</button>
						{/* Breadcrumb path */}
						<div
							className="d-flex align-items-center flex-grow-1 form-control form-control-sm cgenh-breadcrumb-bar"
							onClick={() => this.setState({ dropdownIdx: null })}
							ref={this.breadcrumbRef}
						>
							{displayStartIdx > 0 && this.renderEllipsis(hiddenSegments)}
							{visibleIndexes.map((idx) => {
								const label = idx === 0 ? translation.navigation.root.getTrans() : this.state.path[idx - 1];
								const childPath = idx === 0 ? [] : this.state.path.slice(0, idx);
								return this.renderBreadcrumbSegment(
									tree,
									idx,
									label,
									() => this.navigateTo(childPath),
									idx === totalSegments - 1
								);
							})}
						</div>
						{/* Search box */}
						<input
							type="text"
							className="form-control form-control-sm ms-2 cgenh-breadcrumb-search"
							placeholder={translation.navigation.search.getTrans()}
							value={this.state.search}
							onChange={(e) => this.setState({ search: e.target.value })}
						/>
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
								<button
									title={item.label || item.key}
									type="button"
									className="logic-library-item btn btn-outline-secondary w-100 text-start"
									onClick={() => this.props.onSelect(item.key)}
								>
									<span className="logic-library-text">{item.label || item.key}</span>
								</button>
							</div>
						))}
						{!items.length && (
							<div className="logic-library-empty text-body-secondary small p-2">
								{translation.validation.noMatches.getTrans()}
							</div>
						)}
					</div>
				</div>
			</SelectorPanel>
		);
	}
}

import React from 'react';
import {
	editor,
	EditorChangeEvents,
	type EditorChangeEventPayload,
	type EditorChangeEventType,
} from '../../../editor/CgEventsEditor';
import { winEE } from '../../../msg/WindowEventEmitter';
import { dragStateManager } from './DragState';
import { EventComponent } from './EventComponent';
import { eventCardUiStateStore } from './EventCardUiStateStore';
import { AnimationFrameTask } from '../../utils/AnimationFrameTask';
import { stringArraysEqual } from './EventsDisplay';
import {
	buildVirtualListLayout,
	estimateVirtualEventHeight,
	computeVirtualListPadding,
	computeVirtualListRange,
	resolveVirtualResizeBaselineHeight,
} from './VirtualListMath';

interface VirtualizedEventsListProps {
	scrollContainerRef: React.RefObject<HTMLElement>;
	eventIds: string[];
	totalEventCount: number;
	onEditAsJson(): void;
	getEventRef(eventId: string): React.RefObject<EventComponent>;
}

interface VirtualizedEventsListState {
	rangeStart: number;
	rangeEnd: number;
}

interface MeasuredHeightEntry {
	height: number;
	collapsed: boolean;
}

const INITIAL_RENDER_COUNT = 18;
const OVERSCAN_COUNT = 6;
const LOGIC_LAYOUT_CHANGE_EVENTS: readonly EditorChangeEventType[] = [
	EditorChangeEvents.ACTION_ADDED,
	EditorChangeEvents.ACTION_UPDATED,
	EditorChangeEvents.ACTION_REMOVED,
	EditorChangeEvents.ACTION_MOVED,
	EditorChangeEvents.CHECK_ADDED,
	EditorChangeEvents.CHECK_UPDATED,
	EditorChangeEvents.CHECK_REMOVED,
	EditorChangeEvents.CHECK_MOVED,
	EditorChangeEvents.TRIGGER_ADDED,
	EditorChangeEvents.TRIGGER_UPDATED,
	EditorChangeEvents.TRIGGER_REMOVED,
	EditorChangeEvents.TRIGGER_MOVED,
];


export class VirtualizedEventsList extends React.Component<VirtualizedEventsListProps, VirtualizedEventsListState> {
	private containerRef: React.RefObject<HTMLDivElement> = React.createRef();
	private scrollElement: HTMLElement | null = null;
	private elementScrollListenerTarget: HTMLElement | null = null;
	private scrollResizeObserver: ResizeObserver | null = null;
	private itemResizeObserver: ResizeObserver | null = null;
	private windowListenersAttached = false;
	private readonly updateFrame = new AnimationFrameTask();
	private cacheDirty = true;
	private gapPx = 0;
	private totalHeightPx = 0;
	private prefixSums: number[] = [0];
	private indexById = new Map<string, number>();
	private measuredById = new Map<string, MeasuredHeightEntry>();
	private elementById = new Map<string, HTMLElement>();
	private idByElement = new Map<HTMLElement, string>();
	private dragPinnedEventId: string | null = null;

	constructor(props: VirtualizedEventsListProps) {
		super(props);
		const end = Math.min(props.eventIds.length, INITIAL_RENDER_COUNT);
		this.state = { rangeStart: 0, rangeEnd: end };
	}

	public invalidateLayout(): void {
		this.cacheDirty = true;
		this.scheduleUpdate();
	}

	public scrollToEventId(eventId: string): boolean {
		const trimmed = eventId.trim();
		if (!trimmed) {
			return false;
		}
		if (!this.scrollElement) {
			this.attachScrollContainer();
		}
		const scrollElement = this.scrollElement;
		const container = this.containerRef.current;
		if (!scrollElement || !container) {
			return false;
		}
		const index = this.indexById.get(trimmed);
		if (index === undefined) {
			return false;
		}
		this.updateGapFromComputedStyle(container);
		this.ensureCache();
		const scrollTop = this.getScrollTop(scrollElement);
		const listTop = this.getListTopOffset(scrollElement, container, scrollTop);
		const offset = this.prefixSums[index] ?? 0;
		const nextScrollTop = Math.max(0, listTop + offset);
		if (scrollTop !== nextScrollTop) {
			this.setScrollTop(scrollElement, nextScrollTop);
		}
		this.scheduleUpdate();
		return true;
	}

	componentDidMount(): void {
		this.rebuildIndexById();
		this.ensureItemResizeObserver();
		this.attachWindowListeners();
		this.attachEditorLayoutListeners();
		this.attachScrollContainer();
		dragStateManager.on('change', this.handleDragStateChange);
		this.scheduleUpdate();
	}

	componentDidUpdate(prevProps: VirtualizedEventsListProps): void {
		const prevIds = prevProps.eventIds;
		const nextIds = this.props.eventIds;
		const eventIdsChanged = !stringArraysEqual(prevIds, nextIds);
		if (eventIdsChanged) {
			this.rebuildIndexById();
			this.cacheDirty = true;

			if (this.state.rangeEnd === 0 && nextIds.length > 0) {
				const end = Math.min(nextIds.length, INITIAL_RENDER_COUNT);
				if (end !== this.state.rangeEnd) {
					this.setState({ rangeStart: 0, rangeEnd: end });
				}
			}

			let removed = false;
			for (let i = 0; i < prevIds.length; i++) {
				if (!this.indexById.has(prevIds[i])) {
					removed = true;
					break;
				}
			}

			if (removed) {
				this.pruneMeasurements();
			}
			if (this.dragPinnedEventId && !this.indexById.has(this.dragPinnedEventId)) {
				this.dragPinnedEventId = null;
			}
		}
		this.attachScrollContainer();
		this.scheduleUpdate();
	}

	componentWillUnmount(): void {
		this.detachWindowListeners();
		this.detachEditorLayoutListeners();
		this.detachScrollContainer();
		dragStateManager.off('change', this.handleDragStateChange);
		this.itemResizeObserver?.disconnect();
		this.itemResizeObserver = null;
		this.updateFrame.cancel();
		this.elementById.clear();
		this.idByElement.clear();
	}

	private attachEditorLayoutListeners(): void {
		for (const eventType of LOGIC_LAYOUT_CHANGE_EVENTS) {
			editor.on(eventType, this.handleEditorLayoutChange);
		}
		editor.on(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentLayoutChange);
	}

	private detachEditorLayoutListeners(): void {
		for (const eventType of LOGIC_LAYOUT_CHANGE_EVENTS) {
			editor.off(eventType, this.handleEditorLayoutChange);
		}
		editor.off(EditorChangeEvents.DOCUMENT_UPDATED, this.handleDocumentLayoutChange);
	}

	private handleEditorLayoutChange = (payload?: EditorChangeEventPayload) => {
		const eventId = payload?.eventId;
		if (!eventId) {
			return;
		}
		this.measuredById.delete(eventId);
		if (!this.indexById.has(eventId)) {
			return;
		}
		this.cacheDirty = true;
		this.scheduleUpdate();
	};

	private handleDocumentLayoutChange = () => {
		this.measuredById.clear();
		this.cacheDirty = true;
		this.scheduleUpdate();
	};

	private attachWindowListeners(): void {
		if (this.windowListenersAttached) {
			return;
		}
		this.windowListenersAttached = true;
		winEE.on('scroll', this.handleScroll);
		winEE.on('resize', this.scheduleUpdate);
	}

	private detachWindowListeners(): void {
		if (!this.windowListenersAttached) {
			return;
		}
		this.windowListenersAttached = false;
		winEE.off('scroll', this.handleScroll);
		winEE.off('resize', this.scheduleUpdate);
	}

	private handleDragStateChange = () => {
		const dragState = dragStateManager.getState();
		const nextPinnedEventId = dragState.isDragging ? dragState.eventId : null;
		if (nextPinnedEventId === this.dragPinnedEventId) {
			return;
		}
		this.dragPinnedEventId = nextPinnedEventId;
		this.scheduleUpdate();
	};

	private rebuildIndexById(): void {
		this.indexById.clear();
		for (let i = 0; i < this.props.eventIds.length; i++) {
			this.indexById.set(this.props.eventIds[i], i);
		}
	}

	private pruneMeasurements(): void {
		const keep = new Set(this.props.eventIds);
		for (const id of this.measuredById.keys()) {
			if (!keep.has(id)) {
				this.measuredById.delete(id);
			}
		}
		for (const id of this.elementById.keys()) {
			if (!keep.has(id)) {
				const element = this.elementById.get(id);
				if (element) {
					this.itemResizeObserver?.unobserve(element);
					this.idByElement.delete(element);
				}
				this.elementById.delete(id);
			}
		}
	}

	private findFallbackScrollContainer(): HTMLElement | null {
		const container = this.containerRef.current;
		if (!container) {
			return null;
		}
		let current: HTMLElement | null = container.parentElement;
		while (current) {
			const style = getComputedStyle(current);
			const overflowY = style.overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') {
				return current;
			}
			current = current.parentElement;
		}
		return this.getDocumentScrollElement(container.ownerDocument);
	}

	private isScrollableElement(element: HTMLElement): boolean {
		if (this.isDocumentScrollElement(element)) {
			return true;
		}
		const overflowY = getComputedStyle(element).overflowY;
		return overflowY === 'auto' || overflowY === 'scroll';
	}

	private getDocumentScrollElement(documentRef: Document | null | undefined): HTMLElement | null {
		if (!documentRef) {
			return null;
		}
		const scrollingElement = documentRef.scrollingElement;
		if (scrollingElement instanceof HTMLElement) {
			return scrollingElement;
		}
		const documentElement = documentRef.documentElement;
		if (documentElement instanceof HTMLElement) {
			return documentElement;
		}
		const body = documentRef.body;
		return body instanceof HTMLElement ? body : null;
	}

	private isDocumentScrollElement(element: HTMLElement): boolean {
		const doc = element.ownerDocument;
		const scrollingElement = doc ? doc.scrollingElement : null;
		if (scrollingElement instanceof HTMLElement && scrollingElement === element) {
			return true;
		}
		const documentElement = doc ? doc.documentElement : null;
		if (documentElement instanceof HTMLElement && documentElement === element) {
			return true;
		}
		const body = doc ? doc.body : null;
		return body instanceof HTMLElement && body === element;
	}

	private attachScrollContainer(): void {
		const preferred = this.props.scrollContainerRef.current;
		const element = preferred && this.isScrollableElement(preferred) ? preferred : this.findFallbackScrollContainer();
		if (!element) {
			return;
		}
		if (this.scrollElement && this.scrollElement !== element) {
			this.detachScrollContainer();
		}
		if (this.scrollElement === element) {
			return;
		}
		this.scrollElement = element;
		this.attachElementScrollListener(element);
		this.attachScrollResizeObserver(element);
	}

	private detachScrollContainer(): void {
		if (!this.scrollElement) {
			return;
		}
		this.detachElementScrollListener();
		this.scrollResizeObserver?.disconnect();
		this.scrollResizeObserver = null;
		this.scrollElement = null;
	}

	private attachScrollResizeObserver(element: HTMLElement): void {
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		if (this.scrollResizeObserver) {
			return;
		}
		this.scrollResizeObserver = new ResizeObserver(() => this.scheduleUpdate());
		this.scrollResizeObserver.observe(element);
	}

	private ensureItemResizeObserver(): void {
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		if (this.itemResizeObserver) {
			return;
		}
		this.itemResizeObserver = new ResizeObserver((entries) => this.handleItemResize(entries));
	}

	private handleScroll = () => this.scheduleUpdate();
	private handleElementScroll = () => this.scheduleUpdate();

	private attachElementScrollListener(element: HTMLElement): void {
		if (this.isDocumentScrollElement(element)) {
			this.detachElementScrollListener();
			return;
		}
		if (this.elementScrollListenerTarget === element) {
			return;
		}
		this.detachElementScrollListener();
		element.addEventListener('scroll', this.handleElementScroll, { passive: true });
		this.elementScrollListenerTarget = element;
	}

	private detachElementScrollListener(): void {
		const target = this.elementScrollListenerTarget;
		if (!target) {
			return;
		}
		target.removeEventListener('scroll', this.handleElementScroll);
		this.elementScrollListenerTarget = null;
	}

	private scheduleUpdate = (): void => {
		if (!this.scrollElement) {
			this.attachScrollContainer();
		}
		this.updateFrame.schedule(() => this.updateVisibleRange());
	};

	private getScrollTop(scrollElement: HTMLElement): number {
		if (!this.isDocumentScrollElement(scrollElement)) {
			return scrollElement.scrollTop;
		}
		const doc = scrollElement.ownerDocument;
		const scrollingElement = doc ? doc.scrollingElement : null;
		if (scrollingElement instanceof HTMLElement) {
			return scrollingElement.scrollTop;
		}
		const view = doc ? doc.defaultView : null;
		return view ? view.scrollY : scrollElement.scrollTop;
	}

	private setScrollTop(scrollElement: HTMLElement, scrollTop: number): void {
		const top = Math.max(0, scrollTop);
		if (!this.isDocumentScrollElement(scrollElement)) {
			scrollElement.scrollTop = top;
			return;
		}
		const doc = scrollElement.ownerDocument;
		const scrollingElement = doc ? doc.scrollingElement : null;
		if (scrollingElement instanceof HTMLElement) {
			scrollingElement.scrollTop = top;
			return;
		}
		scrollElement.scrollTop = top;
		const view = doc ? doc.defaultView : null;
		if (view) {
			view.scrollTo(0, top);
		}
	}

	private getViewportHeight(scrollElement: HTMLElement): number {
		if (!this.isDocumentScrollElement(scrollElement)) {
			return scrollElement.clientHeight;
		}
		const doc = scrollElement.ownerDocument;
		const view = doc ? doc.defaultView : null;
		return view ? view.innerHeight : scrollElement.clientHeight;
	}

	private parseCssLengthPx(value: string, style: CSSStyleDeclaration): number {
		const trimmed = value.trim();
		if (!trimmed || trimmed === 'normal') {
			return 0;
		}
		const parsed = Number.parseFloat(trimmed);
		if (!Number.isFinite(parsed)) {
			return 0;
		}
		if (trimmed.endsWith('px')) {
			return parsed;
		}
		if (trimmed.endsWith('rem')) {
			const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
			const scale = Number.isFinite(rootFontSize) ? rootFontSize : 16;
			return parsed * scale;
		}
		if (trimmed.endsWith('em')) {
			const fontSize = Number.parseFloat(style.fontSize);
			const scale = Number.isFinite(fontSize) ? fontSize : 16;
			return parsed * scale;
		}
		return parsed;
	}

	private updateGapFromComputedStyle(container: HTMLElement): void {
		const style = getComputedStyle(container);
		const rowGap = style.rowGap || style.gap;
		const next = Math.max(0, this.parseCssLengthPx(rowGap, style));
		if (this.gapPx !== next) {
			this.gapPx = next;
			this.cacheDirty = true;
		}
	}

	private ensureCache(): void {
		if (!this.cacheDirty) {
			return;
		}
		const ids = this.props.eventIds;
		const layout = buildVirtualListLayout(
			ids.length,
			(index) => this.getEstimatedOrMeasuredHeightPx(ids[index]),
			this.gapPx,
		);
		this.prefixSums = layout.prefixSums;
		this.totalHeightPx = layout.totalHeight;
		this.cacheDirty = false;
	}

	private getEstimatedOrMeasuredHeightPx(eventId: string): number {
		const ui = eventCardUiStateStore.get(eventId);
		const collapsed = ui ? ui.collapsed : false;
		const entry = this.measuredById.get(eventId);
		if (entry && entry.collapsed === collapsed) {
			return Math.max(0, entry.height);
		}
		return estimateVirtualEventHeight(editor.getEventById(eventId), ui);
	}

	private getListTopOffset(scrollElement: HTMLElement, listElement: HTMLElement, scrollTop: number): number {
		if (this.isDocumentScrollElement(scrollElement)) {
			const listRect = listElement.getBoundingClientRect();
			return scrollTop + listRect.top;
		}
		const scrollRect = scrollElement.getBoundingClientRect();
		const listRect = listElement.getBoundingClientRect();
		return scrollTop + (listRect.top - scrollRect.top);
	}

	private applyPadding(rangeStart: number, rangeEnd: number): void {
		const container = this.containerRef.current;
		if (!container) {
			return;
		}
		const padding = computeVirtualListPadding(
			this.prefixSums,
			this.totalHeightPx,
			this.props.eventIds.length,
			rangeStart,
			rangeEnd,
			this.gapPx,
		);
		container.style.setProperty('--cgenh-virtual-top', `${padding.top}px`);
		container.style.setProperty('--cgenh-virtual-bottom', `${padding.bottom}px`);
	}

	private updateVisibleRange(): void {
		const scrollElement = this.scrollElement;
		const container = this.containerRef.current;
		if (!scrollElement || !container) {
			return;
		}
		this.updateGapFromComputedStyle(container);
		this.ensureCache();

		const scrollTop = this.getScrollTop(scrollElement);
		const viewportHeight = this.getViewportHeight(scrollElement);
		const listTop = this.getListTopOffset(scrollElement, container, scrollTop);
		const viewTop = Math.max(0, scrollTop - listTop);
		const range = computeVirtualListRange(
			this.prefixSums,
			this.totalHeightPx,
			this.props.eventIds.length,
			viewTop,
			viewportHeight,
			OVERSCAN_COUNT,
		);

		if (range.start !== this.state.rangeStart || range.end !== this.state.rangeEnd) {
			this.setState(
				{ rangeStart: range.start, rangeEnd: range.end },
				() => this.applyPadding(range.start, range.end),
			);
			return;
		}
		this.applyPadding(range.start, range.end);
	}

	private setItemElement = (eventId: string, element: HTMLElement | null) => {
		const existing = this.elementById.get(eventId);
		if (existing && existing !== element) {
			this.itemResizeObserver?.unobserve(existing);
			this.idByElement.delete(existing);
			this.elementById.delete(eventId);
		}
		if (!element) {
			return;
		}
		this.elementById.set(eventId, element);
		this.idByElement.set(element, eventId);
		this.itemResizeObserver?.observe(element);
	};

	private handleItemResize(entries: ResizeObserverEntry[]): void {
		if (!entries.length) {
			return;
		}
		const scrollElement = this.scrollElement;
		const isDocumentScroll = scrollElement ? this.isDocumentScrollElement(scrollElement) : false;
		const scrollRectTop = scrollElement && !isDocumentScroll ? scrollElement.getBoundingClientRect().top : 0;
		const scrollTop = scrollElement ? this.getScrollTop(scrollElement) : 0;
		let scrollTopDelta = 0;
		let needsUpdate = false;
		for (const entry of entries) {
			const target = entry.target;
			if (!(target instanceof HTMLElement)) {
				continue;
			}
			const eventId = this.idByElement.get(target);
			if (!eventId) {
				continue;
			}
			const ui = eventCardUiStateStore.get(eventId);
			const collapsed = ui ? ui.collapsed : false;
			const previous = this.measuredById.get(eventId);
			const usedHeight = resolveVirtualResizeBaselineHeight(
				previous?.height,
				this.getEstimatedOrMeasuredHeightPx(eventId),
			);
			const rect = target.getBoundingClientRect();
			const height = Math.max(0, entry.contentRect.height);
			if (previous && previous.collapsed === collapsed && Math.abs(previous.height - height) < 0.5) {
				continue;
			}
			this.measuredById.set(eventId, { height, collapsed });
			this.cacheDirty = true;
			needsUpdate = true;

			if (!scrollElement) {
				continue;
			}
			if (rect.bottom <= scrollRectTop + 1) {
				const delta = height - usedHeight;
				if (Math.abs(delta) >= 0.5) {
					scrollTopDelta += delta;
				}
			}
		}
		if (scrollElement && scrollTopDelta !== 0) {
			this.setScrollTop(scrollElement, scrollTop + scrollTopDelta);
		}
		if (needsUpdate) {
			this.scheduleUpdate();
		}
	}

	render(): React.ReactNode {
		const ids = this.props.eventIds;
		if (ids.length === 0) {
			return null;
		}
		const start = Math.max(0, Math.min(this.state.rangeStart, ids.length));
		const end = Math.max(start, Math.min(this.state.rangeEnd, ids.length));
		const slice = ids.slice(start, end);
		const pinnedEventId = this.dragPinnedEventId;
		const pinnedIndex = pinnedEventId ? this.indexById.get(pinnedEventId) : undefined;
		const shouldPin = pinnedEventId !== null
			&& pinnedIndex !== undefined
			&& (pinnedIndex < start || pinnedIndex >= end);
		const renderIds = shouldPin ? [...slice, pinnedEventId] : slice;

		return (
			<div ref={this.containerRef} className="d-flex flex-column gap-2 cgenh-virtual-list">
				{renderIds.map((eventId) => {
					const componentRef = this.props.getEventRef(eventId);
					const originalIndex = editor.getEventIndex(eventId);
					const isPinned = shouldPin && eventId === pinnedEventId;
					return (
						<div
							key={eventId}
							className={`cgenh-virtual-list__item${isPinned ? ' cgenh-virtual-list__item--pinned' : ''}`}
							ref={(element) => {
								if (isPinned) {
									this.setItemElement(eventId, null);
									return;
								}
								this.setItemElement(eventId, element);
							}}
						>
							<EventComponent
								ref={componentRef}
								eventId={eventId}
								onEditAsJson={this.props.onEditAsJson}
								isFirst={originalIndex === 0}
								isLast={originalIndex === this.props.totalEventCount - 1}
							/>
						</div>
					);
				})}
			</div>
		);
	}
}

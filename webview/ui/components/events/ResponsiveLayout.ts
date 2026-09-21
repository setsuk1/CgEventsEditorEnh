import { winEE } from '../../../msg/WindowEventEmitter';

export interface HorizontalOverflowMetrics {
	scrollWidth: number;
	clientWidth: number;
}

export function isHorizontallyOverflowing(
	element: HorizontalOverflowMetrics | null | undefined,
	tolerancePx = 1,
): boolean {
	if (!element) return false;
	const tolerance = Number.isFinite(tolerancePx) ? Math.max(0, tolerancePx) : 0;
	return element.scrollWidth > element.clientWidth + tolerance;
}

export function normalizeCompactLevel(rawLevel: string | null, maxLevel: number): number {
	const safeMax = Number.isFinite(maxLevel) ? Math.max(0, Math.floor(maxLevel)) : 0;
	const parsed = rawLevel ? Number(rawLevel) : 0;
	const level = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
	return Math.min(safeMax, Math.max(0, level));
}

export function reconcileCompactLevel(
	rawLevel: string | null,
	maxLevel: number,
	applyLevel: (level: number) => void,
	needsCompaction: () => boolean,
): number {
	const safeMax = Number.isFinite(maxLevel) ? Math.max(0, Math.floor(maxLevel)) : 0;
	let level = normalizeCompactLevel(rawLevel, safeMax);

	applyLevel(level);
	if (needsCompaction()) {
		while (level < safeMax && needsCompaction()) {
			level += 1;
			applyLevel(level);
		}
		return level;
	}

	while (level > 0) {
		const nextLevel = level - 1;
		applyLevel(nextLevel);
		if (needsCompaction()) {
			applyLevel(level);
			return level;
		}
		level = nextLevel;
	}
	return level;
}

export class ResponsiveCompactObserver {
	private element: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resizeFallbackAttached = false;
	private frame: number | null = null;
	private disposed = false;

	constructor(private readonly update: () => void) {}

	observe(element: HTMLElement | null): void {
		if (this.disposed) return;
		if (this.element !== element) {
			if (this.resizeObserver && this.element) {
				this.resizeObserver.unobserve(this.element);
			}
			this.element = element;
		}
		if (!element) {
			this.detachResizeFallback();
			return;
		}

		if (typeof ResizeObserver === 'undefined') {
			if (!this.resizeFallbackAttached) {
				winEE.on('resize', this.schedule);
				this.resizeFallbackAttached = true;
			}
		} else {
			this.detachResizeFallback();
			if (!this.resizeObserver) {
				this.resizeObserver = new ResizeObserver(() => this.schedule());
			}
			this.resizeObserver.observe(element);
		}
		this.schedule();
	}

	schedule = (): void => {
		if (this.disposed || this.frame !== null) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = null;
			if (!this.disposed) this.update();
		});
	};

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		if (this.frame !== null) {
			cancelAnimationFrame(this.frame);
			this.frame = null;
		}
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.detachResizeFallback();
		this.element = null;
	}

	private detachResizeFallback(): void {
		if (!this.resizeFallbackAttached) return;
		winEE.off('resize', this.schedule);
		this.resizeFallbackAttached = false;
	}
}

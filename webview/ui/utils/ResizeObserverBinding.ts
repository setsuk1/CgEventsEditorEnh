export class ResizeObserverBinding {
	private observer: ResizeObserver | null = null;
	private target: Element | null = null;

	constructor(private readonly callback: ResizeObserverCallback) {}

	observe(target: Element | null): void {
		if (this.target === target) return;
		if (this.observer && this.target) {
			this.observer.unobserve(this.target);
		}
		this.target = target;
		if (!target || typeof ResizeObserver === 'undefined') return;
		if (!this.observer) {
			this.observer = new ResizeObserver(this.callback);
		}
		this.observer.observe(target);
	}

	disconnect(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.target = null;
	}
}

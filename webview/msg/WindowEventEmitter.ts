import { EmitterEntry, EventEmitter, type EventListener } from '../utils/EventEmitter';

export const CAPTURED_SCROLL_EVENT = 'scroll:capture';

export class WindowEventEmitter extends EventEmitter {
	private _bindedListeners: Record<string, EventListenerOrEventListenerObject> = Object.create(null);

	private getNativeEvent(event: string): string {
		return event === CAPTURED_SCROLL_EVENT ? 'scroll' : event;
	}

	private useCapture(event: string): boolean {
		return event === CAPTURED_SCROLL_EVENT;
	}

	private detachNativeListener(event: string): void {
		const listener = this._bindedListeners[event];
		if (!listener) return;
		window.removeEventListener(this.getNativeEvent(event), listener, this.useCapture(event));
		delete this._bindedListeners[event];
	}

	protected _addListener(event: string | symbol, entry: EmitterEntry): boolean {
		if (!super._addListener(event, entry)) return false;
		if (typeof event === 'string' && !this._bindedListeners[event]) {
			const listener = (...args: any[]) => this.emit(event, ...args);
			this._bindedListeners[event] = listener;
			window.addEventListener(this.getNativeEvent(event), listener, this.useCapture(event));
		}
		return true;
	}

	public emit(event: string | symbol, ...args: any[]): void {
		try {
			super.emit(event, ...args);
		} finally {
			if (typeof event === 'string' && !this.listenerCount(event)) this.detachNativeListener(event);
		}
	}

	public removeListener(
		event?: string | symbol,
		func?: EventListener,
		times?: number
	): boolean {
		const argCount = arguments.length;
		let removed: boolean;
		switch (argCount) {
			case 0:
				removed = super.removeListener();
				break;
			case 1:
				removed = super.removeListener(event);
				break;
			case 2:
				removed = super.removeListener(event, func);
				break;
			default:
				removed = super.removeListener(event, func, times);
				break;
		}
		if (!removed) return false;
		if (argCount === 0) {
			for (const [type, listener] of Object.entries(this._bindedListeners)) {
				window.removeEventListener(this.getNativeEvent(type), listener, this.useCapture(type));
			}
			this._bindedListeners = Object.create(null);
			return true;
		}
		if (typeof event === 'string' && !this.listenerCount(event)) this.detachNativeListener(event);
		return true;
	}
}

export const winEE = new WindowEventEmitter();

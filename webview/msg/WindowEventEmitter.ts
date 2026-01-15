import { EmitterEntry, EventEmitter } from '../utils/EventEmitter';

export class WindowEventEmitter extends EventEmitter {
	private _bindedListeners: Record<string, EventListenerOrEventListenerObject> = {};

	protected _addListener(event: string | symbol, entry: EmitterEntry): boolean {
		if (!super._addListener(event, entry)) {
			return false;
		}
		if (typeof event === 'string' && !this._bindedListeners[event]) {
			const temp = this._bindedListeners[event] = (...args: any[]) => {
				this.emit(event, ...args);
			};
			window.addEventListener(event, temp);
		}
		return true;
	}

	public removeListener(event?: string | symbol, func?: Function, context?: any, times?: number): boolean {
		if (!super.removeListener(event, func, context, times)) {
			return false;
		}
		if (typeof event === 'string' && !this.listenerCount(event)) {
			window.removeEventListener(event, this._bindedListeners[event]);
			delete this._bindedListeners[event];
		}
		return true;
	}
}

export const winEE = new WindowEventEmitter();

export type EventListener = (...args: any[]) => void;

export class EventEmitter {
    protected _handlers: {
        [key: string | symbol]: EmitterEntry[];
    };

    constructor() {
        this._handlers = Object.create(null);
    }

    public eventNames(): (string | symbol)[] {
        const handlers = this._handlers;
        return [...Object.getOwnPropertyNames(handlers), ...Object.getOwnPropertySymbols(handlers)];
    }

    public listenerCount(event: string | symbol): number {
        return this._handlers[event]?.length ?? 0;
    }

    public listeners(event: string | symbol): EventListener[] {
        const listeners = this._handlers[event];
        return listeners ? listeners.map(listener => listener.func) : [];
    }

    protected _addListener(event: string | symbol, entry: EmitterEntry): boolean {
        const listeners = this._handlers[event];
        if (listeners) {
            listeners.push(entry);
        } else {
            this._handlers[event] = [entry];
        }
        return true;
    }

    public addListener(
        event: string | symbol,
        func: EventListener,
        times: number = Number.POSITIVE_INFINITY
    ): boolean {
        if (typeof func !== 'function') {
            return false;
        }
        times = Math.floor(times);
        if (Number.isNaN(times) || times <= 0) {
            return false;
        }
        return this._addListener(event, new EmitterEntry(func, times));
    }

    public on(event: string | symbol, func: EventListener): boolean {
        return this.addListener(event, func);
    }

    public once(event: string | symbol, func: EventListener): boolean {
        return this.addListener(event, func, 1);
    }

    public removeListener(
        event?: string | symbol,
        func?: EventListener,
        times?: number
    ): boolean {
        const len = arguments.length;
        if (len === 0) {
            this._handlers = Object.create(null);
            return true;
        }

        const handlers = this._handlers;
        let listeners = handlers[event!];
        if (!listeners) {
            return false;
        }

        switch (len) {
            case 1:
                return delete handlers[event!];
            case 2:
                listeners = listeners.filter(value => value.func !== func);
                break;
            default:
                listeners = listeners.filter(value => value.func !== func || times! < value.times);
                break;
        }

        if (listeners.length) {
            handlers[event!] = listeners;
            return true;
        }
        return delete handlers[event!];
    }

    public removeAllListeners(event?: string | symbol): boolean {
        return arguments.length ? this.removeListener(event) : this.removeListener();
    }

    public off(event: string | symbol, func?: EventListener, once?: boolean): boolean {
        if (arguments.length === 0) return this.removeListener();
        if (arguments.length === 1) return this.removeListener(event);
        if (arguments.length === 2) return this.removeListener(event, func);
        return this.removeListener(event, func, once ? 1 : Number.POSITIVE_INFINITY);
    }

    public emit(event: string | symbol, ...args: any[]): void {
        const listeners = this._handlers[event];
        if (!listeners) {
            return;
        }

        let needsCleanup = false;
        const count = listeners.length;
        try {
            for (let i = 0; i < count; i++) {
                if (!listeners[i].invoke(args)) {
                    needsCleanup = true;
                }
            }
        } finally {
            if (!needsCleanup) {
                needsCleanup = listeners.some(listener => !listener.active);
            }
            if (needsCleanup && this._handlers[event] === listeners) {
                const active = listeners.filter(listener => listener.active);
                if (active.length) {
                    this._handlers[event] = active;
                } else {
                    delete this._handlers[event];
                }
            }
        }
    }
}

export class EmitterEntry {
    constructor(
        private readonly _func: EventListener,
        private _times: number
    ) {}

    public get func(): EventListener {
        return this._func;
    }

    public get times(): number {
        return this._times;
    }

    public get active(): boolean {
        return this._times >= 1;
    }

    public invoke(args: any[]): boolean {
        if (this._times < 1) {
            return false;
        }
        if (Number.isFinite(this._times)) {
            this._times -= 1;
        }
        this._func(...args);
        return this._times >= 1;
    }
}

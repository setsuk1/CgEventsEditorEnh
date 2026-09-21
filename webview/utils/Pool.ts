export interface IPoolTarget<T> {
    new(...args: any[]): T;
}

export interface IPoolOptions {
    clearDownInterval?: number;
    minObjects?: number;
}

export class Pool<T> {
    protected _active = new Set<T>();
    protected _released = new Set<T>();

    protected _recycledCount = 0;
    protected _clearDownInterval = 10;
    protected _minObjects = 5;

    protected _targetClass: IPoolTarget<T>;

    constructor(targetClass: IPoolTarget<T>, options: IPoolOptions = undefined) {
        this._targetClass = targetClass;
        if (options) {
            this.setOptions(options);
        }
    }

    public getCounts(): number {
        return this._active.size;
    }

    public setOptions(options: IPoolOptions): void {
        this._clearDownInterval = options?.clearDownInterval ?? 10;
        this._minObjects = options?.minObjects ?? 5;
    }

    public getInstance(): T {
        if (this._released.size) {
            for (const obj of this._released.values()) {
                this._active.add(obj);
                this._released.delete(obj);
                return obj;
            }
        }

        const newObj = new this._targetClass();
        this._active.add(newObj);
        return newObj;
    }

    public releaseInstance(obj: T): boolean {
        if (!this._active.has(obj)) {
            return false;
        }

        this._active.delete(obj);
        this._released.add(obj);

        this._recycledCount++;
        if (this._recycledCount >= this._clearDownInterval) {
            this.clearDown();
        }

        return true;
    }

    public clearDown(): void {
        this._recycledCount = 0;
        if (!this._released.size) {
            return;
        }

        let recycleCounts = this._active.size + this._released.size - this._minObjects;
        if (recycleCounts <= 0) {
            return;
        }

        for (const obj of this._released.values()) {
            this._released.delete(obj);
            recycleCounts--;
            if (!recycleCounts) {
                break;
            }
        }
    }
}

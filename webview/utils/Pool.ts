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
            for (let obj of this._released.values()) {
                this._active.add(obj);
                this._released.delete(obj);
                return obj;
            }
        }

        let newObj = new this._targetClass();
        this._active.add(newObj);
        return newObj;
    }

    public releaseInstance(obj: T): boolean {
        let check = this._active.has(obj);
        if (!check) {
            console.error("This object is not in this pool");
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
        if (!this._released.size) {
            return;
        }

        let recycleCounts = this._active.size + this._released.size - this._minObjects;
        if (recycleCounts <= 0) {
            return;
        }

        for (let obj of this._released.values()) {
            this._released.delete(obj);
            recycleCounts--;
            if (!recycleCounts) {
                break;
            }
        }

        this._recycledCount = 0;
    }
}

import { ObjectUtil } from '@shared';

function cloneValue<T>(value: T): T {
	try {
		if (typeof structuredClone === 'function') {
			return structuredClone(value);
		}
	} catch {
		// fallback below
	}
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return value;
	}
}

export class FormHistory<T> {
	private entries: T[] = [];
	private index = -1;
	private onChange?: () => void;

	constructor(initial: T, onChange?: () => void) {
		this.onChange = onChange;
		this.reset(initial);
	}

	reset(initial: T) {
		this.entries = [cloneValue(initial)];
		this.index = 0;
		this.notify();
	}

	canUndo(): boolean {
		return this.index > 0;
	}

	canRedo(): boolean {
		return this.index >= 0 && this.index < this.entries.length - 1;
	}

	push(next: T): boolean {
		const snapshot = cloneValue(next);
		if (this.index >= 0 && ObjectUtil.equals(snapshot, this.entries[this.index])) {
			return false;
		}
		if (this.index < this.entries.length - 1) {
			this.entries = this.entries.slice(0, this.index + 1);
		}
		this.entries.push(snapshot);
		this.index = this.entries.length - 1;
		this.notify();
		return true;
	}

	undo(): T | null {
		if (!this.canUndo()) {
			return null;
		}
		this.index -= 1;
		this.notify();
		return cloneValue(this.entries[this.index]);
	}

	redo(): T | null {
		if (!this.canRedo()) {
			return null;
		}
		this.index += 1;
		this.notify();
		return cloneValue(this.entries[this.index]);
	}

	private notify() {
		this.onChange?.();
	}
}

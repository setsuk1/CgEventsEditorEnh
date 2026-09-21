import { ObjectUtil } from '@shared';

const MAX_FORM_HISTORY = 100;

function cloneValue<T>(value: T): T {
	return structuredClone(value);
}

export class FormHistory<T> {
	private entries: T[] = [];
	private index = -1;
	private onChange?: () => void;

	constructor(initial: T, onChange?: () => void) {
		this.onChange = onChange;
		this.entries = [cloneValue(initial)];
		this.index = 0;
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
		if (this.index >= 0 && ObjectUtil.equals(next, this.entries[this.index])) {
			return false;
		}
		if (this.index < this.entries.length - 1) {
			this.entries.length = this.index + 1;
		}
		this.entries.push(cloneValue(next));
		if (this.entries.length > MAX_FORM_HISTORY) {
			const removeCount = this.entries.length - MAX_FORM_HISTORY;
			this.entries.splice(0, removeCount);
			this.index = Math.max(0, this.index - removeCount);
		}
		this.index = this.entries.length - 1;
		this.notify();
		return true;
	}

	undo(): T | null {
		if (!this.canUndo()) return null;
		this.index -= 1;
		this.notify();
		return cloneValue(this.entries[this.index]);
	}

	redo(): T | null {
		if (!this.canRedo()) return null;
		this.index += 1;
		this.notify();
		return cloneValue(this.entries[this.index]);
	}

	private notify() {
		this.onChange?.();
	}
}

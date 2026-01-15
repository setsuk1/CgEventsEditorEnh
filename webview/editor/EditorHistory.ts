export interface EditorHistoryEntry {
	undo(): void;
	redo(): void;
}

export class EditorHistory {
	private entries: EditorHistoryEntry[] = [];
	private index: number = -1;
	private applying: boolean = false;

	canUndo(): boolean {
		return this.index >= 0;
	}

	canRedo(): boolean {
		return this.index < this.entries.length - 1;
	}

	undo(): void {
		if (!this.canUndo()) {
			return;
		}
		const entry = this.entries[this.index];
		if (!entry) {
			return;
		}
		this.applying = true;
		try {
			entry.undo();
		} finally {
			this.applying = false;
		}
		this.index = Math.max(-1, this.index - 1);
	}

	redo(): void {
		if (!this.canRedo()) {
			return;
		}
		const entry = this.entries[this.index + 1];
		if (!entry) {
			return;
		}
		this.applying = true;
		try {
			entry.redo();
		} finally {
			this.applying = false;
		}
		this.index = Math.min(this.entries.length - 1, this.index + 1);
	}

	clear(): void {
		this.entries.length = 0;
		this.index = -1;
	}

	record(entry: EditorHistoryEntry): void {
		if (this.applying) {
			return;
		}
		if (this.index < this.entries.length - 1) {
			this.entries.splice(this.index + 1);
		}
		this.entries.push(entry);
		this.index = this.entries.length - 1;
	}
}

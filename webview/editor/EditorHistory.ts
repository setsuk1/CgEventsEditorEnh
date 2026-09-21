export interface EditorHistoryEntry {
	undo(): void;
	redo(): void;
}

const MAX_HISTORY_ENTRIES = 200;

export class EditorHistory {
	private entries: EditorHistoryEntry[] = [];
	private index = -1;
	private applying = false;

	canUndo(): boolean {
		return this.index >= 0;
	}

	canRedo(): boolean {
		return this.index < this.entries.length - 1;
	}

	undo(): void {
		if (!this.canUndo()) return;
		const entry = this.entries[this.index];
		if (!entry) return;

		this.applying = true;
		try {
			entry.undo();
			this.index--;
		} finally {
			this.applying = false;
		}
	}

	redo(): void {
		if (!this.canRedo()) return;
		const nextIndex = this.index + 1;
		const entry = this.entries[nextIndex];
		if (!entry) return;

		this.applying = true;
		try {
			entry.redo();
			this.index = nextIndex;
		} finally {
			this.applying = false;
		}
	}

	clear(): void {
		this.entries.length = 0;
		this.index = -1;
	}

	record(entry: EditorHistoryEntry): void {
		if (this.applying) return;
		if (this.index < this.entries.length - 1) {
			this.entries.splice(this.index + 1);
		}
		this.entries.push(entry);
		if (this.entries.length > MAX_HISTORY_ENTRIES) {
			this.entries.splice(0, this.entries.length - MAX_HISTORY_ENTRIES);
		}
		this.index = this.entries.length - 1;
	}
}

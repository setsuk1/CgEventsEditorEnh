export class LazyAsyncLoad {
	private pendingLoad: Promise<void> | undefined;
	private loaded = false;

	get started(): boolean {
		return this.loaded || this.pendingLoad !== undefined;
	}

	ensure(load: () => Promise<void>): Promise<void> {
		if (this.loaded) return Promise.resolve();
		return this.pendingLoad ?? this.start(load);
	}

	reload(load: () => Promise<void>): Promise<void> {
		return this.pendingLoad ?? this.start(load);
	}

	async waitForPending(): Promise<void> {
		if (this.pendingLoad) await this.pendingLoad;
	}

	private start(load: () => Promise<void>): Promise<void> {
		this.loaded = false;
		const pending = Promise.resolve().then(load);
		this.pendingLoad = pending;
		void pending.then(
			() => {
				if (this.pendingLoad !== pending) return;
				this.pendingLoad = undefined;
				this.loaded = true;
			},
			() => {
				if (this.pendingLoad !== pending) return;
				this.pendingLoad = undefined;
				this.loaded = false;
			},
		);
		return pending;
	}
}

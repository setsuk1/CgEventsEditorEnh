export class AnimationFrameTask {
	private frame: number | null = null;

	get scheduled(): boolean {
		return this.frame !== null;
	}

	schedule(task: () => void): boolean {
		if (this.frame !== null) return false;
		this.frame = requestAnimationFrame(() => {
			this.frame = null;
			task();
		});
		return true;
	}

	cancel(): void {
		if (this.frame === null) return;
		cancelAnimationFrame(this.frame);
		this.frame = null;
	}
}

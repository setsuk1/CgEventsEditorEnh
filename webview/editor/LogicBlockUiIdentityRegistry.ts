import type { ICgEventLogicBlock } from '@shared';

export class LogicBlockUiIdentityRegistry {
	private keyByBlock = new WeakMap<ICgEventLogicBlock, string>();
	private nextKey = 1;

	getKey(block: ICgEventLogicBlock): string {
		const existing = this.keyByBlock.get(block);
		if (existing) {
			return existing;
		}
		const created = `logic-${this.nextKey++}`;
		this.keyByBlock.set(block, created);
		return created;
	}

	transfer(from: ICgEventLogicBlock, to: ICgEventLogicBlock): void {
		const existing = this.keyByBlock.get(from);
		if (!existing) {
			return;
		}
		this.keyByBlock.set(to, existing);
	}

	reset(): void {
		this.keyByBlock = new WeakMap<ICgEventLogicBlock, string>();
		this.nextKey = 1;
	}
}

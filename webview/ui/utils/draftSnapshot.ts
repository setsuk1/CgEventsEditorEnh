import { ObjectUtil } from '@shared';

export function cloneDraftSnapshot<T>(value: T): T {
	return ObjectUtil.deepCloneObject(value);
}

export function isDraftSnapshotCurrent(initial: unknown, current: unknown): boolean {
	return ObjectUtil.equals(initial, current);
}

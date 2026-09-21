import { ObjectUtil } from '@shared';
import { getOwnPropertyValue, getOwnValueAtPath } from '../../../utils/ownPath';

export interface LogicDataPathChange {
	path: string[];
	value: unknown;
}

export function isLogicDataObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function collectLogicDataChanges(
	previous: unknown,
	next: unknown,
	basePath: string[] = [],
): LogicDataPathChange[] {
	const changes: LogicDataPathChange[] = [];
	const visit = (before: unknown, after: unknown, path: string[]) => {
		if (ObjectUtil.equals(before, after)) return;
		if (isLogicDataObject(before) && isLogicDataObject(after)) {
			const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
			for (const key of keys) {
				visit(
					getOwnPropertyValue(before, key),
					getOwnPropertyValue(after, key),
					[...path, key],
				);
			}
			return;
		}
		changes.push({ path, value: after });
	};
	visit(previous, next, basePath);
	return changes;
}


export function hasLogicDataConflict(
	initial: unknown,
	current: unknown,
	changes: readonly LogicDataPathChange[],
): boolean {
	for (const change of changes) {
		if (!ObjectUtil.equals(
			getOwnValueAtPath(initial, change.path),
			getOwnValueAtPath(current, change.path),
		)) {
			return true;
		}
	}
	return false;
}

export function isLogicListSnapshotCurrent(initial: unknown, current: unknown): boolean {
	return ObjectUtil.equals(initial, current);
}

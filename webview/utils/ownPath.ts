const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function isArrayIndexKey(key: string): boolean {
	if (!/^\d+$/.test(key)) return false;
	const index = Number(key);
	return Number.isSafeInteger(index) && index >= 0 && String(index) === key;
}

export function getOwnPropertyValue(target: unknown, key: string): unknown {
	if (UNSAFE_PATH_SEGMENTS.has(key)) {
		return undefined;
	}
	if (target === null || (typeof target !== 'object' && typeof target !== 'function')) {
		return undefined;
	}
	if (Array.isArray(target) && !isArrayIndexKey(key)) {
		return undefined;
	}
	if (!Object.hasOwn(target, key)) {
		return undefined;
	}
	return (target as Record<string, unknown>)[key];
}

export function getOwnValueAtPath(target: unknown, path: ReadonlyArray<string | number>): unknown {
	let current: unknown = target;
	for (const segment of path) {
		const key = String(segment);
		current = getOwnPropertyValue(current, key);
		if (current === undefined) {
			return undefined;
		}
	}
	return current;
}

export function setOwnValueAtPath(target: unknown, path: ReadonlyArray<string | number>, value: unknown): unknown {
	if (!path.length) {
		return value;
	}
	const keys = path.map((segment) => String(segment));
	if (keys.some((key) => UNSAFE_PATH_SEGMENTS.has(key))) {
		return target;
	}

	const update = (current: unknown, index: number): unknown => {
		if (index >= keys.length) {
			return value;
		}
		const key = keys[index];
		if (Array.isArray(current) && !isArrayIndexKey(key)) {
			return current;
		}

		const previousChild = getOwnPropertyValue(current, key);
		const nextChild = update(previousChild, index + 1);
		if (nextChild === previousChild) {
			return current;
		}

		let clone: any;
		if (Array.isArray(current)) {
			clone = [...current];
		} else if (current !== null && typeof current === 'object') {
			clone = { ...(current as Record<string, unknown>) };
		} else {
			clone = {};
		}
		clone[key] = nextChild;
		return clone;
	};

	return update(target, 0);
}

export function getOwnValueByDottedPath(target: unknown, path: string): unknown {
	const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
	if (!segments.length) {
		return undefined;
	}
	return getOwnValueAtPath(target, segments);
}

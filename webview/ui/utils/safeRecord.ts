export function createSafeRecord<T>(): Record<string, T> {
	return Object.create(null) as Record<string, T>;
}

export function getOrCreateOwn<T>(record: Record<string, T>, key: string, create: () => T): T {
	if (Object.hasOwn(record, key)) {
		return record[key];
	}
	const value = create();
	Object.defineProperty(record, key, {
		value,
		writable: true,
		enumerable: true,
		configurable: true,
	});
	return value;
}

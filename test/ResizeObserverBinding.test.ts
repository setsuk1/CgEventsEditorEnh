import assert from 'node:assert/strict';
import test from 'node:test';
import { ResizeObserverBinding } from '../webview/ui/utils/ResizeObserverBinding';

test('resize observer binding retargets observation without rebuilding the observer', () => {
	const previous = globalThis.ResizeObserver;
	const observed: Element[] = [];
	const unobserved: Element[] = [];
	let created = 0;

	globalThis.ResizeObserver = class {
		constructor(_callback: ResizeObserverCallback) { created += 1; }
		observe(target: Element) { observed.push(target); }
		unobserve(target: Element) { unobserved.push(target); }
		disconnect() {}
	} as unknown as typeof ResizeObserver;

	try {
		const binding = new ResizeObserverBinding(() => undefined);
		const first = {} as Element;
		const second = {} as Element;
		binding.observe(first);
		binding.observe(first);
		binding.observe(second);

		assert.equal(created, 1);
		assert.deepEqual(observed, [first, second]);
		assert.deepEqual(unobserved, [first]);
	} finally {
		globalThis.ResizeObserver = previous;
	}
});

test('resize observer binding disconnects cleanly and tolerates unavailable observers', () => {
	const previous = globalThis.ResizeObserver;
	let disconnects = 0;
	globalThis.ResizeObserver = class {
		constructor(_callback: ResizeObserverCallback) {}
		observe(_target: Element) {}
		unobserve(_target: Element) {}
		disconnect() { disconnects += 1; }
	} as unknown as typeof ResizeObserver;

	try {
		const binding = new ResizeObserverBinding(() => undefined);
		binding.observe({} as Element);
		binding.disconnect();
		assert.equal(disconnects, 1);

		(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = undefined;
		binding.observe({} as Element);
		binding.observe(null);
		binding.disconnect();
		assert.equal(disconnects, 1);
	} finally {
		globalThis.ResizeObserver = previous;
	}
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ResponsiveCompactObserver } from '../webview/ui/components/events/ResponsiveLayout';

test('responsive compact observer coalesces frames and retargets resize observation', () => {
	const previousRequest = globalThis.requestAnimationFrame;
	const previousCancel = globalThis.cancelAnimationFrame;
	const previousResizeObserver = globalThis.ResizeObserver;
	const callbacks = new Map<number, FrameRequestCallback>();
	const observed: Element[] = [];
	const unobserved: Element[] = [];
	let disconnected = false;
	let nextId = 1;
	let requests = 0;
	let updates = 0;

	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		requests += 1;
		const id = nextId++;
		callbacks.set(id, callback);
		return id;
	}) as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((id: number) => {
		callbacks.delete(id);
	}) as typeof cancelAnimationFrame;
	globalThis.ResizeObserver = class {
		constructor(_callback: ResizeObserverCallback) {}
		observe(target: Element) { observed.push(target); }
		unobserve(target: Element) { unobserved.push(target); }
		disconnect() { disconnected = true; }
	} as unknown as typeof ResizeObserver;

	try {
		const observer = new ResponsiveCompactObserver(() => { updates += 1; });
		const first = {} as HTMLElement;
		const second = {} as HTMLElement;

		observer.observe(first);
		observer.schedule();
		assert.equal(requests, 1);
		assert.deepEqual(observed, [first]);

		observer.observe(second);
		assert.deepEqual(unobserved, [first]);
		assert.deepEqual(observed, [first, second]);

		const [id, callback] = [...callbacks.entries()][0];
		callback(0);
		callbacks.delete(id);
		assert.equal(updates, 1);

		observer.schedule();
		assert.equal(requests, 2);
		observer.dispose();
		assert.equal(callbacks.size, 0);
		assert.equal(disconnected, true);
	} finally {
		globalThis.requestAnimationFrame = previousRequest;
		globalThis.cancelAnimationFrame = previousCancel;
		globalThis.ResizeObserver = previousResizeObserver;
	}
});

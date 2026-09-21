import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationFrameTask } from '../webview/ui/utils/AnimationFrameTask';

test('animation frame task coalesces pending work and can be rescheduled after running', () => {
	const previousRequest = globalThis.requestAnimationFrame;
	const previousCancel = globalThis.cancelAnimationFrame;
	const callbacks = new Map<number, FrameRequestCallback>();
	let nextId = 1;
	let calls = 0;

	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		const id = nextId++;
		callbacks.set(id, callback);
		return id;
	}) as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((id: number) => {
		callbacks.delete(id);
	}) as typeof cancelAnimationFrame;

	try {
		const task = new AnimationFrameTask();
		assert.equal(task.schedule(() => { calls += 1; }), true);
		assert.equal(task.schedule(() => { calls += 10; }), false);
		assert.equal(task.scheduled, true);

		const [id, callback] = [...callbacks.entries()][0];
		callbacks.delete(id);
		callback(0);
		assert.equal(calls, 1);
		assert.equal(task.scheduled, false);

		assert.equal(task.schedule(() => { calls += 1; }), true);
		const [secondId, secondCallback] = [...callbacks.entries()][0];
		callbacks.delete(secondId);
		secondCallback(0);
		assert.equal(calls, 2);
	} finally {
		globalThis.requestAnimationFrame = previousRequest;
		globalThis.cancelAnimationFrame = previousCancel;
	}
});

test('animation frame task cancellation clears pending work', () => {
	const previousRequest = globalThis.requestAnimationFrame;
	const previousCancel = globalThis.cancelAnimationFrame;
	const callbacks = new Map<number, FrameRequestCallback>();
	let cancelled = 0;

	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		callbacks.set(1, callback);
		return 1;
	}) as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((id: number) => {
		if (callbacks.delete(id)) cancelled += 1;
	}) as typeof cancelAnimationFrame;

	try {
		const task = new AnimationFrameTask();
		task.schedule(() => undefined);
		task.cancel();
		assert.equal(task.scheduled, false);
		assert.equal(cancelled, 1);
		assert.equal(callbacks.size, 0);
		task.cancel();
		assert.equal(cancelled, 1);
	} finally {
		globalThis.requestAnimationFrame = previousRequest;
		globalThis.cancelAnimationFrame = previousCancel;
	}
});

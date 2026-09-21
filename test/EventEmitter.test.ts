import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from '../webview/utils/EventEmitter';

test('once listeners are removed even when their callback throws', () => {
	const emitter = new EventEmitter();
	let calls = 0;
	emitter.once('change', () => {
		calls += 1;
		throw new Error('expected failure');
	});

	assert.throws(() => emitter.emit('change'), /expected failure/);
	assert.equal(calls, 1);
	assert.equal(emitter.listenerCount('change'), 0);

	assert.doesNotThrow(() => emitter.emit('change'));
	assert.equal(calls, 1);
});

test('finite listeners stay registered until the final failed invocation', () => {
	const emitter = new EventEmitter();
	let calls = 0;
	emitter.addListener('change', () => {
		calls += 1;
		throw new Error('expected failure');
	}, 2);

	assert.throws(() => emitter.emit('change'), /expected failure/);
	assert.equal(emitter.listenerCount('change'), 1);

	assert.throws(() => emitter.emit('change'), /expected failure/);
	assert.equal(calls, 2);
	assert.equal(emitter.listenerCount('change'), 0);
});

test('window emitters detach native once listeners after callback errors', async () => {
	const added: Array<{ type: string; listener: EventListenerOrEventListenerObject; capture?: boolean }> = [];
	const removed: Array<{ type: string; listener: EventListenerOrEventListenerObject; capture?: boolean }> = [];
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: {
			addEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
				added.push({ type, listener, capture });
			},
			removeEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
				removed.push({ type, listener, capture });
			},
		},
	});

	try {
		const { WindowEventEmitter } = await import('../webview/msg/WindowEventEmitter');
		const emitter = new WindowEventEmitter();
		emitter.once('click', () => {
			throw new Error('expected failure');
		});

		assert.equal(added.length, 1);
		assert.throws(() => emitter.emit('click'), /expected failure/);
		assert.equal(emitter.listenerCount('click'), 0);
		assert.equal(removed.length, 1);
		assert.equal(removed[0]?.listener, added[0]?.listener);
	} finally {
		if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
		else delete (globalThis as { window?: unknown }).window;
	}
});

test('invalid listener invocation counts are rejected without registering callbacks', () => {
	const emitter = new EventEmitter();
	let calls = 0;
	const listener = () => {
		calls += 1;
	};

	assert.equal(emitter.addListener('change', listener, Number.NaN), false);
	assert.equal(emitter.listenerCount('change'), 0);
	emitter.emit('change');
	assert.equal(calls, 0);
});

test('window emitters support native event names that shadow Object prototype keys', async () => {
	const added: Array<{ type: string; listener: EventListenerOrEventListenerObject; capture?: boolean }> = [];
	const removed: Array<{ type: string; listener: EventListenerOrEventListenerObject; capture?: boolean }> = [];
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: {
			addEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
				added.push({ type, listener, capture });
			},
			removeEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
				removed.push({ type, listener, capture });
			},
		},
	});

	try {
		const { WindowEventEmitter } = await import('../webview/msg/WindowEventEmitter');
		const emitter = new WindowEventEmitter();
		let calls = 0;
		emitter.on('constructor', () => {
			calls += 1;
		});

		assert.equal(added.length, 1);
		assert.equal(added[0]?.type, 'constructor');
		emitter.emit('constructor');
		assert.equal(calls, 1);

		assert.equal(emitter.removeAllListeners('constructor'), true);
		assert.equal(removed.length, 1);
		assert.equal(removed[0]?.listener, added[0]?.listener);
	} finally {
		if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
		else delete (globalThis as { window?: unknown }).window;
	}
});


test('listeners are invoked directly with emitted arguments', () => {
	const emitter = new EventEmitter();
	let received: unknown[] = [];
	emitter.on('change', (...args) => {
		received = args;
	});

	emitter.emit('change', 1, 'two');

	assert.deepEqual(received, [1, 'two']);
});

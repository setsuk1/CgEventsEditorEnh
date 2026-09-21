import assert from 'node:assert/strict';
import test from 'node:test';
import { LazyAsyncLoad } from '../src/utils/LazyAsyncLoad';

test('lazy async load runs once for concurrent ensure calls and remembers success', async () => {
	const load = new LazyAsyncLoad();
	let runs = 0;
	let resolveLoad!: () => void;
	const pending = new Promise<void>((resolve) => { resolveLoad = resolve; });
	const factory = async () => {
		runs += 1;
		await pending;
	};

	const first = load.ensure(factory);
	const second = load.ensure(factory);
	assert.equal(load.started, true);
	assert.strictEqual(first, second);
	assert.equal(runs, 0);

	await Promise.resolve();
	assert.equal(runs, 1);
	resolveLoad();
	await Promise.all([first, second]);

	assert.equal(load.started, true);
	await load.ensure(factory);
	assert.equal(runs, 1);
});

test('lazy async load reload and ensure share an in-flight load', async () => {
	const load = new LazyAsyncLoad();
	let runs = 0;
	let resolveLoad!: () => void;
	const pending = new Promise<void>((resolve) => { resolveLoad = resolve; });
	const factory = async () => {
		runs += 1;
		await pending;
	};

	const first = load.reload(factory);
	const second = load.reload(factory);
	const ensured = load.ensure(factory);
	assert.strictEqual(first, second);
	assert.strictEqual(first, ensured);
	await Promise.resolve();
	assert.equal(runs, 1);
	resolveLoad();
	await first;

	await load.reload(async () => { runs += 1; });
	assert.equal(runs, 2);
});

test('lazy async load returns to idle after failure so ensure can retry', async () => {
	const load = new LazyAsyncLoad();
	let runs = 0;

	await assert.rejects(load.ensure(async () => {
		runs += 1;
		throw new Error('temporary');
	}), /temporary/);
	assert.equal(load.started, false);

	await load.ensure(async () => { runs += 1; });
	assert.equal(load.started, true);
	assert.equal(runs, 2);
});

test('lazy async load waits for the current pending load', async () => {
	const load = new LazyAsyncLoad();
	let resolveLoad!: () => void;
	const pending = new Promise<void>((resolve) => { resolveLoad = resolve; });
	load.reload(() => pending);

	let settled = false;
	const waiting = load.waitForPending().then(() => { settled = true; });
	await Promise.resolve();
	assert.equal(settled, false);

	resolveLoad();
	await waiting;
	assert.equal(settled, true);
});

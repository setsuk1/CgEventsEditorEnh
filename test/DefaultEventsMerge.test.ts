import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsDocument } from '../shared/events';
import { compareDefaultEventSourceOrder, filterDefaultConfigs, mergeDefaultConfigs, mergeDefaultEvents } from '../src/utils/defaultEventsMerge';

function createDocument(): ICgEventsDocument {
	return {
		config: {
			stage: {
				width: 800,
				height: 600,
				backgroundColor: '#999999',
				resolutionPolicy: 'showAll',
				alignHorizontal: 'center',
				alignVertical: 'middle',
			},
			preload: {
				resourcesExclude: [],
				sources: [],
			},
			configs: {},
		},
		events: [],
	};
}

test('default event sources sort by mtime before path', () => {
	const items = [
		{ mtime: 20, key: '/a/default.events.json' },
		{ mtime: 10, key: '/z/default.events.json' },
	];
	items.sort(compareDefaultEventSourceOrder);
	assert.deepEqual(items.map((item) => item.mtime), [10, 20]);
});

test('default event sources use path as a deterministic mtime tie-breaker', () => {
	const items = [
		{ mtime: 10, key: '/z/default.events.json' },
		{ mtime: 10, key: '/a/default.events.json' },
	];
	items.sort(compareDefaultEventSourceOrder);
	assert.deepEqual(items.map((item) => item.key), ['/a/default.events.json', '/z/default.events.json']);
});

test('default configs filter preserves legacy array configs', () => {
	const configs = [{ type: 'legacy', value: 1 }];
	assert.strictEqual(filterDefaultConfigs(configs, {}), configs);
	assert.deepEqual(configs, [{ type: 'legacy', value: 1 }]);
});

test('default configs filter removes object entries not marked as config definitions', () => {
	const configs = { keep: { value: 1 }, remove: { value: 2 } };
	filterDefaultConfigs(configs, {
		keep: { use: 'config' },
		remove: { use: 'event' },
	});
	assert.deepEqual(configs, { keep: { value: 1 } });
});

test('default configs merge preserves legacy array configs', () => {
	assert.deepEqual(
		mergeDefaultConfigs(undefined, [{ type: 'legacy', value: 1 }]),
		[{ type: 'legacy', value: 1 }],
	);
});

test('default configs merge switches from object to array when the source uses the legacy array shape', () => {
	assert.deepEqual(
		mergeDefaultConfigs({ old: { enabled: true } }, [{ type: 'legacy' }]),
		[{ type: 'legacy' }],
	);
});

test('default configs merge switches from array to object when the source uses the object shape', () => {
	assert.deepEqual(
		mergeDefaultConfigs([{ type: 'legacy' }], { modern: { enabled: true } }),
		{ modern: { enabled: true } },
	);
});

test('default configs merge retains target object keys not replaced by the source', () => {
	assert.deepEqual(
		mergeDefaultConfigs({ keep: 1, replace: { old: true } }, { replace: { next: true } }),
		{ keep: 1, replace: { old: true, next: true } },
	);
});

test('default events merge combines stage, preload, configs, and unique events', () => {
	const target = createDocument();
	target.config.stage.width = 640;
	target.config.preload.sources = ['base.events'];
	target.config.preload.resourcesExclude = ['base-image'];
	target.config.configs = { shared: { base: true }, keep: { enabled: true } };
	target.events = [{ id: 'existing', actions: [], checks: [], triggers: [], folder: 'base' }];

	const source = createDocument();
	source.config.stage.width = 1280;
	source.config.stage.backgroundColor = '#123456';
	source.config.preload.sources = ['base.events', 'extra.events'];
	source.config.preload.resourcesExclude = ['extra-image', 'base-image'];
	source.config.configs = { shared: { source: true }, added: { enabled: true } };
	source.events = [
		{ id: 'existing', actions: [], checks: [], triggers: [], folder: 'source' },
		{ id: 'added', actions: [], checks: [], triggers: [] },
	];

	assert.strictEqual(mergeDefaultEvents(target, source), target);
	assert.equal(target.config.stage.width, 1280);
	assert.equal(target.config.stage.backgroundColor, '#123456');
	assert.deepEqual(target.config.preload.sources, ['base.events', 'extra.events']);
	assert.deepEqual(target.config.preload.resourcesExclude, ['base-image', 'extra-image']);
	assert.deepEqual(target.config.configs, {
		shared: { base: true, source: true },
		keep: { enabled: true },
		added: { enabled: true },
	});
	assert.deepEqual(target.events.map((event) => [event.id, event.folder]), [
		['existing', 'base'],
		['added', undefined],
	]);
});

test('default events merge keeps the first event when later sources reuse an id', () => {
	const target = createDocument();
	target.events = [{ id: 'same', actions: [], checks: [], triggers: [], folder: 'first' }];
	const source = createDocument();
	source.events = [{ id: 'same', actions: [], checks: [], triggers: [], folder: 'later' }];

	mergeDefaultEvents(target, source);
	assert.equal(target.events.length, 1);
	assert.equal(target.events[0].folder, 'first');
});

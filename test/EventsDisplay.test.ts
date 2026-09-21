import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEvent, ISortingRule } from '../shared';
import {
	decodeEventFolderFilterValue,
	encodeEventFolderFilterValue,
	resolveNewEventFolder,
	compareEventsBySortingRules,
	computeEventFolderOptions,
	filterEventIdsByFolder,
	getSortedEventIdsForDisplay,
	haveSameUniqueStringSet,
	reconcileEventFolderFilter,
	resolveEventNavigationFolderFilter,
	stringArraysEqual,
} from '../webview/ui/components/events/EventsDisplay';

const ALL = '__ALL__';
const NONE = '__NO_FOLDER__';

function createEvent(
	id: string,
	options: Partial<ICgEvent> = {},
): ICgEvent {
	return {
		id,
		actions: [],
		checks: [],
		triggers: [],
		...options,
	};
}

test('event display array helpers distinguish order and duplicate IDs', () => {
	assert.equal(stringArraysEqual(['a', 'b'], ['a', 'b']), true);
	assert.equal(stringArraysEqual(['a', 'b'], ['b', 'a']), false);
	assert.equal(haveSameUniqueStringSet(['a', 'b'], ['b', 'a']), true);
	assert.equal(haveSameUniqueStringSet(['a', 'b'], ['a', 'a']), false);
});

test('folder options are trimmed, deduplicated, and sorted', () => {
	const events = [
		createEvent('a', { folder: ' beta ' }),
		createEvent('b', { folder: 'alpha' }),
		createEvent('c', { folder: 'beta' }),
		createEvent('d', { folder: '   ' }),
	];

	assert.deepEqual(computeEventFolderOptions(events), ['alpha', 'beta']);
});

test('folder filter reconciliation preserves only explicit single-folder renames and falls back to all', () => {
	assert.deepEqual(
		reconcileEventFolderFilter(
			['old'],
			['new'],
			[encodeEventFolderFilterValue('old')],
			ALL,
			NONE,
			{ previousFolder: 'old', nextFolder: 'new' },
		),
		[encodeEventFolderFilterValue('new')],
	);
	assert.deepEqual(
		reconcileEventFolderFilter(['old'], ['new'], [encodeEventFolderFilterValue('old')], ALL, NONE),
		[ALL],
	);
	assert.deepEqual(
		reconcileEventFolderFilter(['old'], [], ['old'], ALL, NONE),
		[ALL],
	);
	assert.deepEqual(
		reconcileEventFolderFilter(['a'], ['a'], [NONE, NONE], ALL, NONE),
		[NONE],
	);
});

test('folder filtering handles named and no-folder events', () => {
	const events = [
		createEvent('a', { folder: 'alpha' }),
		createEvent('b', { folder: '' }),
		createEvent('c', { folder: ' beta ' }),
	];
	const byId = new Map(events.map((event) => [event.id, event]));
	const ids = events.map((event) => event.id);
	const getEvent = (id: string) => byId.get(id);

	assert.strictEqual(filterEventIdsByFolder(ids, [ALL], getEvent, ALL, NONE), ids);
	assert.deepEqual(filterEventIdsByFolder(ids, [NONE], getEvent, ALL, NONE), ['b']);
	assert.deepEqual(filterEventIdsByFolder(ids, [encodeEventFolderFilterValue('beta')], getEvent, ALL, NONE), ['c']);
});

test('sorting rules support booleans, logic counts, and index order', () => {
	const events = [
		createEvent('event-b', { disabled: false, actions: [{ type: 'a' }, { type: 'b' }] }),
		createEvent('event-a', { disabled: true }),
		createEvent('event-c', { disabled: false, actions: [{ type: 'a' }] }),
	];
	const byId = new Map(events.map((event) => [event.id, event]));
	const indexById = new Map(events.map((event, index) => [event.id, index]));
	const getIndex = (id: string) => indexById.get(id) ?? -1;

	const rules: ISortingRule[] = [
		{ target: 'disabled', order: 'asc' },
		{ target: 'id', order: 'asc' },
	];
	assert.equal(compareEventsBySortingRules(events[0], events[1], rules, getIndex) < 0, true);

	assert.deepEqual(
		getSortedEventIdsForDisplay(
			events.map((event) => event.id),
			[ALL],
			rules,
			(id) => byId.get(id),
			getIndex,
			ALL,
			NONE,
		),
		['event-b', 'event-c', 'event-a'],
	);

	assert.deepEqual(
		getSortedEventIdsForDisplay(
			events.map((event) => event.id),
			[ALL],
			[{ target: 'actions', order: 'desc' }],
			(id) => byId.get(id),
			getIndex,
			ALL,
			NONE,
		),
		['event-b', 'event-c', 'event-a'],
	);

	const originalIds = events.map((event) => event.id);
	assert.strictEqual(
		getSortedEventIdsForDisplay(
			originalIds,
			[ALL],
			[{ target: 'index', order: 'asc' }],
			(id) => byId.get(id),
			getIndex,
			ALL,
			NONE,
		),
		originalIds,
	);
});


test('new event folder follows a single active folder filter', () => {
	assert.equal(resolveNewEventFolder([encodeEventFolderFilterValue('Folder A')], '__ALL__', '__NO_FOLDER__'), 'Folder A');
	assert.equal(resolveNewEventFolder(['__NO_FOLDER__'], '__ALL__', '__NO_FOLDER__'), '');
});

test('new event folder stays unset for all-folders or multi-folder filters', () => {
	assert.equal(resolveNewEventFolder(['__ALL__'], '__ALL__', '__NO_FOLDER__'), undefined);
	assert.equal(resolveNewEventFolder(['A', 'B'], '__ALL__', '__NO_FOLDER__'), undefined);
	assert.equal(resolveNewEventFolder([], '__ALL__', '__NO_FOLDER__'), undefined);
});

test('folder filter encoding keeps sentinel-looking folder names distinct', () => {
	const events = [
		createEvent('all-name', { folder: ALL }),
		createEvent('none-name', { folder: NONE }),
		createEvent('empty', { folder: '' }),
	];
	const byId = new Map(events.map((event) => [event.id, event]));
	const ids = events.map((event) => event.id);
	const getEvent = (id: string) => byId.get(id);

	assert.deepEqual(filterEventIdsByFolder(ids, [encodeEventFolderFilterValue(ALL)], getEvent, ALL, NONE), ['all-name']);
	assert.deepEqual(filterEventIdsByFolder(ids, [encodeEventFolderFilterValue(NONE)], getEvent, ALL, NONE), ['none-name']);
	assert.deepEqual(filterEventIdsByFolder(ids, [NONE], getEvent, ALL, NONE), ['empty']);
	assert.strictEqual(filterEventIdsByFolder(ids, [ALL], getEvent, ALL, NONE), ids);
});

test('folder filter values round-trip arbitrary folder text', () => {
	for (const folder of [ALL, NONE, 'folder:value', 'a/b c%', '日本語']) {
		assert.equal(decodeEventFolderFilterValue(encodeEventFolderFilterValue(folder)), folder);
	}
});

test('event navigation expands folder filters only when the target is hidden', () => {
	const alpha = encodeEventFolderFilterValue('alpha');
	const beta = encodeEventFolderFilterValue('beta');
	const target = createEvent('target', { folder: ' beta ' });

	assert.deepEqual(
		resolveEventNavigationFolderFilter([alpha], target, ALL, NONE),
		[alpha, beta],
	);
	assert.equal(
		resolveEventNavigationFolderFilter([beta], target, ALL, NONE),
		undefined,
	);
	assert.equal(
		resolveEventNavigationFolderFilter([ALL], target, ALL, NONE),
		undefined,
	);
	assert.equal(
		resolveEventNavigationFolderFilter([], target, ALL, NONE),
		undefined,
	);
	assert.equal(
		resolveEventNavigationFolderFilter([alpha], undefined, ALL, NONE),
		undefined,
	);
});

test('event navigation can reveal no-folder targets without losing existing filters', () => {
	const alpha = encodeEventFolderFilterValue('alpha');
	assert.deepEqual(
		resolveEventNavigationFolderFilter([alpha], createEvent('target', { folder: '   ' }), ALL, NONE),
		[alpha, NONE],
	);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLogicLibraryBreadcrumbModel, resolveLogicLibraryBreadcrumbStep } from '../webview/ui/components/events/LogicLibraryModel';

test('breadcrumb layout hides one segment per overflowing measurement', () => {
	assert.deepEqual(resolveLogicLibraryBreadcrumbStep({
		totalSegments: 5,
		currentStartIndex: 1,
		overflow: true,
		clientWidth: 320,
		lastMeasuredWidth: 500,
	}), {
		nextStartIndex: 2,
		nextMeasuredWidth: 320,
	});
});

test('breadcrumb layout keeps expanding after a large width increase while content still fits', () => {
	const first = resolveLogicLibraryBreadcrumbStep({
		totalSegments: 5,
		currentStartIndex: 3,
		overflow: false,
		clientWidth: 640,
		lastMeasuredWidth: 320,
	});
	assert.deepEqual(first, {
		nextStartIndex: 2,
		nextMeasuredWidth: 320,
	});

	const second = resolveLogicLibraryBreadcrumbStep({
		totalSegments: 5,
		currentStartIndex: first.nextStartIndex,
		overflow: false,
		clientWidth: 640,
		lastMeasuredWidth: first.nextMeasuredWidth,
	});
	assert.deepEqual(second, {
		nextStartIndex: 1,
		nextMeasuredWidth: 320,
	});
});

test('breadcrumb layout stops expansion after the next restored segment overflows', () => {
	const overflowed = resolveLogicLibraryBreadcrumbStep({
		totalSegments: 5,
		currentStartIndex: 1,
		overflow: true,
		clientWidth: 640,
		lastMeasuredWidth: 320,
	});
	assert.deepEqual(overflowed, {
		nextStartIndex: 2,
		nextMeasuredWidth: 640,
	});

	assert.deepEqual(resolveLogicLibraryBreadcrumbStep({
		totalSegments: 5,
		currentStartIndex: overflowed.nextStartIndex,
		overflow: false,
		clientWidth: 640,
		lastMeasuredWidth: overflowed.nextMeasuredWidth,
	}), {
		nextStartIndex: 2,
		nextMeasuredWidth: 640,
	});
});

test('breadcrumb layout resets trivial paths and normalizes invalid start indexes', () => {
	assert.deepEqual(resolveLogicLibraryBreadcrumbStep({
		totalSegments: 1,
		currentStartIndex: 8,
		overflow: true,
		clientWidth: 200,
		lastMeasuredWidth: 100,
	}), {
		nextStartIndex: 0,
		nextMeasuredWidth: 200,
	});
	assert.equal(resolveLogicLibraryBreadcrumbStep({
		totalSegments: 4,
		currentStartIndex: -2,
		overflow: false,
		clientWidth: 200,
		lastMeasuredWidth: 200,
	}).nextStartIndex, 0);
});


test('breadcrumb model builds hidden and visible segment paths from a clamped start index', () => {
	assert.deepEqual(
		buildLogicLibraryBreadcrumbModel(['Animals', 'Cats', 'Actions'], 2, 'Root'),
		{
			displayStartIndex: 2,
			hiddenSegments: [
				{ label: 'Root', path: [] },
				{ label: 'Animals', path: ['Animals'] },
			],
			visibleSegments: [
				{ index: 2, label: 'Cats', path: ['Animals', 'Cats'], isCurrent: false },
				{ index: 3, label: 'Actions', path: ['Animals', 'Cats', 'Actions'], isCurrent: true },
			],
		},
	);
});

test('breadcrumb model normalizes invalid start indexes', () => {
	assert.equal(buildLogicLibraryBreadcrumbModel(['A'], -4, 'Root').displayStartIndex, 0);
	assert.equal(buildLogicLibraryBreadcrumbModel(['A'], 99, 'Root').displayStartIndex, 1);
	assert.equal(buildLogicLibraryBreadcrumbModel(['A'], Number.NaN, 'Root').displayStartIndex, 0);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppNavScrollState } from '../webview/ui/AppInteraction';

test('app nav scroll policy keeps JSON mode unchanged', () => {
	assert.deepEqual(
		resolveAppNavScrollState({
			mode: 'json',
			scrollTop: 200,
			lastScrollTop: 20,
			headerHeight: 60,
			navCollapsed: false,
		}),
		{ lastScrollTop: 20, navCollapsed: false },
	);
});

test('app nav scroll policy reveals the nav near the top and inside the header region', () => {
	assert.deepEqual(
		resolveAppNavScrollState({
			mode: 'visual',
			scrollTop: 2,
			lastScrollTop: 80,
			headerHeight: 60,
			navCollapsed: true,
		}),
		{ lastScrollTop: 2, navCollapsed: false },
	);
	assert.deepEqual(
		resolveAppNavScrollState({
			mode: 'visual',
			scrollTop: 40,
			lastScrollTop: 80,
			headerHeight: 60,
			navCollapsed: true,
		}),
		{ lastScrollTop: 40, navCollapsed: false },
	);
});

test('app nav scroll policy collapses only after a meaningful downward delta', () => {
	assert.deepEqual(
		resolveAppNavScrollState({
			mode: 'visual',
			scrollTop: 107,
			lastScrollTop: 100,
			headerHeight: 60,
			navCollapsed: false,
		}),
		{ lastScrollTop: 107, navCollapsed: true },
	);
	assert.deepEqual(
		resolveAppNavScrollState({
			mode: 'visual',
			scrollTop: 106,
			lastScrollTop: 100,
			headerHeight: 60,
			navCollapsed: false,
		}),
		{ lastScrollTop: 106, navCollapsed: false },
	);
});

test('app nav scroll policy reveals after upward movement beyond the show threshold', () => {
	assert.deepEqual(
		resolveAppNavScrollState({
			mode: 'visual',
			scrollTop: 98,
			lastScrollTop: 100,
			headerHeight: 60,
			navCollapsed: true,
		}),
		{ lastScrollTop: 98, navCollapsed: false },
	);
	assert.deepEqual(
		resolveAppNavScrollState({
			mode: 'visual',
			scrollTop: 99,
			lastScrollTop: 100,
			headerHeight: 60,
			navCollapsed: true,
		}),
		{ lastScrollTop: 99, navCollapsed: true },
	);
});

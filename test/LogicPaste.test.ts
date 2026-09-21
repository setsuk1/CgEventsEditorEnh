import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventsDocument } from '../shared/events';
import { editor } from '../webview/editor/CgEventsEditor';
import { pasteAt } from '../webview/ui/components/events/LogicItemsListMenuActions';

function createDocument(): ICgEventsDocument {
	return {
		config: {
			stage: {
				width: 800,
				height: 600,
				backgroundColor: '#999999',
				resolutionPolicy: 'showAll' as const,
				alignHorizontal: 'center' as const,
				alignVertical: 'middle' as const,
			},
			preload: { resourcesExclude: [], sources: [] },
		},
		events: [{
			id: 'event_1',
			actions: [{ type: 'existing', data: {} }],
			checks: [],
			triggers: [],
		}],
	};
}

function installClipboard(readText: () => Promise<string>): () => void {
	const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value: { clipboard: { readText } },
	});
	return () => {
		if (previous) Object.defineProperty(globalThis, 'navigator', previous);
		else delete (globalThis as { navigator?: unknown }).navigator;
	};
}

function clipboardPayload(type = 'pasted'): string {
	return JSON.stringify({ type: 'action', blocks: [{ type, data: {} }] });
}

test('async paste is cancelled when its target section changes while reading the clipboard', async () => {
	let resolveClipboard!: (value: string) => void;
	const clipboardPromise = new Promise<string>((resolve) => { resolveClipboard = resolve; });
	const restoreNavigator = installClipboard(() => clipboardPromise);

	try {
		editor.setCgEventsJson({ format: 'json', json: createDocument() });
		const pendingPaste = pasteAt('event_1', 'action', 1);

		editor.insertLogic('event_1', 'action', { type: 'intervening', data: {} }, 0);
		resolveClipboard(clipboardPayload());
		await pendingPaste;

		assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), [
			'intervening',
			'existing',
		]);
	} finally {
		restoreNavigator();
	}
});

test('async paste is cancelled when the originating request becomes stale', async () => {
	let resolveClipboard!: (value: string) => void;
	const clipboardPromise = new Promise<string>((resolve) => { resolveClipboard = resolve; });
	const restoreNavigator = installClipboard(() => clipboardPromise);
	let current = true;

	try {
		editor.setCgEventsJson({ format: 'json', json: createDocument() });
		const pendingPaste = pasteAt('event_1', 'action', 1, () => current);

		current = false;
		resolveClipboard(clipboardPayload());
		assert.equal(await pendingPaste, false);
		assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), [
			'existing',
		]);
	} finally {
		restoreNavigator();
	}
});

test('async paste still inserts when the target section is unchanged', async () => {
	const restoreNavigator = installClipboard(async () => clipboardPayload());

	try {
		editor.setCgEventsJson({ format: 'json', json: createDocument() });
		assert.equal(await pasteAt('event_1', 'action', 1), true);

		assert.deepEqual(editor.getLogicBlocks('event_1', 'action').map((block) => block.type), [
			'existing',
			'pasted',
		]);
	} finally {
		restoreNavigator();
	}
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	appendLogicLibraryHistory,
	getLogicLibraryHistoryTarget,
	logicLibraryPathsEqual,
} from '../webview/ui/components/events/LogicLibraryModel';

test('logic library path equality compares ordered segments', () => {
	assert.equal(logicLibraryPathsEqual(['a', 'b'], ['a', 'b']), true);
	assert.equal(logicLibraryPathsEqual(['a', 'b'], ['a', 'c']), false);
	assert.equal(logicLibraryPathsEqual(['a'], ['a', 'b']), false);
});

test('logic library navigation appends after the current history position', () => {
	const next = appendLogicLibraryHistory({
		history: [[], ['a'], ['a', 'old-forward']],
		historyIdx: 1,
	}, ['b']);

	assert.deepEqual(next, {
		history: [[], ['a'], ['b']],
		historyIdx: 2,
	});
});

test('logic library navigation resolves back and forward targets safely', () => {
	const state = {
		history: [[], ['a'], ['a', 'b']],
		historyIdx: 1,
	};
	assert.deepEqual(getLogicLibraryHistoryTarget(state, -1), { path: [], historyIdx: 0 });
	assert.deepEqual(getLogicLibraryHistoryTarget(state, 1), { path: ['a', 'b'], historyIdx: 2 });
	assert.equal(getLogicLibraryHistoryTarget({ ...state, historyIdx: 0 }, -1), undefined);
	assert.equal(getLogicLibraryHistoryTarget({ ...state, historyIdx: 2 }, 1), undefined);
});

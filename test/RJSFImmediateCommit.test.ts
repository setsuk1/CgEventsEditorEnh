import assert from 'node:assert/strict';
import test from 'node:test';
import {
	commitRjsfWidgetValue,
	getRjsfImmediateCommitRequest,
} from '../webview/ui/rjsf/widgets/RJSFImmediateCommit';

test('RJSF immediate commit request is resolved from form context only when callable', () => {
	const request = (): void => undefined;
	assert.strictEqual(getRjsfImmediateCommitRequest({ requestImmediateCommit: request }), request);
	assert.equal(getRjsfImmediateCommitRequest({ requestImmediateCommit: true }), undefined);
	assert.equal(getRjsfImmediateCommitRequest(undefined), undefined);
});

test('RJSF widgets request immediate commit before propagating their value', () => {
	const calls: string[] = [];
	commitRjsfWidgetValue(
		['a', 'b'],
		(value) => { calls.push(`change:${value.join(',')}`); },
		() => { calls.push('commit'); },
	);
	assert.deepEqual(calls, ['commit', 'change:a,b']);
});

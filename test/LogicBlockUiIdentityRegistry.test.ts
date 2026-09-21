import assert from 'node:assert/strict';
import test from 'node:test';
import type { ICgEventLogicBlock } from '../shared';
import { LogicBlockUiIdentityRegistry } from '../webview/editor/LogicBlockUiIdentityRegistry';

function block(type: string): ICgEventLogicBlock {
	return { type, data: {} };
}

test('logic block UI identities are stable and unique per block', () => {
	const registry = new LogicBlockUiIdentityRegistry();
	const first = block('first');
	const second = block('second');

	assert.equal(registry.getKey(first), 'logic-1');
	assert.equal(registry.getKey(first), 'logic-1');
	assert.equal(registry.getKey(second), 'logic-2');
});

test('logic block UI identity transfers to replacement blocks', () => {
	const registry = new LogicBlockUiIdentityRegistry();
	const previous = block('previous');
	const replacement = block('replacement');

	const key = registry.getKey(previous);
	registry.transfer(previous, replacement);

	assert.equal(registry.getKey(replacement), key);
	assert.equal(registry.getKey(previous), key);
});

test('transferring an untracked block does not allocate an identity', () => {
	const registry = new LogicBlockUiIdentityRegistry();
	const previous = block('previous');
	const replacement = block('replacement');

	registry.transfer(previous, replacement);

	assert.equal(registry.getKey(replacement), 'logic-1');
	assert.equal(registry.getKey(previous), 'logic-2');
});

test('reset drops all identities and restarts generated keys', () => {
	const registry = new LogicBlockUiIdentityRegistry();
	const first = block('first');
	const second = block('second');

	assert.equal(registry.getKey(first), 'logic-1');
	assert.equal(registry.getKey(second), 'logic-2');

	registry.reset();

	assert.equal(registry.getKey(second), 'logic-1');
	assert.equal(registry.getKey(first), 'logic-2');
});

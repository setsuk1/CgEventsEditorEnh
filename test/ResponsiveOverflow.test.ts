import assert from 'node:assert/strict';
import test from 'node:test';
import { isHorizontallyOverflowing } from '../webview/ui/components/events/ResponsiveLayout';

test('responsive overflow predicate uses the same one-pixel tolerance as compact headers', () => {
	assert.equal(isHorizontallyOverflowing({ scrollWidth: 100, clientWidth: 100 }), false);
	assert.equal(isHorizontallyOverflowing({ scrollWidth: 101, clientWidth: 100 }), false);
	assert.equal(isHorizontallyOverflowing({ scrollWidth: 102, clientWidth: 100 }), true);
	assert.equal(isHorizontallyOverflowing(null), false);
});

test('responsive overflow predicate normalizes custom tolerance', () => {
	assert.equal(isHorizontallyOverflowing({ scrollWidth: 104, clientWidth: 100 }, 4), false);
	assert.equal(isHorizontallyOverflowing({ scrollWidth: 105, clientWidth: 100 }, 4), true);
	assert.equal(isHorizontallyOverflowing({ scrollWidth: 101, clientWidth: 100 }, Number.NaN), true);
});

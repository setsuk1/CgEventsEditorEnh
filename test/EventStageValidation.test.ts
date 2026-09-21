import assert from 'node:assert/strict';
import test from 'node:test';
import { isCgEventsDocument } from '../shared/events';

function documentWithStage(stage?: unknown) {
	return {
		config: stage === undefined ? {} : { stage },
		events: [] as unknown[],
	};
}

test('events document validation keeps partial stage patches valid', () => {
	assert.equal(isCgEventsDocument(documentWithStage()), true);
	assert.equal(isCgEventsDocument(documentWithStage({ width: 800 })), true);
	assert.equal(isCgEventsDocument(documentWithStage({
		width: 800,
		height: 600,
		backgroundColor: '#999999',
		resolutionPolicy: 'showAll',
		alignHorizontal: 'center',
		alignVertical: 'middle',
	})), true);
});

test('events document validation rejects malformed stage primitive fields', () => {
	assert.equal(isCgEventsDocument(documentWithStage({ width: '800' })), false);
	assert.equal(isCgEventsDocument(documentWithStage({ width: Number.NaN })), false);
	assert.equal(isCgEventsDocument(documentWithStage({ height: Number.POSITIVE_INFINITY })), false);
	assert.equal(isCgEventsDocument(documentWithStage({ backgroundColor: {} })), false);
});

test('events document validation rejects unsupported stage enum values', () => {
	assert.equal(isCgEventsDocument(documentWithStage({ resolutionPolicy: 'stretch' })), false);
	assert.equal(isCgEventsDocument(documentWithStage({ alignHorizontal: 'middle' })), false);
	assert.equal(isCgEventsDocument(documentWithStage({ alignVertical: 'center' })), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLogicDropSection, resolveLogicSectionMetadata } from '../webview/ui/components/events/LogicItemsListInteraction';

function createElement(options: {
	classes?: string[];
	closest?: Record<string, Element | null>;
	attributes?: Record<string, string | undefined>;
} = {}): Element {
	const classes = new Set(options.classes ?? []);
	return {
		classList: { contains: (name: string) => classes.has(name) },
		closest: (selector: string) => options.closest?.[selector] ?? null,
		getAttribute: (name: string) => options.attributes?.[name] ?? null,
	} as unknown as Element;
}

test('logic drop section resolves a direct items container', () => {
	const section = createElement({ attributes: { 'data-event-id': 'event_1', 'data-block-type': 'action' } });
	const items = createElement({
		classes: ['cgenh-event-section__items'],
		closest: { '.cgenh-event-section': section },
	});

	const result = resolveLogicDropSection([items]);
	assert.ok(result);
	assert.strictEqual(result.itemsElement, items);
	assert.equal(result.eventId, 'event_1');
	assert.equal(result.blockType, 'action');
});

test('logic drop section walks from descendants and skips unrelated elements', () => {
	const section = createElement({ attributes: { 'data-event-id': 'event_2', 'data-block-type': 'check' } });
	const items = createElement({
		classes: ['cgenh-event-section__items'],
		closest: { '.cgenh-event-section': section },
	});
	const unrelated = createElement();
	const descendant = createElement({ closest: { '.cgenh-event-section__items': items } });

	const result = resolveLogicDropSection([unrelated, descendant]);
	assert.ok(result);
	assert.strictEqual(result.itemsElement, items);
	assert.equal(result.eventId, 'event_2');
	assert.equal(result.blockType, 'check');
});

test('logic drop section rejects malformed section metadata', () => {
	const section = createElement({ attributes: { 'data-event-id': 'event_3', 'data-block-type': 'invalid' } });
	const items = createElement({
		classes: ['cgenh-event-section__items'],
		closest: { '.cgenh-event-section': section },
	});

	assert.equal(resolveLogicDropSection([items]), undefined);
});


test('logic section metadata validates event and block type together', () => {
	const valid = createElement({ attributes: { 'data-event-id': 'event_4', 'data-block-type': 'trigger' } });
	assert.deepEqual(resolveLogicSectionMetadata(valid), { eventId: 'event_4', blockType: 'trigger' });

	const missingEvent = createElement({ attributes: { 'data-block-type': 'action' } });
	assert.equal(resolveLogicSectionMetadata(missingEvent), undefined);

	const invalidBlockType = createElement({ attributes: { 'data-event-id': 'event_5', 'data-block-type': 'invalid' } });
	assert.equal(resolveLogicSectionMetadata(invalidBlockType), undefined);
});

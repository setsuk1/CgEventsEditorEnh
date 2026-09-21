import { ICgEventsSchema, type ICgEventsSchemaEntry } from '@shared';
import { EventBlockType } from '../../../editor/eventBlockTypes';

function getOwnEntry(
	section: Record<string, ICgEventsSchemaEntry> | undefined,
	key: string,
): ICgEventsSchemaEntry | undefined {
	if (!section || !Object.hasOwn(section, key)) return undefined;
	return section[key];
}

export function getOwnLogicSchemaSectionEntry(
	schema: ICgEventsSchema | undefined,
	blockType: EventBlockType,
	entryKey: string,
): ICgEventsSchemaEntry | undefined {
	if (!schema) return undefined;
	return getOwnEntry(schema[blockType], entryKey);
}

export function getLogicSchemaEntry(
	schema: ICgEventsSchema | undefined,
	blockType: EventBlockType,
	entryKey: string,
): ICgEventsSchemaEntry | undefined {
	if (!schema) return undefined;
	return getOwnLogicSchemaSectionEntry(schema, blockType, entryKey)
		?? getOwnEntry(schema.definition, entryKey);
}

export function hasLogicSchemaEntry(
	schema: ICgEventsSchema | undefined,
	blockType: EventBlockType,
	entryKey: string,
): boolean {
	return getLogicSchemaEntry(schema, blockType, entryKey) !== undefined;
}

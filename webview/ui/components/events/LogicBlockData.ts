import { type ICgEvent, type ICgEventLogicBlock, isCgEventsDocument } from '@shared';

export function normalizeLogicBlockList(value: unknown): ICgEventLogicBlock[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const blocks: ICgEventLogicBlock[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			return undefined;
		}
		const record = entry as Record<string, unknown>;
		const type = typeof record.type === 'string' ? record.type.trim() : '';
		if (!type) {
			return undefined;
		}

		const rawData = record.data;
		if (rawData === undefined) {
			blocks.push({ type });
			continue;
		}
		if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
			return undefined;
		}
		blocks.push({ type, data: rawData as Record<string, unknown> });
	}

	const candidateEvent: ICgEvent = { id: 'json-list', actions: blocks, checks: [], triggers: [] };
	return isCgEventsDocument({ config: {}, events: [candidateEvent] }) ? blocks : undefined;
}

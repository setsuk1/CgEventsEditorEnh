import type { ICgEvent } from '@shared';
import { cloneEditorValue } from '../../../editor/EditorSnapshots';

const LOGIC_BLOCK_KEYS = new Set(['actions', 'checks', 'triggers']);
const NUMERIC_EVENT_KEYS = new Set(['startTime', 'checkInterval', 'repeats', 'repeatInterval']);

export function buildEventMetaEditorData(event: ICgEvent): Record<string, any> {
	const meta: Record<string, any> = {};
	for (const [key, value] of Object.entries(event ?? {})) {
		if (LOGIC_BLOCK_KEYS.has(key)) {
			continue;
		}
		meta[key] = cloneEditorValue(value);
	}

	if (typeof meta.referenceOnly === 'boolean') {
		meta.referenceOnly = meta.referenceOnly ? 1 : 0;
	}
	return meta;
}

export function buildEventPatchFromMeta(meta: Record<string, any>): Partial<ICgEvent> {
	const patch: Partial<ICgEvent> = {};

	for (const [key, value] of Object.entries(meta)) {
		if (LOGIC_BLOCK_KEYS.has(key)) {
			continue;
		}

		if (key === 'id') {
			if (typeof value === 'string') {
				patch.id = value.trim();
			}
			continue;
		}

		if (key === 'folder') {
			patch.folder = typeof value === 'string' ? value.trim() : '';
			continue;
		}

		if (key === 'referenceOnly') {
			patch.referenceOnly = value === 1 || value === true;
			continue;
		}

		if (key === 'disabled') {
			patch.disabled = !!value;
			continue;
		}

		if (key === 'devOnly') {
			patch.devOnly = !!value;
			continue;
		}

		if (NUMERIC_EVENT_KEYS.has(key)) {
			if (typeof value === 'number' && Number.isFinite(value)) {
				patch[key] = value;
			}
			continue;
		}

		if (key === 'color') {
			if (typeof value === 'string') {
				patch.color = value;
			}
			continue;
		}

		patch[key] = cloneEditorValue(value);
	}

	return patch;
}

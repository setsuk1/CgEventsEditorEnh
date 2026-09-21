export type ICgEventsFormat = 'json' | 'lz' | 'error';

export interface ICgEventsTransformError {
	format: 'error';
	error: any;
	documentVersion?: number;
}

export interface ICgEventsParseSuccess {
	format: Exclude<ICgEventsFormat, 'error'>;
	json: ICgEventsDocument;
	documentVersion?: number;
}

export type ICgEventsParseResult = ICgEventsParseSuccess | ICgEventsTransformError;

export interface ICgEventsSerializeSuccess {
	format: Exclude<ICgEventsFormat, 'error'>;
	text: string;
}

export type ICgEventsSerializeResult = ICgEventsSerializeSuccess | ICgEventsTransformError;

export interface ICgEventLogicBlock {
	type: string;
	data?: Record<string, unknown>;
}

export interface ICgEvent {
	id: string;
	disabled?: boolean;
	folder?: string;
	startTime?: number;
	checkInterval?: number;
	repeats?: number;
	repeatInterval?: number;
	devOnly?: boolean;
	referenceOnly?: boolean;
	actions: ICgEventLogicBlock[];
	checks: ICgEventLogicBlock[];
	triggers: ICgEventLogicBlock[];
	color?: string;
	[key: string]: unknown;
}

export interface ICgEventsDocumentConfigStage {
	width: number;
	height: number;
	backgroundColor: string;
	resolutionPolicy: 'showAll' | 'exactFit' | 'noBorder' | 'fixedWidth' | 'fixedHeight' | 'origin';
	alignHorizontal: 'left' | 'center' | 'right';
	alignVertical: 'top' | 'middle' | 'bottom';
}

export interface ICgEventsDocumentConfigPreload {
	resourcesExclude: string[];
	sources: string[];
}

export interface ICgEventsDocumentConfig {
	stage: ICgEventsDocumentConfigStage;
	preload: ICgEventsDocumentConfigPreload;
	configs?: Record<string, any> | any[];
}

export interface ICgEventsDocument {
	$schema?: string;
	config: ICgEventsDocumentConfig;
	events: ICgEvent[];
}

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const STAGE_RESOLUTION_POLICIES = new Set(['showAll', 'exactFit', 'noBorder', 'fixedWidth', 'fixedHeight', 'origin']);
const STAGE_HORIZONTAL_ALIGNMENTS = new Set(['left', 'center', 'right']);
const STAGE_VERTICAL_ALIGNMENTS = new Set(['top', 'middle', 'bottom']);

function isRecord(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isOptionalFiniteNumber(value: unknown): boolean {
	return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isOptionalBoolean(value: unknown): boolean {
	return value === undefined || typeof value === 'boolean';
}

function isEventsStage(value: unknown): boolean {
	if (!isRecord(value)) return false;
	if (!isOptionalFiniteNumber(value.width)) return false;
	if (!isOptionalFiniteNumber(value.height)) return false;
	if (value.backgroundColor !== undefined && typeof value.backgroundColor !== 'string') return false;
	if (value.resolutionPolicy !== undefined && (typeof value.resolutionPolicy !== 'string' || !STAGE_RESOLUTION_POLICIES.has(value.resolutionPolicy))) return false;
	if (value.alignHorizontal !== undefined && (typeof value.alignHorizontal !== 'string' || !STAGE_HORIZONTAL_ALIGNMENTS.has(value.alignHorizontal))) return false;
	if (value.alignVertical !== undefined && (typeof value.alignVertical !== 'string' || !STAGE_VERTICAL_ALIGNMENTS.has(value.alignVertical))) return false;
	return true;
}

function isEventsConfig(value: unknown): boolean {
	if (!isRecord(value)) return false;
	if (value.stage !== undefined && !isEventsStage(value.stage)) return false;
	if (value.preload !== undefined) {
		if (!isRecord(value.preload)) return false;
		if (value.preload.sources !== undefined && !isStringArray(value.preload.sources)) return false;
		if (value.preload.resourcesExclude !== undefined && !isStringArray(value.preload.resourcesExclude)) return false;
	}
	if (value.configs !== undefined && !isRecord(value.configs) && !Array.isArray(value.configs)) return false;
	return true;
}

function hasUnsafeObjectKeys(root: unknown): boolean {
	if (root === null || typeof root !== 'object') return false;
	const pending: object[] = [root as object];
	const visited = new WeakSet<object>();
	while (pending.length) {
		const current = pending.pop()!;
		if (visited.has(current)) continue;
		visited.add(current);
		if (Array.isArray(current)) {
			for (const item of current) {
				if (item !== null && typeof item === 'object') pending.push(item as object);
			}
			continue;
		}
		for (const key of Object.keys(current)) {
			if (UNSAFE_OBJECT_KEYS.has(key)) return true;
			const value = (current as Record<string, unknown>)[key];
			if (value !== null && typeof value === 'object') pending.push(value as object);
		}
	}
	return false;
}

function isLogicBlock(value: unknown): value is ICgEventLogicBlock {
	return isRecord(value) && typeof value.type === 'string' &&
		(value.data === undefined || isRecord(value.data));
}

function isLogicBlockList(value: unknown): value is ICgEventLogicBlock[] {
	return Array.isArray(value) && value.every(isLogicBlock);
}

function isEvent(value: unknown): value is ICgEvent {
	return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 && value.id === value.id.trim() &&
		isOptionalBoolean(value.disabled) &&
		(value.folder === undefined || typeof value.folder === 'string') &&
		isOptionalFiniteNumber(value.startTime) &&
		isOptionalFiniteNumber(value.checkInterval) &&
		isOptionalFiniteNumber(value.repeats) &&
		isOptionalFiniteNumber(value.repeatInterval) &&
		isOptionalBoolean(value.devOnly) &&
		isOptionalBoolean(value.referenceOnly) &&
		(value.color === undefined || typeof value.color === 'string') &&
		isLogicBlockList(value.actions) && isLogicBlockList(value.checks) && isLogicBlockList(value.triggers);
}

/** Validate the minimum events-document contract at serialization/message boundaries. */
export function isCgEventsDocument(value: unknown): value is ICgEventsDocument {
	if (!isRecord(value) || hasUnsafeObjectKeys(value) || !isEventsConfig(value.config) || !Array.isArray(value.events)) return false;
	if (value.$schema !== undefined && typeof value.$schema !== 'string') return false;

	const eventIds = new Set<string>();
	for (const event of value.events) {
		if (!isEvent(event) || eventIds.has(event.id)) return false;
		eventIds.add(event.id);
	}
	return true;
}

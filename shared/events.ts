
export type ICgEventsFormat = 'json' | 'lz' | 'error';

export interface ICgEventsTransformError {
	format: 'error';
	error: any;
}

export interface ICgEventsParseSuccess {
	format: Exclude<ICgEventsFormat, 'error'>;
	json: ICgEventsDocument;
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
	configs?: Record<string, any>;
}

export interface ICgEventsDocument {
	$schema: string;
	config: ICgEventsDocumentConfig;
	events: ICgEvent[];
}

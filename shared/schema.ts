export type ICgEventsSchemaTypeSimple = 'number' | 'boolean' | 'string' | 'object' | 'color' | `#${string}`;

export interface ICgEventsSchemaPropertyBase {
	key: string;
	type?: ICgEventsSchemaTypeSimple | 'array';
	format?: string;
	label?: Record<string, string>;
	unit?: Record<string, string>;
	line?: number;
	description?: Record<string, string>;
	enum?: Array<string | number | boolean>;
	enumTitles?: Record<string, string[]>;
	default?: Record<string, any>;
	helper?: string;
	visible?: string;
	indent?: number;
	required?: number;
	items?: ICgEventsSchemaProperty;
	multiple?: boolean;
	collection?: 'array';
	suggest?: string[];
	suggestFilter?: 'none';
	suggestTitles?: Record<string, any>;
	definition?: string;
	gridColumns?: number;
	gridOptions?: string[];
	parent?: string;
	editorOptions?: Record<string, any>;
	collapsed?: number;
	uniqueItems?: number;
	propertyOrder?: number;
	params?: {
		minimum?: number,
		maximum?: number
		[key: string]: any;
	};
	[key: string]: any;
}

export interface ICgEventsSchemaPropertyArray extends ICgEventsSchemaPropertyBase {
	arrayItem?: string;
	type: 'array';
}

export interface ICgEventsSchemaPropertySingle extends ICgEventsSchemaPropertyBase {
	type?: ICgEventsSchemaTypeSimple;
}

export type ICgEventsSchemaProperty = ICgEventsSchemaPropertySingle | ICgEventsSchemaPropertyArray;

export interface ICgEventsSchemaEntry {
	project: string;
	source: { path: string; filename: string };
	toString: {};
	className: string;
	timestamp: number;
	label: Record<string, string>;
	description: Record<string, string>;
	allpaths: Record<string, string[][]>;
	properties: ICgEventsSchemaProperty[];
	format?: string;
	helper?: string;
	editorOptions?: Record<string, any>;
	use?: 'config';
	gridOptions?: string[];
	deprecated?: boolean;
}

export interface ICgEventsSchema {
	action: Record<string, ICgEventsSchemaEntry>;
	trigger: Record<string, ICgEventsSchemaEntry>;
	check: Record<string, ICgEventsSchemaEntry>;
	definition: Record<string, ICgEventsSchemaEntry>;
}

export function parseSchemaDefault(text: string): any {
	if (text === undefined || text === null) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch { }
	try {
		return JSON.parse(`"${text}"`);
	} catch { }
}

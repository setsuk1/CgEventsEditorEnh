import type { ICgEventsSchema, ICgEventsSchemaEntry, ICgEventsSchemaProperty, ICgEventsSchemaTypeSimple } from '@shared';
import type { HelperInfo, PrimitiveInputType } from '../inputs/PropertyElement';

export type SchemaSection = 'definition' | 'action' | 'trigger' | 'check';

export interface EmbeddedConfigsPanelComponentProps {
	configs: Record<string, any>;
	configKey: string;
	schema?: ICgEventsSchema;
	schemaSection?: SchemaSection;
	onUpdate(patch: Record<string, any>): void;
	onClose(): void;
	embedded?: boolean;
	showHeader?: boolean;
	onEditAsJson?(): void;
}

export interface ConfigsPanelFieldApi {
	getDefinitionEntry(name?: string, section?: SchemaSection): ICgEventsSchemaEntry | undefined;
	getLayoutClasses(prop: ICgEventsSchemaProperty, useGridLayout: boolean, forceFullWidth?: boolean): string;
	getPropertyFormat(prop: ICgEventsSchemaProperty): string | undefined;
	getPrimitiveInputType(prop: ICgEventsSchemaProperty): PrimitiveInputType;
	normalizeSchemaType(type: string): ICgEventsSchemaTypeSimple | 'array' | undefined;
	resolveDefinitionName(schemaProp?: ICgEventsSchemaProperty, checkArrayItems?: boolean): string | null;
	isPropertyVisible(target: any, prop: ICgEventsSchemaProperty): boolean;
	getDefaultValueForProp(prop?: ICgEventsSchemaProperty): any;
	buildDefaultDefinitionValue(entry?: ICgEventsSchemaEntry): Record<string, any>;
	parseHelper(
		helperValue: unknown,
		source: 'format' | 'helper',
		editorOptions: any,
		entryType: 'action' | 'trigger' | 'check' | 'definition',
		entryKey: string,
		propKey: string,
	): HelperInfo | null;
	coercePrimitive(value: string, schemaProp?: ICgEventsSchemaProperty): any;
	updateValue(path: Array<string | number>, value: any): void;
	updateValueWithTemplates(
		scopeTarget: any,
		scopePath: Array<string | number>,
		key: string,
		value: any,
		scopeProps: ICgEventsSchemaProperty[],
	): void;
}


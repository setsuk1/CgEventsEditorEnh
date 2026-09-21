export interface HelperInfo {
	name: string;
	helperType: string;
	args: Record<string, string>;
	raw: string;
	source: 'format' | 'helper';
	editorOptions?: any;
	entryType?: 'action' | 'trigger' | 'check' | 'definition';
	entryKey?: string;
	propKey?: string;
}

export type LogicListShortcutContextMode = 'section' | 'item' | undefined;

export type LogicListShortcutAction =
	| 'escape'
	| 'section-copy'
	| 'section-cut'
	| 'section-paste'
	| 'selection-copy'
	| 'selection-cut'
	| 'selection-paste'
	| 'section-toggle'
	| 'section-add'
	| 'section-toggle-disabled'
	| 'section-remove'
	| 'item-edit'
	| 'item-remove'
	| 'item-top'
	| 'item-bottom'
	| 'item-toggle-disabled'
	| 'item-toggle-section'
	| 'item-add'
	| 'item-duplicate';

export interface LogicListShortcutInput {
	key: string;
	repeat: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	modalOpen: boolean;
	interactiveTarget: boolean;
	contextMode: LogicListShortcutContextMode;
	hasActiveIndex: boolean;
}

export interface LogicListShortcutPlan {
	action: LogicListShortcutAction;
	consume: boolean;
}

const ITEM_CONTEXT_ACTIONS: Record<string, LogicListShortcutAction> = {
	e: 'item-edit',
	r: 'item-remove',
	t: 'item-top',
	b: 'item-bottom',
	a: 'item-toggle-disabled',
	c: 'item-toggle-section',
	n: 'item-add',
	d: 'item-duplicate',
};

const SECTION_CONTEXT_ACTIONS: Record<string, LogicListShortcutAction> = {
	c: 'section-toggle',
	n: 'section-add',
	a: 'section-toggle-disabled',
	r: 'section-remove',
};

export function resolveLogicListShortcut(
	input: LogicListShortcutInput,
): LogicListShortcutPlan | null {
	if (input.modalOpen || input.repeat || input.interactiveTarget) return null;

	if (input.key === 'Escape') {
		return { action: 'escape', consume: false };
	}

	const key = input.key.toLowerCase();
	const commandModifier = input.ctrlKey || input.metaKey;
	if (commandModifier) {
		if (input.altKey || input.shiftKey || !['c', 'v', 'x'].includes(key)) return null;
		if (input.contextMode === 'section') {
			return {
				action: key === 'c' ? 'section-copy' : key === 'x' ? 'section-cut' : 'section-paste',
				consume: true,
			};
		}
		if (!input.hasActiveIndex) return null;
		return {
			action: key === 'c' ? 'selection-copy' : key === 'x' ? 'selection-cut' : 'selection-paste',
			consume: true,
		};
	}

	if (input.altKey || input.shiftKey || !input.contextMode) return null;
	const action = input.contextMode === 'section'
		? SECTION_CONTEXT_ACTIONS[key]
		: ITEM_CONTEXT_ACTIONS[key];
	return action ? { action, consume: true } : null;
}

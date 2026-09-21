interface UndoRedoOptions {
	allowInMonaco?: boolean;
}

interface EnterCommitOptions {
	allowInMonaco?: boolean;
}

function isEventInContainer(event: Event, container: HTMLElement | null): boolean {
	const target = event.target;
	return !!container && target instanceof Node && container.contains(target);
}

export interface FormShortcutContext {
	key: string;
	isComposing: boolean;
	defaultPrevented: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	inContainer: boolean;
	inMonaco: boolean;
	isInput: boolean;
	isContentEditable: boolean;
}

export type FormUndoRedoAction = 'undo' | 'redo';

export function resolveFormUndoRedoShortcut(
	context: FormShortcutContext,
	options?: UndoRedoOptions,
): FormUndoRedoAction | undefined {
	if (!context.inContainer || context.isComposing || context.defaultPrevented) return undefined;
	if (!(context.ctrlKey || context.metaKey) || context.altKey) return undefined;
	if (!options?.allowInMonaco && context.inMonaco) return undefined;

	const key = context.key.toLowerCase();
	if (key === 'z' && !context.shiftKey) return 'undo';
	if ((key === 'y' && !context.shiftKey) || (key === 'z' && context.shiftKey)) return 'redo';
	return undefined;
}

export function shouldHandleFormEnterCommit(
	context: FormShortcutContext,
	options?: EnterCommitOptions,
): boolean {
	if (!context.inContainer || context.key !== 'Enter' || context.isComposing || context.defaultPrevented) return false;
	if (context.ctrlKey || context.metaKey || context.altKey) return false;
	if (!options?.allowInMonaco && context.inMonaco) return false;
	return context.isInput && !context.isContentEditable;
}

function createFormShortcutContext(event: KeyboardEvent, container: HTMLElement | null): FormShortcutContext {
	const target = event.target;
	return {
		key: event.key,
		isComposing: event.isComposing,
		defaultPrevented: event.defaultPrevented,
		ctrlKey: event.ctrlKey,
		metaKey: event.metaKey,
		altKey: event.altKey,
		shiftKey: event.shiftKey,
		inContainer: isEventInContainer(event, container),
		inMonaco: target instanceof HTMLElement && Boolean(target.closest('.monaco-editor')),
		isInput: target instanceof HTMLInputElement,
		isContentEditable: target instanceof HTMLElement && target.isContentEditable,
	};
}

export function handleUndoRedoShortcuts(
	event: KeyboardEvent,
	container: HTMLElement | null,
	onUndo: () => void,
	onRedo: () => void,
	options?: UndoRedoOptions
): boolean {
	const action = resolveFormUndoRedoShortcut(createFormShortcutContext(event, container), options);
	if (!action) return false;

	event.preventDefault();
	if (action === 'undo') onUndo();
	else onRedo();
	return true;
}

export function handleEnterCommitShortcut(
	event: KeyboardEvent,
	container: HTMLElement | null,
	onCommit: () => void,
	options?: EnterCommitOptions
): boolean {
	if (!shouldHandleFormEnterCommit(createFormShortcutContext(event, container), options)) {
		return false;
	}
	event.preventDefault();
	onCommit();
	return true;
}

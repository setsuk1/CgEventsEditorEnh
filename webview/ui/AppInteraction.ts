export type AppGlobalShortcutAction = 'save' | 'undo' | 'redo';

export interface AppGlobalShortcutInput {
	key: string;
	isComposing: boolean;
	defaultPrevented: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	panelOpen: boolean;
	editableTarget: boolean;
}

export function resolveAppGlobalShortcut(
	input: AppGlobalShortcutInput,
): AppGlobalShortcutAction | undefined {
	if (
		input.isComposing
		|| input.defaultPrevented
		|| !(input.ctrlKey || input.metaKey)
		|| input.altKey
		|| input.panelOpen
	) {
		return undefined;
	}

	const key = input.key.toLowerCase();
	if (key === 's' && !input.shiftKey) return 'save';
	if (input.editableTarget) return undefined;
	if (key === 'z' && !input.shiftKey) return 'undo';
	if ((key === 'z' && input.shiftKey) || (key === 'y' && !input.shiftKey)) return 'redo';
	return undefined;
}

export interface AppNavScrollInput {
	mode: 'visual' | 'json';
	scrollTop: number;
	lastScrollTop: number;
	headerHeight: number;
	navCollapsed: boolean;
}

export interface AppNavScrollState {
	lastScrollTop: number;
	navCollapsed: boolean;
}

const TOP_REVEAL_THRESHOLD_PX = 2;
const HIDE_DELTA_THRESHOLD_PX = 6;
const SHOW_DELTA_THRESHOLD_PX = 1;

export function resolveAppNavScrollState(
	input: AppNavScrollInput,
): AppNavScrollState {
	if (input.mode !== 'visual') {
		return {
			lastScrollTop: input.lastScrollTop,
			navCollapsed: input.navCollapsed,
		};
	}

	const scrollTop = Number.isFinite(input.scrollTop) ? Math.max(0, input.scrollTop) : 0;
	const headerHeight = Number.isFinite(input.headerHeight) ? Math.max(0, input.headerHeight) : 0;

	if (scrollTop <= TOP_REVEAL_THRESHOLD_PX || scrollTop < headerHeight) {
		return { lastScrollTop: scrollTop, navCollapsed: false };
	}

	const lastScrollTop = Number.isFinite(input.lastScrollTop) ? input.lastScrollTop : scrollTop;
	const delta = scrollTop - lastScrollTop;
	let navCollapsed = input.navCollapsed;
	if (delta > HIDE_DELTA_THRESHOLD_PX) navCollapsed = true;
	else if (delta < -SHOW_DELTA_THRESHOLD_PX) navCollapsed = false;

	return { lastScrollTop: scrollTop, navCollapsed };
}
